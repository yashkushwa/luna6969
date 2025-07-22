const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const configManager = require('../utils/configManager');
const { rateLimitHandler } = require('./errorHandler');

/**
 * Security middleware configuration
 */
class SecurityMiddleware {
    /**
     * Configure rate limiting
     */
    static createRateLimit() {
        const config = configManager.getValue('security.rateLimit') || {};
        
        return rateLimit({
            windowMs: config.windowMs || 15 * 60 * 1000, // 15 minutes
            max: config.max || 100, // limit each IP to 100 requests per windowMs
            message: rateLimitHandler,
            standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
            legacyHeaders: false, // Disable the `X-RateLimit-*` headers
            skip: (req) => {
                // Skip rate limiting for health checks
                return req.path === '/health';
            },
            keyGenerator: (req) => {
                // Use IP address as key
                return req.ip;
            }
        });
    }

    /**
     * Configure CORS
     */
    static createCORS() {
        const config = configManager.getValue('security.cors') || {};
        
        return cors({
            origin: config.origin || true,
            credentials: config.credentials || true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
            exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
            maxAge: 86400 // 24 hours
        });
    }

    /**
     * Configure Helmet security headers
     */
    static createHelmet() {
        return helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: [
                        "'self'", 
                        "'unsafe-inline'",
                        'https://fonts.googleapis.com',
                        'https://cdn.plyr.io'
                    ],
                    scriptSrc: [
                        "'self'",
                        "'unsafe-inline'", // Needed for inline scripts
                        'https://cdn.plyr.io'
                    ],
                    fontSrc: [
                        "'self'",
                        'https://fonts.gstatic.com'
                    ],
                    imgSrc: ["'self'", 'data:', 'blob:'],
                    mediaSrc: ["'self'", 'blob:'],
                    connectSrc: ["'self'"],
                    objectSrc: ["'none'"],
                    upgradeInsecureRequests: []
                }
            },
            crossOriginEmbedderPolicy: false, // Disable for video embedding
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            }
        });
    }

    /**
     * Path traversal protection
     */
    static pathTraversalProtection() {
        return (req, res, next) => {
            const suspiciousPatterns = [
                /\.\.\//,  // Directory traversal
                /\.\.\\/,  // Directory traversal (Windows)
                /\0/,      // Null bytes
                /%00/,     // URL encoded null bytes
                /%2e%2e/i, // URL encoded dots
                /%2f/i,    // URL encoded slash
                /%5c/i     // URL encoded backslash
            ];

            const checkPath = (pathString) => {
                return suspiciousPatterns.some(pattern => pattern.test(pathString));
            };

            // Check URL path
            if (checkPath(req.path)) {
                return res.status(400).json({
                    error: 'Invalid path',
                    status: 400
                });
            }

            // Check query parameters
            for (const [key, value] of Object.entries(req.query)) {
                if (typeof value === 'string' && checkPath(value)) {
                    return res.status(400).json({
                        error: 'Invalid query parameter',
                        status: 400
                    });
                }
            }

            // Check route parameters
            for (const [key, value] of Object.entries(req.params)) {
                if (typeof value === 'string' && checkPath(value)) {
                    return res.status(400).json({
                        error: 'Invalid route parameter',
                        status: 400
                    });
                }
            }

            next();
        };
    }

    /**
     * File upload validation
     */
    static fileUploadValidation(allowedExtensions = ['.mp4', '.webm', '.mov', '.mkv']) {
        return (req, res, next) => {
            if (req.file) {
                const ext = path.extname(req.file.originalname).toLowerCase();
                if (!allowedExtensions.includes(ext)) {
                    return res.status(400).json({
                        error: 'Invalid file type',
                        status: 400,
                        allowedTypes: allowedExtensions
                    });
                }

                // Check file size (limit to 5GB)
                const maxSize = 5 * 1024 * 1024 * 1024; // 5GB
                if (req.file.size > maxSize) {
                    return res.status(400).json({
                        error: 'File too large',
                        status: 400,
                        maxSize: '5GB'
                    });
                }
            }

            next();
        };
    }

    /**
     * Request size limiting
     */
    static requestSizeLimit() {
        return (req, res, next) => {
            const contentLength = req.get('content-length');
            const maxSize = 100 * 1024 * 1024; // 100MB for regular requests
            
            if (contentLength && parseInt(contentLength) > maxSize) {
                return res.status(413).json({
                    error: 'Request too large',
                    status: 413,
                    maxSize: '100MB'
                });
            }
            
            next();
        };
    }

    /**
     * IP whitelist/blacklist
     */
    static createIPFilter(whitelist = [], blacklist = []) {
        return (req, res, next) => {
            const clientIP = req.ip;
            
            // Check blacklist first
            if (blacklist.length > 0 && blacklist.includes(clientIP)) {
                console.warnStructured('Blocked IP attempted access', {
                    ip: clientIP,
                    method: req.method,
                    url: req.originalUrl
                });
                
                return res.status(403).json({
                    error: 'Access denied',
                    status: 403
                });
            }
            
            // Check whitelist if configured
            if (whitelist.length > 0 && !whitelist.includes(clientIP)) {
                console.warnStructured('Non-whitelisted IP attempted access', {
                    ip: clientIP,
                    method: req.method,
                    url: req.originalUrl
                });
                
                return res.status(403).json({
                    error: 'Access denied',
                    status: 403
                });
            }
            
            next();
        };
    }
}

module.exports = SecurityMiddleware;
