require('./logger');

// Legacy wrapper for backward compatibility
// This module now delegates to the new ThumbnailService

const ThumbnailService = require('../services/thumbnailService');

const thumbnailService = new ThumbnailService();

/**
 * Legacy function - now uses ThumbnailService
 * @deprecated Use ThumbnailService directly
 */
async function ensureThumbnails() {
    console.warn('ensureThumbnails() is deprecated. Use ThumbnailService.ensureThumbnails() instead.');
    const result = await thumbnailService.ensureThumbnails();
    return result;
}

/**
 * Legacy function - now uses ThumbnailService  
 * @deprecated Use ThumbnailService directly
 */
async function generateThumbnail(videoPath, thumbnailPath, options = {}) {
    console.warn('generateThumbnail() is deprecated. Use ThumbnailService.generateThumbnail() instead.');
    return await thumbnailService.generateThumbnail(videoPath, thumbnailPath, options);
}

module.exports = { 
    ensureThumbnails, 
    generateThumbnail,
    ThumbnailService // Export the new service
}; 