const asyncHandler = require('express-async-handler');
const VideoService = require('../services/videoService');
const ThumbnailService = require('../services/thumbnailService');

// Initialize services
const videoService = new VideoService();
const thumbnailService = new ThumbnailService();

/**
 * Get all videos with pagination, search, and sorting
 */
exports.getAllVideos = asyncHandler(async (req, res) => {
    const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        search: req.query.search || '',
        sort: req.query.sort || 'title',
        order: req.query.order || 'asc'
    };

    // Ensure thumbnails are generated
    await thumbnailService.ensureThumbnails();
    
    const result = await videoService.getAllVideos(options);
    
    // Set pagination headers
    res.set({
        'X-Total-Count': result.pagination.total,
        'X-Page-Count': result.pagination.pages,
        'X-Current-Page': result.pagination.page,
        'X-Per-Page': result.pagination.limit
    });

    res.json(result);
});

/**
 * Refresh thumbnail for a specific video
 */
exports.refreshThumbnail = asyncHandler(async (req, res) => {
    const videoId = parseInt(req.params.id);
    
    const video = await videoService.findVideoById(videoId);
    if (!video) {
        return res.status(404).json({ 
            error: 'Video not found',
            status: 404 
        });
    }

    const result = await thumbnailService.refreshThumbnail(video.title);
    
    res.json({
        success: result.success,
        thumbnailUrl: result.thumbnailUrl,
        message: result.message,
        video: {
            id: videoId,
            title: video.title
        }
    });
});

/**
 * Generate sprite sheet and VTT file for video seek previews
 */
exports.generateSprite = asyncHandler(async (req, res) => {
    const videoId = parseInt(req.params.id);
    const options = req.body || {}; // Allow customization of sprite parameters
    
    const video = await videoService.findVideoById(videoId);
    if (!video) {
        return res.status(404).json({ 
            error: 'Video not found',
            status: 404 
        });
    }

    console.log(`Starting sprite generation for video: ${video.title}`);
    
    const result = await videoService.generateSprite(videoId, options);
    
    res.json({
        success: result.success,
        spritePath: result.spritePath,
        vttPath: result.vttPath,
        message: result.message,
        video: {
            id: videoId,
            title: video.title
        }
    });
});

/**
 * Rename video and all associated files
 */
exports.renameVideo = asyncHandler(async (req, res) => {
    const videoId = parseInt(req.params.id);
    const { newName } = req.body;
    
    if (!newName || newName.trim() === '') {
        return res.status(400).json({ 
            error: 'New name is required',
            status: 400 
        });
    }
    
    const result = await videoService.renameVideo(videoId, newName);
    
    res.json({
        success: result.success,
        oldName: result.oldName,
        newName: result.newName,
        message: result.message
    });
});

/**
 * Delete video and all associated files
 */
exports.deleteVideo = asyncHandler(async (req, res) => {
    const videoId = parseInt(req.params.id);
    
    const result = await videoService.deleteVideo(videoId);
    
    res.json({
        success: result.success,
        title: result.title,
        message: result.message
    });
});

/**
 * Get video and system statistics
 */
exports.getStats = asyncHandler(async (req, res) => {
    const stats = await videoService.getStats();
    res.json(stats);
});

/**
 * Cleanup orphaned files
 */
exports.cleanup = asyncHandler(async (req, res) => {
    const videoResult = await videoService.cleanup();
    const thumbnailResult = await thumbnailService.cleanup();
    
    res.json({
        success: true,
        video: videoResult,
        thumbnail: thumbnailResult,
        message: `Cleanup completed. Total deleted files: ${videoResult.deletedFiles + thumbnailResult.deletedCount}`
    });
});

/**
 * Health check endpoint
 */
exports.healthCheck = asyncHandler(async (req, res) => {
    const configManager = require('../utils/configManager');
    const cache = require('../utils/cache');
    
    const config = configManager.get();
    const cacheStats = cache.getStats();
    
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'development',
        directories: {
            videos: config.directories.videos,
            thumbnails: config.directories.thumbnails,
            processed: config.directories.processed
        },
        cache: cacheStats,
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
        },
        uptime: Math.round(process.uptime()) + 's'
    });
}); 