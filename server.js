const express = require('express');
const fs = require('fs').promises; // Use promises version of fs
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const { ensureThumbnails, generateThumbnail } = require('./thumbnailGenerator'); // Import thumbnail generation function

const execAsync = promisify(exec);

// Middleware to parse JSON
const app = express();
app.use(express.json());

// Load configuration
let config;
try {
    config = JSON.parse(require('fs').readFileSync('./config.json', 'utf8'));
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

const PORT = config.server.port;
const VIDEOS_DIR = path.resolve(config.directories.videos);
const THUMBNAILS_DIR = path.resolve(config.directories.thumbnails);
const PROCESSED_DIR = path.resolve(config.directories.processed);

let videos = []; // Declare videos array in a higher scope

// Serve static video files
app.use('/videos', express.static(VIDEOS_DIR));
// Serve static thumbnail files
app.use('/thumbnails', express.static(THUMBNAILS_DIR));
// Serve static processed files (VTT and sprites)
app.use('/processed', express.static(PROCESSED_DIR));

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

// API to get video metadata
app.get('/api/videos', async (req, res) => {
    await ensureThumbnails(); // Ensure thumbnails are generated on every API request
    videos = await readVideoFiles(); // Assign processed videos to the global videos array
    res.json(videos);
});

// New endpoint to refresh a specific video's thumbnail
app.post('/api/refresh-thumbnail/:id', async (req, res) => {
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
        // This is important because `readVideoFiles` is not called after this specific refresh
        videoToRefresh.thumbnail = newThumbnailUrl;

        res.json({ newThumbnailUrl: newThumbnailUrl });

    } catch (error) {
        console.error(`Failed to refresh thumbnail for ${videoToRefresh.title}:`, error);
        res.status(500).json({ error: 'Failed to refresh thumbnail' });
    }
});

// New endpoint to generate sprite and VTT for a specific video
app.post('/api/generate-sprite/:id', async (req, res) => {
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
        const pythonCommand = `python spritepreview.py "${videoPath}"`;
        console.log(`Executing: ${pythonCommand}`);
        
        const { stdout, stderr } = await execAsync(pythonCommand, {
            cwd: __dirname,
            timeout: 300000 // 5 minutes timeout
        });

        if (stderr) {
            console.warn(`Python script warnings: ${stderr}`);
        }

        console.log(`Python script output: ${stdout}`);

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
});

// Endpoint to rename a video and all its related files
app.post('/api/rename-video/:id', async (req, res) => {
    const videoId = parseInt(req.params.id);
    const { newName } = req.body;
    const video = videos.find(v => v.id === videoId);

    if (!video) {
        return res.status(404).json({ error: 'Video not found' });
    }

    if (!newName || !newName.trim()) {
        return res.status(400).json({ error: 'New name is required' });
    }

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

        const oldBaseName = path.parse(videoFile).name;
        const fileExtension = path.parse(videoFile).ext;
        const newBaseName = newName.trim();

        // Define old and new file paths
        const oldVideoPath = path.join(VIDEOS_DIR, videoFile);
        const newVideoPath = path.join(VIDEOS_DIR, `${newBaseName}${fileExtension}`);
        
        const oldThumbnailPath = path.join(THUMBNAILS_DIR, `${oldBaseName}.jpg`);
        const newThumbnailPath = path.join(THUMBNAILS_DIR, `${newBaseName}.jpg`);
        
        const oldSpritePath = path.join(PROCESSED_DIR, `${oldBaseName}.png`);
        const newSpritePath = path.join(PROCESSED_DIR, `${newBaseName}.png`);
        
        const oldVttPath = path.join(PROCESSED_DIR, `${oldBaseName}.vtt`);
        const newVttPath = path.join(PROCESSED_DIR, `${newBaseName}.vtt`);

        // Check if new video name already exists
        try {
            await fs.access(newVideoPath);
            return res.status(400).json({ error: 'A video with this name already exists' });
        } catch (error) {
            // File doesn't exist, which is what we want
        }

        // Rename video file
        await fs.rename(oldVideoPath, newVideoPath);
        console.log(`Renamed video: ${oldVideoPath} -> ${newVideoPath}`);

        // Rename thumbnail if it exists
        try {
            await fs.access(oldThumbnailPath);
            await fs.rename(oldThumbnailPath, newThumbnailPath);
            console.log(`Renamed thumbnail: ${oldThumbnailPath} -> ${newThumbnailPath}`);
        } catch (error) {
            // Thumbnail doesn't exist, skip
        }

        // Rename sprite if it exists
        try {
            await fs.access(oldSpritePath);
            await fs.rename(oldSpritePath, newSpritePath);
            console.log(`Renamed sprite: ${oldSpritePath} -> ${newSpritePath}`);
        } catch (error) {
            // Sprite doesn't exist, skip
        }

        // Rename and update VTT file if it exists
        try {
            await fs.access(oldVttPath);
            // Read VTT content and update sprite URL
            const vttContent = await fs.readFile(oldVttPath, 'utf8');
            const updatedVttContent = vttContent.replace(
                new RegExp(`/processed/${oldBaseName}\\.png`, 'g'),
                `/processed/${newBaseName}.png`
            );
            await fs.writeFile(newVttPath, updatedVttContent);
            await fs.unlink(oldVttPath); // Delete old VTT file
            console.log(`Renamed and updated VTT: ${oldVttPath} -> ${newVttPath}`);
        } catch (error) {
            // VTT doesn't exist, skip
        }

        // Update the video object in memory
        video.title = newBaseName;
        video.url = `/videos/${encodeURIComponent(`${newBaseName}${fileExtension}`)}`;
        if (video.vtt) {
            video.vtt = `/processed/${encodeURIComponent(`${newBaseName}.vtt`)}`;
        }

        res.json({ 
            success: true, 
            message: `Video renamed to "${newBaseName}"`,
            newTitle: newBaseName
        });

    } catch (error) {
        console.error(`Failed to rename video ${video.title}:`, error);
        res.status(500).json({ 
            error: `Failed to rename video: ${error.message}` 
        });
    }
});

// Endpoint to delete a video and all its related files
app.delete('/api/delete-video/:id', async (req, res) => {
    const videoId = parseInt(req.params.id);
    const video = videos.find(v => v.id === videoId);

    if (!video) {
        return res.status(404).json({ error: 'Video not found' });
    }

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

        const baseName = path.parse(videoFile).name;

        // Define file paths
        const videoPath = path.join(VIDEOS_DIR, videoFile);
        const thumbnailPath = path.join(THUMBNAILS_DIR, `${baseName}.jpg`);
        const spritePath = path.join(PROCESSED_DIR, `${baseName}.png`);
        const vttPath = path.join(PROCESSED_DIR, `${baseName}.vtt`);

        // Delete video file
        await fs.unlink(videoPath);
        console.log(`Deleted video: ${videoPath}`);

        // Delete thumbnail if it exists
        try {
            await fs.access(thumbnailPath);
            await fs.unlink(thumbnailPath);
            console.log(`Deleted thumbnail: ${thumbnailPath}`);
        } catch (error) {
            // Thumbnail doesn't exist, skip
        }

        // Delete sprite if it exists
        try {
            await fs.access(spritePath);
            await fs.unlink(spritePath);
            console.log(`Deleted sprite: ${spritePath}`);
        } catch (error) {
            // Sprite doesn't exist, skip
        }

        // Delete VTT if it exists
        try {
            await fs.access(vttPath);
            await fs.unlink(vttPath);
            console.log(`Deleted VTT: ${vttPath}`);
        } catch (error) {
            // VTT doesn't exist, skip
        }

        // Remove from videos array
        const videoIndex = videos.findIndex(v => v.id === videoId);
        if (videoIndex !== -1) {
            videos.splice(videoIndex, 1);
        }

        res.json({ 
            success: true, 
            message: `Video "${video.title}" and all related files deleted successfully`
        });

    } catch (error) {
        console.error(`Failed to delete video ${video.title}:`, error);
        res.status(500).json({ 
            error: `Failed to delete video: ${error.message}` 
        });
    }
});

// Serve frontend
app.use(express.static(__dirname));

app.listen(PORT, async () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Configuration loaded:`);
    console.log(`  Videos directory: ${VIDEOS_DIR}`);
    console.log(`  Thumbnails directory: ${THUMBNAILS_DIR}`);
    console.log(`  Processed directory: ${PROCESSED_DIR}`);
    await ensureThumbnails(); // Generate thumbnails on server startup
    videos = await readVideoFiles(); // Populate videos array on startup as well
}); 