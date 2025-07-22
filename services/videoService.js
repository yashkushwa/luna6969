const fs = require('fs').promises;
const path = require('path');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const ffmpeg = require('fluent-ffmpeg');
const configManager = require('../utils/configManager');
const cache = require('../utils/cache');

const execAsync = promisify(exec);
const ffprobe = promisify(ffmpeg.ffprobe);

/**
 * Video service - handles all video-related business logic
 */
class VideoService {
    constructor() {
        this.config = configManager.get();
        this.videosDir = this.config.directories.videos;
        this.thumbnailsDir = this.config.directories.thumbnails;
        this.processedDir = this.config.directories.processed;
        
        // Supported video formats
        this.supportedFormats = ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.flv'];
    }

    /**
     * Get all videos with pagination and search
     */
    async getAllVideos(options = {}) {
        const {
            page = 1,
            limit = 20,
            search = '',
            sort = 'title',
            order = 'asc'
        } = options;

        const cacheKey = `videos:${page}:${limit}:${search}:${sort}:${order}`;
        
        // Try to get from cache first
        const cachedVideos = cache.get('videoMetadata', cacheKey);
        if (cachedVideos) {
            console.debug('Returning cached video list');
            return cachedVideos;
        }

        try {
            const videos = await this.scanVideoFiles();
            let filteredVideos = videos;

            // Apply search filter
            if (search && search.length >= 2) {
                const searchLower = search.toLowerCase();
                filteredVideos = videos.filter(video => 
                    video.title.toLowerCase().includes(searchLower)
                );
            }

            // Apply sorting
            filteredVideos.sort((a, b) => {
                let aVal = a[sort];
                let bVal = b[sort];

                // Handle different data types
                if (sort === 'size') {
                    aVal = parseFloat(aVal.replace(' MB', ''));
                    bVal = parseFloat(bVal.replace(' MB', ''));
                } else if (sort === 'date') {
                    aVal = new Date(aVal);
                    bVal = new Date(bVal);
                } else if (sort === 'duration') {
                    aVal = this.durationToSeconds(aVal);
                    bVal = this.durationToSeconds(bVal);
                }

                if (order === 'desc') {
                    return bVal > aVal ? 1 : -1;
                }
                return aVal > bVal ? 1 : -1;
            });

            // Apply pagination
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedVideos = filteredVideos.slice(startIndex, endIndex);

            const result = {
                videos: paginatedVideos,
                pagination: {
                    page,
                    limit,
                    total: filteredVideos.length,
                    pages: Math.ceil(filteredVideos.length / limit),
                    hasNext: endIndex < filteredVideos.length,
                    hasPrev: page > 1
                },
                search,
                sort,
                order
            };

            // Cache the result
            cache.set('videoMetadata', cacheKey, result, 300); // 5 minutes
            
            return result;
        } catch (error) {
            console.error('Error getting videos:', error);
            throw new Error(`Failed to retrieve videos: ${error.message}`);
        }
    }

    /**
     * Scan video files and build metadata
     */
    async scanVideoFiles() {
        const files = await fs.readdir(this.videosDir);
        const videoFiles = files.filter(file => 
            this.supportedFormats.includes(path.extname(file).toLowerCase())
        );

        const videos = await Promise.all(
            videoFiles.map(async (filename, idx) => {
                try {
                    return await this.getVideoMetadata(filename, idx + 1);
                } catch (error) {
                    console.error(`Error processing video ${filename}:`, error);
                    return null;
                }
            })
        );

        // Filter out failed videos
        return videos.filter(video => video !== null);
    }

    /**
     * Get metadata for a single video file
     */
    async getVideoMetadata(filename, id) {
        const filePath = path.join(this.videosDir, filename);
        const baseName = path.parse(filename).name;
        const extension = path.extname(filename);
        
        // Check cache first
        const cacheKey = `video:${filename}`;
        const cachedMetadata = cache.get('videoMetadata', cacheKey);
        if (cachedMetadata) {
            return { ...cachedMetadata, id }; // Update ID in case it changed
        }

        try {
            const stat = await fs.stat(filePath);
            const duration = await this.getVideoDuration(filePath);
            const sizeMB = (stat.size / (1024 * 1024)).toFixed(1) + ' MB';
            
            // Check for thumbnail
            const thumbnailName = baseName + '.jpg';
            const thumbnailPath = path.join(this.thumbnailsDir, thumbnailName);
            let thumbnailUrl = null;
            
            try {
                await fs.access(thumbnailPath);
                thumbnailUrl = `/thumbnails/${encodeURIComponent(thumbnailName)}?_=${stat.mtime.getTime()}`;
            } catch (error) {
                // Thumbnail doesn't exist, we'll generate it later
            }

            // Check for VTT file
            const vttName = baseName + '.vtt';
            const vttPath = path.join(this.processedDir, vttName);
            let vttUrl = null;
            
            try {
                await fs.access(vttPath);
                vttUrl = `/processed/${encodeURIComponent(vttName)}`;
            } catch (error) {
                // VTT file doesn't exist
            }

            const metadata = {
                id,
                title: baseName,
                filename,
                extension,
                duration: duration || 'Unknown',
                size: sizeMB,
                date: stat.birthtime.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                thumbnail: thumbnailUrl,
                vtt: vttUrl,
                url: `/videos/${encodeURIComponent(filename)}`,
                lastModified: stat.mtime
            };

            // Cache the metadata
            cache.set('videoMetadata', cacheKey, metadata, 600); // 10 minutes
            
            return metadata;
        } catch (error) {
            console.error(`Error getting metadata for ${filename}:`, error);
            throw error;
        }
    }

    /**
     * Get video duration using ffprobe
     */
    async getVideoDuration(filePath) {
        try {
            const metadata = await ffprobe(filePath);
            const seconds = metadata.format.duration;
            
            if (!seconds || isNaN(seconds)) {
                return null;
            }

            // Format as mm:ss or h:mm:ss
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.round(seconds % 60);

            if (hours > 0) {
                return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        } catch (error) {
            console.error(`Error getting duration for ${path.basename(filePath)}:`, error);
            return null;
        }
    }

    /**
     * Convert duration string to seconds for sorting
     */
    durationToSeconds(duration) {
        if (!duration || duration === 'Unknown') return 0;
        
        const parts = duration.split(':').map(Number);
        if (parts.length === 2) {
            return parts[0] * 60 + parts[1]; // mm:ss
        } else if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2]; // h:mm:ss
        }
        return 0;
    }

    /**
     * Find video by ID
     */
    async findVideoById(id) {
        const videos = await this.scanVideoFiles();
        return videos.find(video => video.id === parseInt(id));
    }

    /**
     * Find video file by title
     */
    async findVideoFile(title) {
        const files = await fs.readdir(this.videosDir);
        return files.find(file => {
            const baseName = path.parse(file).name;
            return baseName === title && this.supportedFormats.includes(path.extname(file).toLowerCase());
        });
    }

    /**
     * Rename video and all associated files
     */
    async renameVideo(videoId, newName) {
        const video = await this.findVideoById(videoId);
        if (!video) {
            throw new Error('Video not found');
        }

        const videoFile = await this.findVideoFile(video.title);
        if (!videoFile) {
            throw new Error('Video file not found on disk');
        }

        // Sanitize new name
        const sanitizedName = newName.trim().replace(/[\\/:*?"<>|]/g, '_');
        const extension = path.extname(videoFile);
        
        // Check if new name already exists
        const newVideoPath = path.join(this.videosDir, `${sanitizedName}${extension}`);
        try {
            await fs.access(newVideoPath);
            throw new Error('A video with this name already exists');
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }

        const oldVideoPath = path.join(this.videosDir, videoFile);
        const oldBaseName = video.title;

        try {
            // Rename video file
            await fs.rename(oldVideoPath, newVideoPath);

            // Rename associated files
            await this.renameAssociatedFiles(oldBaseName, sanitizedName);

            // Clear relevant caches
            cache.invalidatePattern('videoMetadata', `video:${oldBaseName}`);
            cache.clear('videoMetadata');

            return {
                success: true,
                oldName: oldBaseName,
                newName: sanitizedName,
                message: `Video renamed to "${sanitizedName}" successfully`
            };
        } catch (error) {
            console.error(`Failed to rename video ${video.title}:`, error);
            throw new Error(`Failed to rename video: ${error.message}`);
        }
    }

    /**
     * Rename associated files (thumbnail, sprite, VTT)
     */
    async renameAssociatedFiles(oldBaseName, newBaseName) {
        const filesToRename = [
            {
                old: path.join(this.thumbnailsDir, `${oldBaseName}.jpg`),
                new: path.join(this.thumbnailsDir, `${newBaseName}.jpg`)
            },
            {
                old: path.join(this.processedDir, `${oldBaseName}.vtt`),
                new: path.join(this.processedDir, `${newBaseName}.vtt`)
            },
            {
                old: path.join(this.processedDir, `${oldBaseName}.png`),
                new: path.join(this.processedDir, `${newBaseName}.png`)
            }
        ];

        for (const file of filesToRename) {
            try {
                await fs.access(file.old);
                await fs.rename(file.old, file.new);
                console.log(`Renamed ${path.basename(file.old)} to ${path.basename(file.new)}`);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.warn(`Warning: Could not rename ${file.old}:`, error.message);
                }
            }
        }
    }

    /**
     * Delete video and all associated files
     */
    async deleteVideo(videoId) {
        const video = await this.findVideoById(videoId);
        if (!video) {
            throw new Error('Video not found');
        }

        const videoFile = await this.findVideoFile(video.title);
        if (!videoFile) {
            throw new Error('Video file not found on disk');
        }

        const videoPath = path.join(this.videosDir, videoFile);
        
        try {
            // Delete video file
            await fs.unlink(videoPath);

            // Delete associated files
            await this.deleteAssociatedFiles(video.title);

            // Clear caches
            cache.invalidatePattern('videoMetadata', `video:${video.title}`);
            cache.clear('videoMetadata');

            return {
                success: true,
                title: video.title,
                message: `Video "${video.title}" and associated files deleted successfully`
            };
        } catch (error) {
            console.error(`Failed to delete video ${video.title}:`, error);
            throw new Error(`Failed to delete video: ${error.message}`);
        }
    }

    /**
     * Delete associated files (thumbnail, sprite, VTT)
     */
    async deleteAssociatedFiles(baseName) {
        const filesToDelete = [
            path.join(this.thumbnailsDir, `${baseName}.jpg`),
            path.join(this.processedDir, `${baseName}.vtt`),
            path.join(this.processedDir, `${baseName}.png`)
        ];

        for (const filePath of filesToDelete) {
            try {
                await fs.access(filePath);
                await fs.unlink(filePath);
                console.log(`Deleted ${path.basename(filePath)}`);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.warn(`Warning: Could not delete ${filePath}:`, error.message);
                }
            }
        }
    }

    /**
     * Generate sprite sheet for video
     */
    async generateSprite(videoId, options = {}) {
        const video = await this.findVideoById(videoId);
        if (!video) {
            throw new Error('Video not found');
        }

        const videoFile = await this.findVideoFile(video.title);
        if (!videoFile) {
            throw new Error('Video file not found on disk');
        }

        const videoPath = path.join(this.videosDir, videoFile);
        
        try {
            // Ensure processed directory exists
            await fs.mkdir(this.processedDir, { recursive: true });

            // Execute Python script for sprite generation
            const pythonScriptPath = path.join(__dirname, '../scripts/spritepreview.py');
            console.log(`Generating sprite sheet for: ${video.title}`);
            
            await new Promise((resolve, reject) => {
                const child = spawn('python3', [pythonScriptPath, videoPath], {
                    stdio: ['ignore', 'pipe', 'pipe']
                });

                let stdout = '';
                let stderr = '';

                child.stdout.on('data', (data) => {
                    stdout += data;
                    process.stdout.write(data);
                });

                child.stderr.on('data', (data) => {
                    stderr += data;
                    process.stderr.write(data);
                });

                child.on('error', (error) => {
                    reject(new Error(`Failed to start sprite generation: ${error.message}`));
                });

                child.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Sprite generation failed with code ${code}\nOutput: ${stderr}`));
                    }
                });
            });

            // Verify files were created
            const baseName = path.parse(videoFile).name;
            const spritePath = path.join(this.processedDir, `${baseName}.png`);
            const vttPath = path.join(this.processedDir, `${baseName}.vtt`);

            await fs.access(spritePath);
            await fs.access(vttPath);

            // Clear relevant caches
            cache.del('videoMetadata', `video:${video.filename}`);
            cache.clear('videoMetadata');

            return {
                success: true,
                spritePath: `/processed/${baseName}.png`,
                vttPath: `/processed/${baseName}.vtt`,
                message: `Sprite and VTT generated successfully for ${video.title}`
            };
        } catch (error) {
            console.error(`Failed to generate sprite for ${video.title}:`, error);
            throw new Error(`Failed to generate sprite: ${error.message}`);
        }
    }

    /**
     * Get video statistics
     */
    async getStats() {
        const cacheKey = 'video:stats';
        const cached = cache.get('videoMetadata', cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const videos = await this.scanVideoFiles();
            const totalSize = videos.reduce((sum, video) => {
                return sum + parseFloat(video.size.replace(' MB', ''));
            }, 0);

            const thumbnailFiles = await fs.readdir(this.thumbnailsDir).catch(() => []);
            const processedFiles = await fs.readdir(this.processedDir).catch(() => []);
            
            const vttFiles = processedFiles.filter(file => file.endsWith('.vtt'));
            const spriteFiles = processedFiles.filter(file => file.endsWith('.png'));

            const stats = {
                videos: {
                    total: videos.length,
                    totalSize: `${totalSize.toFixed(1)} MB`,
                    averageSize: videos.length > 0 ? `${(totalSize / videos.length).toFixed(1)} MB` : '0 MB'
                },
                thumbnails: {
                    total: thumbnailFiles.length,
                    coverage: videos.length > 0 ? Math.round((thumbnailFiles.length / videos.length) * 100) : 0
                },
                sprites: {
                    total: vttFiles.length,
                    coverage: videos.length > 0 ? Math.round((vttFiles.length / videos.length) * 100) : 0
                },
                directories: {
                    videos: this.videosDir,
                    thumbnails: this.thumbnailsDir,
                    processed: this.processedDir
                },
                cache: cache.getStats()
            };

            cache.set('videoMetadata', cacheKey, stats, 300); // 5 minutes
            return stats;
        } catch (error) {
            console.error('Error getting video stats:', error);
            throw new Error(`Failed to get statistics: ${error.message}`);
        }
    }

    /**
     * Cleanup orphaned files
     */
    async cleanup() {
        const videos = await this.scanVideoFiles();
        const videoTitles = new Set(videos.map(v => v.title));
        
        let deletedFiles = 0;

        // Cleanup orphaned thumbnails
        try {
            const thumbnailFiles = await fs.readdir(this.thumbnailsDir);
            for (const file of thumbnailFiles) {
                const baseName = path.parse(file).name;
                if (!videoTitles.has(baseName)) {
                    await fs.unlink(path.join(this.thumbnailsDir, file));
                    deletedFiles++;
                    console.log(`Deleted orphaned thumbnail: ${file}`);
                }
            }
        } catch (error) {
            console.warn('Error cleaning up thumbnails:', error.message);
        }

        // Cleanup orphaned processed files
        try {
            const processedFiles = await fs.readdir(this.processedDir);
            for (const file of processedFiles) {
                const baseName = path.parse(file).name;
                if (!videoTitles.has(baseName)) {
                    await fs.unlink(path.join(this.processedDir, file));
                    deletedFiles++;
                    console.log(`Deleted orphaned processed file: ${file}`);
                }
            }
        } catch (error) {
            console.warn('Error cleaning up processed files:', error.message);
        }

        // Clear caches after cleanup
        cache.clear('videoMetadata');

        return {
            success: true,
            deletedFiles,
            message: `Cleanup completed. Deleted ${deletedFiles} orphaned files.`
        };
    }
}

module.exports = VideoService;
