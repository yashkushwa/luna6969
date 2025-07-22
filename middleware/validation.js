const Joi = require('joi');
const asyncHandler = require('express-async-handler');

/**
 * Validation middleware using Joi schemas
 */
class ValidationMiddleware {
    /**
     * Create validation middleware for request parameters
     */
    static validateParams(schema) {
        return asyncHandler(async (req, res, next) => {
            const { error, value } = schema.validate(req.params);
            
            if (error) {
                return res.status(400).json({
                    error: 'Invalid request parameters',
                    details: error.details.map(detail => ({
                        field: detail.path.join('.'),
                        message: detail.message
                    }))
                });
            }
            
            req.params = value;
            next();
        });
    }

    /**
     * Create validation middleware for request body
     */
    static validateBody(schema) {
        return asyncHandler(async (req, res, next) => {
            const { error, value } = schema.validate(req.body);
            
            if (error) {
                return res.status(400).json({
                    error: 'Invalid request body',
                    details: error.details.map(detail => ({
                        field: detail.path.join('.'),
                        message: detail.message
                    }))
                });
            }
            
            req.body = value;
            next();
        });
    }

    /**
     * Create validation middleware for query parameters
     */
    static validateQuery(schema) {
        return asyncHandler(async (req, res, next) => {
            const { error, value } = schema.validate(req.query);
            
            if (error) {
                return res.status(400).json({
                    error: 'Invalid query parameters',
                    details: error.details.map(detail => ({
                        field: detail.path.join('.'),
                        message: detail.message
                    }))
                });
            }
            
            req.query = value;
            next();
        });
    }
}

/**
 * Common validation schemas
 */
const schemas = {
    // Video ID parameter validation
    videoId: Joi.object({
        id: Joi.number().integer().positive().required()
    }),

    // Video rename body validation
    renameVideo: Joi.object({
        newName: Joi.string()
            .trim()
            .min(1)
            .max(255)
            .pattern(/^[^\\/:*?"<>|]+$/)
            .required()
            .messages({
                'string.pattern.base': 'Video name contains invalid characters. Avoid: \\ / : * ? " < > |'
            })
    }),

    // Video list query parameters
    videoQuery: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(20),
        search: Joi.string().trim().min(2).max(100).optional(),
        sort: Joi.string().valid('title', 'date', 'size', 'duration').default('title'),
        order: Joi.string().valid('asc', 'desc').default('asc')
    }),

    // Sprite generation parameters
    spriteParams: Joi.object({
        interval: Joi.number().integer().min(1).max(60).default(5),
        width: Joi.number().integer().min(100).max(1920).default(320),
        height: Joi.number().integer().min(100).max(1080).default(180)
    })
};

module.exports = {
    ValidationMiddleware,
    schemas
};
