const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');

// API to get video metadata
router.get('/videos', videoController.getAllVideos);

// Refresh a specific video's thumbnail
router.post('/refresh-thumbnail/:id', videoController.refreshThumbnail);

// Generate sprite and VTT for a specific video
router.post('/generate-sprite/:id', videoController.generateSprite);

// Rename a video and all its related files
router.post('/rename-video/:id', videoController.renameVideo);

// Delete a video and all its related files
router.delete('/delete-video/:id', videoController.deleteVideo);

module.exports = router; 