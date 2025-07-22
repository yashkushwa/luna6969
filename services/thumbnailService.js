const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const { promisify } = require('util');
const configManager = require('../utils/configManager');
const cache = require('../utils/cache');

const ffprobe = promisify(ffmpeg.ffprobe);

/**
 * Thumbnail service - handles thumbnail generation and management
 */
class ThumbnailService {
    constructor() {
        this.config = configManager.get();
        this.videosDir = this.config.directories.videos;
        this.thumbnailsDir = this.config.directories.thumbnails;
        this.thumbnailConfig = this.config.thumbnails;
        
        // Supported video formats
        this.supportedFormats = ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.flv'];
    }

    /**
     * Get video duration using ffprobe
     */
    async getVideoDuration(videoPath) {
        try {
            const metadata = await ffprobe(videoPath);
            return metadata.format.duration;
        } catch (error) {
            console.error(`Error getting video duration for ${path.basename(videoPath)}:`, error);
            throw error;
        }
    }

    /**
     * Generate thumbnail for a specific video
     */
    async generateThumbnail(videoPath, thumbnailPath, options = {}) {
        const {
            timestamp = null,
            width = this.thumbnailConfig.width || 320,
            height = this.thumbnailConfig.height || 180,
            quality = this.thumbnailConfig.quality || 2
        } = options;

        try {
            // Get video duration to determine timestamp
            const duration = await this.getVideoDuration(videoPath);
            const validDuration = typeof duration === 'number' && duration > 0 ? duration : 10;
            
            // Use provided timestamp or generate random one
            let thumbnailTimestamp;
            if (timestamp) {
                thumbnailTimestamp = timestamp;
            } else {
                // Generate timestamp between 10% and 90% of video duration
                const minTime = Math.max(1, validDuration * 0.1);
                const maxTime = validDuration * 0.9;
                thumbnailTimestamp = Math.random() * (maxTime - minTime) + minTime;
            }

            return new Promise((resolve, reject) => {
                ffmpeg(videoPath)
                    .on('end', () => {
                        console.log(`Thumbnail generated for ${path.basename(videoPath)}`);
                        const thumbnailName = path.basename(thumbnailPath);
                        const thumbnailUrl = `/thumbnails/${encodeURIComponent(thumbnailName)}?_=${Date.now()}`;
                        resolve(thumbnailUrl);
                    })
                    .on('error', (error) => {
                        console.error(`Error generating thumbnail for ${path.basename(videoPath)}:`, error);
                        reject(error);
                    })
                    .screenshots({
                        timestamps: [thumbnailTimestamp],
                        filename: path.basename(thumbnailPath),
                        folder: this.thumbnailsDir,
                        size: `${width}x${height}`
                    });
            });
        } catch (error) {
            console.error(`Failed to generate thumbnail for ${path.basename(videoPath)}:`, error);
            throw error;
        }
    }

    /**
     * Refresh thumbnail for a specific video
     */
    async refreshThumbnail(videoTitle) {
        const videoFiles = await fs.readdir(this.videosDir);
        const videoFile = videoFiles.find(file => {
            const baseName = path.parse(file).name;
            return baseName === videoTitle && this.supportedFormats.includes(path.extname(file).toLowerCase());
        });

        if (!videoFile) {
            throw new Error('Video file not found');
        }

        const videoPath = path.join(this.videosDir, videoFile);
        const thumbnailName = videoTitle + '.jpg';
        const thumbnailPath = path.join(this.thumbnailsDir, thumbnailName);

        try {
            // Delete old thumbnail if it exists
            try {
                await fs.access(thumbnailPath);
                await fs.unlink(thumbnailPath);
                console.log(`Deleted old thumbnail for ${videoTitle}`);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.warn(`Warning: Could not delete old thumbnail: ${error.message}`);
                }
            }

            // Generate new thumbnail
            const thumbnailUrl = await this.generateThumbnail(videoPath, thumbnailPath);

            // Clear cache
            cache.del('thumbnails', `thumb:${videoTitle}`);
            cache.del('videoMetadata', `video:${videoFile}`);

            return {
                success: true,
                thumbnailUrl,
                message: `Thumbnail refreshed for ${videoTitle}`
            };
        } catch (error) {
            console.error(`Failed to refresh thumbnail for ${videoTitle}:`, error);
            throw new Error(`Failed to refresh thumbnail: ${error.message}`);
        }
    }

    /**
     * Ensure all videos have thumbnails
     */
    async ensureThumbnails() {
        try {
            // Ensure thumbnail directory exists
            await fs.mkdir(this.thumbnailsDir, { recursive: true });
            
            const videoFiles = await fs.readdir(this.videosDir);
            const supportedVideos = videoFiles.filter(file => 
                this.supportedFormats.includes(path.extname(file).toLowerCase())
            );

            let generatedCount = 0;
            const promises = supportedVideos.map(async (videoFile) => {
                const videoPath = path.join(this.videosDir, videoFile);
                const baseName = path.parse(videoFile).name;
                const thumbnailName = baseName + '.jpg';
                const thumbnailPath = path.join(this.thumbnailsDir, thumbnailName);

                try {
                    // Check if thumbnail already exists
                    await fs.access(thumbnailPath);
                    
                    // Check if thumbnail is newer than video
                    const videoStat = await fs.stat(videoPath);
                    const thumbnailStat = await fs.stat(thumbnailPath);
                    
                    if (thumbnailStat.mtime < videoStat.mtime) {
                        console.log(`Regenerating outdated thumbnail for ${videoFile}...`);
                        await this.generateThumbnail(videoPath, thumbnailPath);
                        generatedCount++;
                    }
                } catch (error) {
                    if (error.code === 'ENOENT') {
                        // Thumbnail doesn't exist, generate it
                        console.log(`Generating thumbnail for ${videoFile}...`);
                        try {
                            await this.generateThumbnail(videoPath, thumbnailPath);
                            generatedCount++;
                        } catch (genError) {
                            console.error(`Failed to generate thumbnail for ${videoFile}:`, genError.message);
                        }
                    } else {
                        console.warn(`Error checking thumbnail for ${videoFile}:`, error.message);
                    }
                }
            });

            await Promise.all(promises);
            
            console.log(`Thumbnail check completed. Generated ${generatedCount} new/updated thumbnails.`);
            return {
                success: true,
                generated: generatedCount,
                total: supportedVideos.length
            };
        } catch (error) {
            console.error('Error ensuring thumbnails:', error);
            throw new Error(`Failed to ensure thumbnails: ${error.message}`);
        }
    }

    /**
     * Batch generate thumbnails with progress tracking
     */
    async batchGenerateThumbnails(videoFiles, progressCallback) {
        const results = [];
        const total = videoFiles.length;
        let completed = 0;

        for (const videoFile of videoFiles) {
            try {
                const videoPath = path.join(this.videosDir, videoFile);
                const baseName = path.parse(videoFile).name;
                const thumbnailPath = path.join(this.thumbnailsDir, `${baseName}.jpg`);

                const thumbnailUrl = await this.generateThumbnail(videoPath, thumbnailPath);
                results.push({
                    videoFile,
                    success: true,
                    thumbnailUrl
                });
            } catch (error) {
                results.push({
                    videoFile,
                    success: false,
                    error: error.message
                });
            }

            completed++;
            if (progressCallback) {
                progressCallback({
                    completed,
                    total,
                    percentage: Math.round((completed / total) * 100),
                    current: videoFile
                });
            }
        }

        return results;
    }

    /**
     * Get thumbnail information for a video
     */
    async getThumbnailInfo(videoTitle) {
        const cacheKey = `thumb:${videoTitle}`;
        const cached = cache.get('thumbnails', cacheKey);
        if (cached) {
            return cached;
        }

        const thumbnailName = videoTitle + '.jpg';
        const thumbnailPath = path.join(this.thumbnailsDir, thumbnailName);

        try {
            const stat = await fs.stat(thumbnailPath);
            const info = {
                exists: true,
                path: thumbnailPath,
                url: `/thumbnails/${encodeURIComponent(thumbnailName)}?_=${stat.mtime.getTime()}`,
                size: stat.size,
                created: stat.birthtime,
                modified: stat.mtime
            };

            cache.set('thumbnails', cacheKey, info, 3600); // 1 hour
            return info;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return {
                    exists: false,
                    path: thumbnailPath,
                    url: null
                };
            }
            throw error;
        }
    }

    /**
     * Delete thumbnail for a video
     */
    async deleteThumbnail(videoTitle) {
        const thumbnailPath = path.join(this.thumbnailsDir, `${videoTitle}.jpg`);

        try {
            await fs.unlink(thumbnailPath);
            cache.del('thumbnails', `thumb:${videoTitle}`);
            
            return {
                success: true,
                message: `Thumbnail deleted for ${videoTitle}`
            };
        } catch (error) {
            if (error.code === 'ENOENT') {
                return {
                    success: true,
                    message: `Thumbnail for ${videoTitle} was already missing`
                };
            }
            throw new Error(`Failed to delete thumbnail: ${error.message}`);
        }
    }

    /**
     * Get thumbnail statistics
     */
    async getStats() {
        try {
            const videoFiles = await fs.readdir(this.videosDir);
            const supportedVideos = videoFiles.filter(file => 
                this.supportedFormats.includes(path.extname(file).toLowerCase())
            );

            const thumbnailFiles = await fs.readdir(this.thumbnailsDir).catch(() => []);
            const thumbnailCount = thumbnailFiles.filter(file => file.endsWith('.jpg')).length;

            // Calculate total thumbnail size
            let totalSize = 0;
            for (const file of thumbnailFiles) {
                try {
                    const stat = await fs.stat(path.join(this.thumbnailsDir, file));
                    totalSize += stat.size;
                } catch (error) {
                    // Ignore errors for individual files
                }
            }

            return {
                videos: supportedVideos.length,
                thumbnails: thumbnailCount,
                coverage: supportedVideos.length > 0 ? Math.round((thumbnailCount / supportedVideos.length) * 100) : 0,
                totalSize: `${(totalSize / (1024 * 1024)).toFixed(2)} MB`,
                averageSize: thumbnailCount > 0 ? `${((totalSize / thumbnailCount) / 1024).toFixed(1)} KB` : '0 KB',
                directory: this.thumbnailsDir
            };
        } catch (error) {
            console.error('Error getting thumbnail stats:', error);
            throw new Error(`Failed to get thumbnail statistics: ${error.message}`);
        }
    }

    /**
     * Cleanup orphaned thumbnails
     */
    async cleanup() {
        try {
            const videoFiles = await fs.readdir(this.videosDir);
            const videoTitles = new Set(
                videoFiles
                    .filter(file => this.supportedFormats.includes(path.extname(file).toLowerCase()))
                    .map(file => path.parse(file).name)
            );

            const thumbnailFiles = await fs.readdir(this.thumbnailsDir);
            let deletedCount = 0;

            for (const thumbnailFile of thumbnailFiles) {
                const baseName = path.parse(thumbnailFile).name;
                if (!videoTitles.has(baseName)) {
                    await fs.unlink(path.join(this.thumbnailsDir, thumbnailFile));
                    deletedCount++;
                    console.log(`Deleted orphaned thumbnail: ${thumbnailFile}`);
                }
            }

            // Clear thumbnail cache
            cache.clear('thumbnails');

            return {
                success: true,
                deletedCount,
                message: `Deleted ${deletedCount} orphaned thumbnails`
            };
        } catch (error) {
            console.error('Error cleaning up thumbnails:', error);
            throw new Error(`Failed to cleanup thumbnails: ${error.message}`);
        }
    }
}

module.exports = ThumbnailService;
