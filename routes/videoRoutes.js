const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');
const { ValidationMiddleware, schemas } = require('../middleware/validation');

// Get all videos with pagination, search, and sorting
router.get('/videos', 
    ValidationMiddleware.validateQuery(schemas.videoQuery),
    videoController.getAllVideos
);

// Get system and video statistics
router.get('/stats', videoController.getStats);

// Refresh a specific video's thumbnail
router.post('/refresh-thumbnail/:id',
    ValidationMiddleware.validateParams(schemas.videoId),
    videoController.refreshThumbnail
);

// Generate sprite and VTT for a specific video
router.post('/generate-sprite/:id',
    ValidationMiddleware.validateParams(schemas.videoId),
    videoController.generateSprite
);

// Rename a video and all its related files
router.post('/rename-video/:id',
    ValidationMiddleware.validateParams(schemas.videoId),
    ValidationMiddleware.validateBody(schemas.renameVideo),
    videoController.renameVideo
);

// Delete a video and all its related files
router.delete('/delete-video/:id',
    ValidationMiddleware.validateParams(schemas.videoId),
    videoController.deleteVideo
);

// Cleanup orphaned files
router.post('/cleanup', videoController.cleanup);

// Health check endpoint (moved from /health to /api/health for consistency)
router.get('/health', videoController.healthCheck);

module.exports = router; 