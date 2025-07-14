const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises; // Use promises version of fs

// Load configuration
let config;
try {
    config = JSON.parse(require('fs').readFileSync('./config.json', 'utf8'));
} catch (error) {
    console.error('Error loading config.json in thumbnailGenerator:', error.message);
    config = {
        directories: {
            videos: './videos',
            thumbnails: './thumbnails'
        },
        thumbnails: {
            defaultThumbnailTime: '00:00:01',
            quality: 2,
            width: 320,
            height: 180
        }
    };
}

// Ensure ffmpeg path is configured if it's not in the system's PATH
// For Windows: ffmpeg.setFfmpegPath('C:\path\to\ffmpeg\bin\ffmpeg.exe');
// For Linux/macOS: ffmpeg.setFfmpegPath('/usr/local/bin/ffmpeg'); 

const videosDir = path.resolve(config.directories.videos);
const thumbnailsDir = path.resolve(config.directories.thumbnails);

async function getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                console.error(`Error getting video duration for ${path.basename(videoPath)}:`, err);
                return reject(err);
            }
            resolve(metadata.format.duration);
        });
    });
}

async function generateThumbnail(videoPath, thumbnailPath) {
    return new Promise(async (resolve, reject) => {
        try {
            const duration = await getVideoDuration(videoPath);
            // Ensure duration is a positive number; if not, default to a safe value or handle error
            const validDuration = typeof duration === 'number' && duration > 0 ? duration : 1;
            const randomTimestamp = Math.random() * validDuration; // Random timestamp in seconds

            ffmpeg(videoPath)
                .on('end', () => {
                    console.log(`Thumbnail generated for ${path.basename(videoPath)}`);
                    // Resolve with the URL, adding a cache-busting timestamp
                    const thumbnailName = path.basename(thumbnailPath);
                    resolve(`/thumbnails/${encodeURIComponent(thumbnailName)}?_=${Date.now()}`);
                })
                .on('error', (err) => {
                    console.error(`Error generating thumbnail for ${path.basename(videoPath)}:`, err);
                    reject(err);
                })
                .screenshots({
                    timestamps: [randomTimestamp], // Use random timestamp
                    filename: path.basename(thumbnailPath),
                    folder: thumbnailsDir,
                    size: `${config.thumbnails.width}x${config.thumbnails.height}` // Configurable thumbnail size
                });
        } catch (error) {
            reject(error);
        }
    });
}

async function ensureThumbnails() {
    try {
        await fs.mkdir(thumbnailsDir, { recursive: true }); // Ensure thumbnails directory exists

        const videoFiles = await fs.readdir(videosDir);

        for (const videoFile of videoFiles) {
            if (videoFile.endsWith('.mp4')) { // Process only mp4 files for now
                const videoPath = path.join(videosDir, videoFile);
                const thumbnailName = path.parse(videoFile).name + '.jpg';
                const thumbnailPath = path.join(thumbnailsDir, thumbnailName);

                try {
                    await fs.access(thumbnailPath); // Check if thumbnail already exists
                    
                } catch (error) {
                    // Thumbnail does not exist, generate it
                    console.log(`Generating thumbnail for ${videoFile}...`);
                    await generateThumbnail(videoPath, thumbnailPath);
                }
            }
        }
        console.log('All thumbnails checked/generated.');
    } catch (err) {
        console.error('Error ensuring thumbnails:', err);
    }
}

module.exports = { ensureThumbnails, generateThumbnail }; 