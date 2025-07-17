const fs = require('fs').promises;
const path = require('path');
const { exec, spawn } = require('child_process');
const { ensureThumbnails, generateThumbnail } = require('../utils/thumbnailGenerator');

// Load configuration
let config;
try {
    config = JSON.parse(require('fs').readFileSync(path.join(__dirname, '../config.json'), 'utf8'));
} catch (error) {
    console.error('Error loading config.json:', error.message);
    console.log('Using default configuration...');
    config = {
        directories: {
            videos: './videos',
            thumbnails: './thumbnails',
            processed: './processed'
        },
        server: {
            port: 3000
        }
    };
}

const VIDEOS_DIR = path.resolve(config.directories.videos);
const THUMBNAILS_DIR = path.resolve(config.directories.thumbnails);
const PROCESSED_DIR = path.resolve(config.directories.processed);

let videos = []; // Cache for video metadata

// Helper to get video duration using ffprobe
function getVideoDuration(filePath) {
    return new Promise((resolve) => {
        exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, (err, stdout) => {
            if (err) return resolve(null);
            const seconds = parseFloat(stdout);
            if (isNaN(seconds)) return resolve(null);
            // Format as mm:ss
            const min = Math.floor(seconds / 60);
            const sec = Math.round(seconds % 60).toString().padStart(2, '0');
            resolve(`${min}:${sec}`);
        });
    });
}

// Function to read and process video files
async function readVideoFiles() {
    return new Promise((resolve, reject) => {
        fs.readdir(VIDEOS_DIR)
            .then(async (files) => {
                const videoFiles = files.filter(f => /\.(mp4|webm|mov|mkv)$/i.test(f));
                const processedVideos = await Promise.all(videoFiles.map(async (filename, idx) => {
                    const filePath = path.join(VIDEOS_DIR, filename);
                    const stat = await fs.stat(filePath);
                    const sizeMB = (stat.size / (1024 * 1024)).toFixed(1) + ' MB';
                    const duration = await getVideoDuration(filePath) || 'Unknown';
                    const thumbnailName = path.parse(filename).name + '.jpg';
                    // Add a cache-busting timestamp to the thumbnail URL
                    const thumbnailUrl = `/thumbnails/${encodeURIComponent(thumbnailName)}?_=${Date.now()}`;
                    
                    // Check for VTT file in processed directory
                    const vttName = path.parse(filename).name + '.vtt';
                    const vttPath = path.join(PROCESSED_DIR, vttName);
                    let vttUrl = null;
                    try {
                        await fs.access(vttPath);
                        vttUrl = `/processed/${encodeURIComponent(vttName)}`;
                    } catch (err) {
                        // VTT file doesn't exist, that's okay
                    }
                    
                    // Get and format the creation date of the video
                    const creationDate = stat.birthtime.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });

                    return {
                        id: idx + 1,
                        title: path.parse(filename).name,
                        duration,
                        size: sizeMB,
                        date: creationDate, // Add the creation date
                        thumbnail: thumbnailUrl,
                        vtt: vttUrl, // Add VTT file URL if available
                        url: `/videos/${encodeURIComponent(filename)}`
                    };
                }));
                resolve(processedVideos);
            })
            .catch(err => reject({ error: 'Cannot read videos directory' }));
    });
}

// Controller methods
exports.getAllVideos = async (req, res) => {
    try {
        await ensureThumbnails(); // Ensure thumbnails are generated on every API request
        videos = await readVideoFiles(); // Update the cached videos array
        res.json(videos);
    } catch (error) {
        console.error('Error getting videos:', error);
        res.status(500).json({ error: 'Failed to get videos' });
    }
};

exports.refreshThumbnail = async (req, res) => {
    const videoId = parseInt(req.params.id);
    const videoToRefresh = videos.find(v => v.id === videoId);

    if (!videoToRefresh) {
        return res.status(404).json({ error: 'Video not found' });
    }

    const thumbnailName = path.parse(videoToRefresh.title).name + '.jpg';
    const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailName);
    const videoPath = path.join(VIDEOS_DIR, `${videoToRefresh.title}.mp4`); // Assuming .mp4

    try {
        // 1. Delete the old thumbnail if it exists
        try {
            await fs.access(thumbnailPath);
            await fs.unlink(thumbnailPath);
            console.log(`Old thumbnail deleted for ${videoToRefresh.title}`);
        } catch (error) {
            // Ignore error if file doesn't exist (first time generation or already deleted)
            if (error.code !== 'ENOENT') {
                console.error(`Error deleting old thumbnail for ${videoToRefresh.title}:`, error);
            }
        }

        // 2. Generate a new thumbnail and wait for it to complete
        const newThumbnailUrl = await generateThumbnail(videoPath, thumbnailPath);
        
        // Update the video object in the global array with the new thumbnail URL
        videoToRefresh.thumbnail = newThumbnailUrl;

        res.json({ newThumbnailUrl: newThumbnailUrl });

    } catch (error) {
        console.error(`Failed to refresh thumbnail for ${videoToRefresh.title}:`, error);
        res.status(500).json({ error: 'Failed to refresh thumbnail' });
    }
};

exports.generateSprite = async (req, res) => {
    const videoId = parseInt(req.params.id);
    const video = videos.find(v => v.id === videoId);

    if (!video) {
        return res.status(404).json({ error: 'Video not found' });
    }

    try {
        console.log(`Starting sprite generation for video: ${video.title}`);
        
        // Find the actual video file (could be .mp4, .mov, .mkv, etc.)
        const videoFiles = await fs.readdir(VIDEOS_DIR);
        const videoFile = videoFiles.find(f => 
            path.parse(f).name === video.title && 
            /\.(mp4|webm|mov|mkv)$/i.test(f)
        );

        if (!videoFile) {
            return res.status(404).json({ error: 'Video file not found on disk' });
        }

        const videoPath = path.join(VIDEOS_DIR, videoFile);
        
        // Ensure processed directory exists
        await fs.mkdir(PROCESSED_DIR, { recursive: true });

        // Execute the Python script for this specific video
        const pythonScriptPath = path.join(__dirname, '../scripts/spritepreview.py');
        console.log(`Executing Python script: ${pythonScriptPath} with ${videoPath}`);
        
        // Run python script and stream logs in real-time
        await new Promise((resolve, reject) => {
            const child = spawn('python', [pythonScriptPath, videoPath], {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            child.stdout.on('data', data => {
                process.stdout.write(data); // forward to server console
            });
            child.stderr.on('data', data => {
                process.stderr.write(data); // show errors live
            });

            child.on('error', reject);
            child.on('close', code => {
                if (code === 0) return resolve();
                reject(new Error(`Python script exited with code ${code}`));
            });
        });

        // Check if the sprite and VTT files were created
        const baseName = path.parse(videoFile).name;
        const spritePath = path.join(PROCESSED_DIR, `${baseName}.png`);
        const vttPath = path.join(PROCESSED_DIR, `${baseName}.vtt`);

        try {
            await fs.access(spritePath);
            await fs.access(vttPath);
        } catch (error) {
            return res.status(500).json({ error: 'Sprite or VTT file was not created successfully' });
        }

        // Update the video object with the new VTT URL
        video.vtt = `/processed/${encodeURIComponent(baseName + '.vtt')}`;

        res.json({
            success: true,
            spritePath: `/processed/${baseName}.png`,
            vttPath: `/processed/${baseName}.vtt`,
            message: `Sprite and VTT generated successfully for ${video.title}`
        });

    } catch (error) {
        console.error(`Failed to generate sprite for ${video.title}:`, error);
        res.status(500).json({ 
            error: `Failed to generate sprite: ${error.message}` 
        });
    }
};

exports.renameVideo = async (req, res) => {
    const videoId = parseInt(req.params.id);
    const { newName } = req.body;
    const video = videos.find(v => v.id === videoId);

    if (!video) {
        return res.status(404).json({ error: 'Video not found' });
    }

    if (!newName || newName.trim() === '') {
        return res.status(400).json({ error: 'New name is required' });
    }

    // Clean up the new name to be filesystem safe
    const sanitizedName = newName.trim().replace(/[\\/:*?"<>|]/g, '_');
    
    try {
        // Find the actual video file
        const videoFiles = await fs.readdir(VIDEOS_DIR);
        const videoFile = videoFiles.find(f => 
            path.parse(f).name === video.title && 
            /\.(mp4|webm|mov|mkv)$/i.test(f)
        );
        
        if (!videoFile) {
            return res.status(404).json({ error: 'Video file not found on disk' });
        }

        const videoExt = path.extname(videoFile);
        const oldVideoPath = path.join(VIDEOS_DIR, videoFile);
        const newVideoPath = path.join(VIDEOS_DIR, `${sanitizedName}${videoExt}`);
        
        // Check if a file with the new name already exists
        try {
            await fs.access(newVideoPath);
            return res.status(409).json({ error: 'A video with this name already exists' });
        } catch (error) {
            // File does not exist, which is what we want
        }
        
        // Rename related files if they exist
        const oldBaseName = video.title;
        const oldThumbnailPath = path.join(THUMBNAILS_DIR, `${oldBaseName}.jpg`);
        const newThumbnailPath = path.join(THUMBNAILS_DIR, `${sanitizedName}.jpg`);
        const oldVttPath = path.join(PROCESSED_DIR, `${oldBaseName}.vtt`);
        const newVttPath = path.join(PROCESSED_DIR, `${sanitizedName}.vtt`);
        const oldSpritePath = path.join(PROCESSED_DIR, `${oldBaseName}.png`);
        const newSpritePath = path.join(PROCESSED_DIR, `${sanitizedName}.png`);
        
        // Rename the video file
        await fs.rename(oldVideoPath, newVideoPath);
        
        // Rename the thumbnail if it exists
        try {
            await fs.access(oldThumbnailPath);
            await fs.rename(oldThumbnailPath, newThumbnailPath);
        } catch (err) {
            // Ignore if thumbnail doesn't exist
        }
        
        // Rename the VTT file if it exists
        try {
            await fs.access(oldVttPath);
            await fs.rename(oldVttPath, newVttPath);
        } catch (err) {
            // Ignore if VTT doesn't exist
        }
        
        // Rename the sprite file if it exists
        try {
            await fs.access(oldSpritePath);
            await fs.rename(oldSpritePath, newSpritePath);
        } catch (err) {
            // Ignore if sprite doesn't exist
        }
        
        // Update the video object
        video.title = sanitizedName;
        video.url = `/videos/${encodeURIComponent(`${sanitizedName}${videoExt}`)}`;
        video.thumbnail = `/thumbnails/${encodeURIComponent(`${sanitizedName}.jpg`)}?_=${Date.now()}`;
        
        if (video.vtt) {
            video.vtt = `/processed/${encodeURIComponent(`${sanitizedName}.vtt`)}`;
        }
        
        res.json({
            success: true,
            video: video,
            message: `Video renamed to ${sanitizedName} successfully`
        });
        
    } catch (error) {
        console.error(`Failed to rename video ${video.title}:`, error);
        res.status(500).json({ error: `Failed to rename video: ${error.message}` });
    }
};

exports.deleteVideo = async (req, res) => {
    const videoId = parseInt(req.params.id);
    const videoToDelete = videos.find(v => v.id === videoId);

    if (!videoToDelete) {
        return res.status(404).json({ error: 'Video not found' });
    }

    try {
        // Find the actual video file
        const videoFiles = await fs.readdir(VIDEOS_DIR);
        const videoFile = videoFiles.find(f => 
            path.parse(f).name === videoToDelete.title && 
            /\.(mp4|webm|mov|mkv)$/i.test(f)
        );
        
        if (!videoFile) {
            return res.status(404).json({ error: 'Video file not found on disk' });
        }

        const videoPath = path.join(VIDEOS_DIR, videoFile);
        const thumbnailPath = path.join(THUMBNAILS_DIR, `${videoToDelete.title}.jpg`);
        const vttPath = path.join(PROCESSED_DIR, `${videoToDelete.title}.vtt`);
        const spritePath = path.join(PROCESSED_DIR, `${videoToDelete.title}.png`);
        
        // Delete the video file
        await fs.unlink(videoPath);
        
        // Delete the thumbnail if it exists
        try {
            await fs.access(thumbnailPath);
            await fs.unlink(thumbnailPath);
        } catch (err) {
            // Ignore if thumbnail doesn't exist
        }
        
        // Delete the VTT file if it exists
        try {
            await fs.access(vttPath);
            await fs.unlink(vttPath);
        } catch (err) {
            // Ignore if VTT doesn't exist
        }
        
        // Delete the sprite file if it exists
        try {
            await fs.access(spritePath);
            await fs.unlink(spritePath);
        } catch (err) {
            // Ignore if sprite doesn't exist
        }
        
        // Remove the video from the array
        videos = videos.filter(v => v.id !== videoId);
        
        res.json({
            success: true,
            message: `Video "${videoToDelete.title}" and associated files deleted successfully`
        });
        
    } catch (error) {
        console.error(`Failed to delete video ${videoToDelete.title}:`, error);
        res.status(500).json({ error: `Failed to delete video: ${error.message}` });
    }
}; 