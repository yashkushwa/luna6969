require('./logger');

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const { promisify } = require('util');

const ffprobe = promisify(ffmpeg.ffprobe);

let config;
try {
    config = JSON.parse(require('fs').readFileSync('./config.json', 'utf8'));
} catch (error) {
    console.error('Error loading config.json in thumbnailGenerator:', error.message);
    config = {
        directories: {
            videos: './videos',
            thumbnails: './thumbnails'
        }
    };
}

const videosDir = path.resolve(config.directories.videos);
const thumbnailsDir = path.resolve(config.directories.thumbnails);

async function getVideoDuration(videoPath) {
    try {
        const metadata = await ffprobe(videoPath);
        return metadata.format.duration;
    } catch (err) {
        console.error(`Error getting video duration for ${path.basename(videoPath)}:`, err);
        throw err;
    }
}

async function generateThumbnail(videoPath, thumbnailPath) {
    const duration = await getVideoDuration(videoPath);
    const validDuration = typeof duration === 'number' && duration > 0 ? duration : 1;
    const randomTimestamp = Math.random() * validDuration;

    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .on('end', () => {
                console.log(`Thumbnail generated for ${path.basename(videoPath)}`);
                const thumbnailName = path.basename(thumbnailPath);
                resolve(`/thumbnails/${encodeURIComponent(thumbnailName)}?_=${Date.now()}`);
            })
            .on('error', (err) => {
                console.error(`Error generating thumbnail for ${path.basename(videoPath)}:`, err);
                reject(err);
            })
            .screenshots({
                timestamps: [randomTimestamp],
                filename: path.basename(thumbnailPath),
                folder: thumbnailsDir,
                size: '1920x1080'
            });
    });
}

async function ensureThumbnails() {
    try {
        await fs.mkdir(thumbnailsDir, { recursive: true });
        const videoFiles = await fs.readdir(videosDir);

        for (const videoFile of videoFiles) {
            if (videoFile.endsWith('.mp4')) {
                const videoPath = path.join(videosDir, videoFile);
                const thumbnailName = path.parse(videoFile).name + '.jpg';
                const thumbnailPath = path.join(thumbnailsDir, thumbnailName);

                try {
                    await fs.access(thumbnailPath);
                } catch (error) {
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