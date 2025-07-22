const configManager = require('../utils/configManager');

/**
 * Centralized error handling middleware
 * Provides consistent error responses and logging
 */

/**
 * Error handler middleware - must be last middleware
 */
const errorHandler = (err, req, res, next) => {
    console.error('Unhandled error:', err);
    
    // Default error response
    let statusCode = 500;
    let message = 'Internal server error';
    let details = {};

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation failed';
        details = err.details || {};
    } else if (err.name === 'CastError' || err.name === 'TypeError') {
        statusCode = 400;
        message = 'Invalid request format';
    } else if (err.code === 'ENOENT') {
        statusCode = 404;
        message = 'Resource not found';
    } else if (err.code === 'EACCES' || err.code === 'EPERM') {
        statusCode = 403;
        message = 'Access denied';
    } else if (err.code === 'EEXIST') {
        statusCode = 409;
        message = 'Resource already exists';
    } else if (err.message && err.message.includes('ENOSPC')) {
        statusCode = 507;
        message = 'Insufficient storage space';
    } else if (err.status || err.statusCode) {
        statusCode = err.status || err.statusCode;
        message = err.message || message;
    }

    // Don't expose internal errors in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorResponse = {
        error: message,
        status: statusCode,
        ...(Object.keys(details).length > 0 && { details }),
        ...(isDevelopment && { 
            stack: err.stack,
            raw: err.message 
        })
    };

    // Log structured error information
    console.errorStructured('Request error', {
        statusCode,
        message,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        ...(isDevelopment && { stack: err.stack })
    });

    res.status(statusCode).json(errorResponse);
};

/**
 * 404 handler for unmatched routes
 */
const notFoundHandler = (req, res, next) => {
    const message = `Route ${req.originalUrl} not found`;
    
    console.warnStructured('Route not found', {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    
    res.status(404).json({
        error: message,
        status: 404,
        availableRoutes: [
            'GET /api/videos',
            'GET /api/stats',
            'POST /api/refresh-thumbnail/:id',
            'POST /api/generate-sprite/:id',
            'POST /api/rename-video/:id',
            'DELETE /api/delete-video/:id',
            'POST /api/cleanup',
            'GET /health'
        ]
    });
};

/**
 * Async error wrapper
 * Catches async errors and passes them to error handler
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Request timeout middleware
 */
const timeoutHandler = (timeout = 30000) => {
    return (req, res, next) => {
        req.setTimeout(timeout, () => {
            const error = new Error('Request timeout');
            error.status = 408;
            next(error);
        });
        next();
    };
};

/**
 * Rate limit error handler
 */
const rateLimitHandler = (req, res) => {
    console.warnStructured('Rate limit exceeded', {
        ip: req.ip,
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('user-agent')
    });

    res.status(429).json({
        error: 'Too many requests',
        status: 429,
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.round(req.rateLimit.resetTime / 1000)
    });
};

/**
 * Security error handler for helmet violations
 */
const securityErrorHandler = (err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({
            error: 'Invalid CSRF token',
            status: 403
        });
    }
    next(err);
};

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler,
    timeoutHandler,
    rateLimitHandler,
    securityErrorHandler
};
