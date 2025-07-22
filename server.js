/**
 * Luna6969 Video Server v2.0
 * Advanced video management and streaming server
 * 
 * Features:
 * - Modern Express.js architecture with service layer pattern
 * - Advanced caching system with multi-tier TTL management
 * - Comprehensive security middleware (CORS, rate limiting, Helmet)
 * - Input validation and sanitization
 * - Pagination and search functionality
 * - Health monitoring and statistics
 * - Hot-reload configuration management
 * - Structured logging with file output
 * - Performance optimizations with compression
 */

// Initialize enhanced logging system first
require('./utils/logger');

const express = require('express');
const path = require('path');
const compression = require('compression');

// Import configuration and utilities
const configManager = require('./utils/configManager');
const cache = require('./utils/cache');

// Import middleware
const SecurityMiddleware = require('./middleware/security');
const { 
    errorHandler, 
    notFoundHandler, 
    timeoutHandler 
} = require('./middleware/errorHandler');

// Import routes
const videoRoutes = require('./routes/videoRoutes');

/**
 * Application initialization
 */
class VideoServer {
    constructor() {
        this.app = express();
        this.config = configManager.get();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    /**
     * Setup middleware stack
     */
    setupMiddleware() {
        console.log('Setting up middleware stack...');

        // Security middleware
        this.app.use(SecurityMiddleware.createHelmet());
        this.app.use(SecurityMiddleware.createCORS());
        this.app.use(SecurityMiddleware.createRateLimit());
        this.app.use(SecurityMiddleware.pathTraversalProtection());
        this.app.use(SecurityMiddleware.requestSizeLimit());

        // Performance middleware
        this.app.use(compression({
            filter: (req, res) => {
                if (req.headers['x-no-compression']) {
                    return false;
                }
                return compression.filter(req, res);
            },
            level: 6,
            threshold: 1024
        }));

        // Request parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Request timeout
        this.app.use(timeoutHandler(30000)); // 30 second timeout

        // HTTP request logging
        const logger = require('./utils/logger');
        this.app.use(logger.createHttpLogger());

        // Trust proxy for rate limiting and IP detection
        this.app.set('trust proxy', true);
    }

    /**
     * Setup routes
     */
    setupRoutes() {
        console.log('Setting up routes...');

        // Static file serving with cache headers
        const staticOptions = {
            maxAge: '1d', // 1 day cache
            etag: true,
            lastModified: true,
            setHeaders: (res, filePath) => {
                // Set cache headers based on file type
                if (filePath.endsWith('.mp4') || filePath.endsWith('.webm') || filePath.endsWith('.mov')) {
                    res.set('Cache-Control', 'public, max-age=86400'); // 1 day for videos
                } else if (filePath.endsWith('.jpg') || filePath.endsWith('.png')) {
                    res.set('Cache-Control', 'public, max-age=3600'); // 1 hour for images
                } else {
                    res.set('Cache-Control', 'public, max-age=300'); // 5 minutes for other files
                }
            }
        };

        // Serve media directories
        this.app.use('/videos', express.static(this.config.directories.videos, staticOptions));
        this.app.use('/thumbnails', express.static(this.config.directories.thumbnails, staticOptions));
        this.app.use('/processed', express.static(this.config.directories.processed, staticOptions));

        // Serve frontend with cache headers
        this.app.use(express.static(path.join(__dirname, 'public'), {
            maxAge: '1h',
            etag: true,
            lastModified: true
        }));

        // API routes
        this.app.use('/api', videoRoutes);

        // Health check endpoint (also available at root level)
        this.app.get('/health', require('./controllers/videoController').healthCheck);

        // Root endpoint redirect
        this.app.get('/api', (req, res) => {
            res.json({
                name: 'Luna6969 Video Server',
                version: '2.0.0',
                description: 'Advanced video management and streaming server',
                documentation: '/api/health',
                endpoints: {
                    videos: 'GET /api/videos',
                    stats: 'GET /api/stats',
                    health: 'GET /api/health',
                    actions: {
                        refreshThumbnail: 'POST /api/refresh-thumbnail/:id',
                        generateSprite: 'POST /api/generate-sprite/:id',
                        renameVideo: 'POST /api/rename-video/:id',
                        deleteVideo: 'DELETE /api/delete-video/:id',
                        cleanup: 'POST /api/cleanup'
                    }
                }
            });
        });
    }

    /**
     * Setup error handling
     */
    setupErrorHandling() {
        console.log('Setting up error handling...');

        // 404 handler for unmatched routes
        this.app.use(notFoundHandler);

        // Global error handler (must be last)
        this.app.use(errorHandler);

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            this.gracefulShutdown('UNCAUGHT_EXCEPTION');
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            this.gracefulShutdown('UNHANDLED_REJECTION');
        });

        // Handle process termination signals
        ['SIGTERM', 'SIGINT'].forEach((signal) => {
            process.on(signal, () => {
                console.log(`Received ${signal}, starting graceful shutdown...`);
                this.gracefulShutdown(signal);
            });
        });
    }

    /**
     * Start the server
     */
    start() {
        const PORT = this.config.server.port;
        const HOST = this.config.server.host || '0.0.0.0';

        this.server = this.app.listen(PORT, HOST, () => {
            console.log('='.repeat(80));
            console.log('🚀 Luna6969 Video Server v2.0 Started Successfully!');
            console.log('='.repeat(80));
            console.log(`📡 Server URL: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
            console.log(`🎬 Videos: ${this.config.directories.videos}`);
            console.log(`📸 Thumbnails: ${this.config.directories.thumbnails}`);
            console.log(`🎞️  Processed: ${this.config.directories.processed}`);
            console.log(`💾 Cache: ${Object.keys(cache.caches).join(', ')}`);
            console.log(`🛡️  Security: CORS, Rate Limiting, Helmet enabled`);
            console.log(`📊 Monitoring: /health, /api/stats`);
            console.log('='.repeat(80));
            console.log('Server is ready to handle requests! 🎉');
        });

        return this.server;
    }

    /**
     * Graceful shutdown
     */
    gracefulShutdown(signal) {
        console.log(`Initiating graceful shutdown due to ${signal}...`);

        if (this.server) {
            this.server.close(() => {
                console.log('HTTP server closed.');
                
                // Cleanup resources
                cache.clearAll();
                configManager.destroy();
                
                console.log('Graceful shutdown completed.');
                process.exit(0);
            });

            // Force close after 10 seconds
            setTimeout(() => {
                console.error('Could not close connections in time, forcefully shutting down');
                process.exit(1);
            }, 10000);
        } else {
            process.exit(0);
        }
    }
}

// Start the application
if (require.main === module) {
    const server = new VideoServer();
    server.start();
}

module.exports = VideoServer; 