const util = require('util');
const fs = require('fs');
const path = require('path');

/**
 * Enhanced logging system with levels, file output, and structured logging
 */
class Logger {
    constructor() {
        this.levels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        };

        this.colors = {
            ERROR: '\x1b[31m',  // red
            WARN: '\x1b[33m',   // yellow
            INFO: '\x1b[32m',   // green
            DEBUG: '\x1b[36m',  // cyan
            RESET: '\x1b[0m'
        };

        this.logLevel = this.levels[process.env.LOG_LEVEL] || this.levels.INFO;
        this.logToFile = process.env.LOG_TO_FILE === 'true';
        this.logFile = process.env.LOG_FILE || path.join(__dirname, '../logs/app.log');
        
        // Ensure log directory exists if logging to file
        if (this.logToFile) {
            const logDir = path.dirname(this.logFile);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
        }

        this.patchConsole();
    }

    /**
     * Format log message with timestamp, level, and colors
     */
    formatMessage(level, args) {
        const timestamp = new Date().toISOString();
        const message = util.format(...args);
        const colorCode = this.colors[level] || this.colors.INFO;
        const resetCode = this.colors.RESET;
        
        return {
            colored: `${colorCode}[${timestamp}] ${level.padEnd(5)}:${resetCode} ${message}`,
            plain: `[${timestamp}] ${level.padEnd(5)}: ${message}`
        };
    }

    /**
     * Log message if level is appropriate
     */
    log(level, ...args) {
        const levelValue = this.levels[level];
        if (levelValue > this.logLevel) {
            return;
        }

        const formatted = this.formatMessage(level, args);
        
        // Output to console
        if (level === 'ERROR') {
            process.stderr.write(formatted.colored + '\n');
        } else {
            process.stdout.write(formatted.colored + '\n');
        }

        // Output to file if enabled
        if (this.logToFile) {
            try {
                fs.appendFileSync(this.logFile, formatted.plain + '\n');
            } catch (error) {
                // Fallback to console if file logging fails
                process.stderr.write(`[${new Date().toISOString()}] ERROR: Failed to write to log file: ${error.message}\n`);
            }
        }
    }

    /**
     * Log with structured data
     */
    logStructured(level, message, data = {}) {
        const timestamp = new Date().toISOString();
        const structuredLog = {
            timestamp,
            level,
            message,
            ...data
        };

        if (this.logToFile) {
            try {
                fs.appendFileSync(this.logFile, JSON.stringify(structuredLog) + '\n');
            } catch (error) {
                // Fallback to console
                this.log('ERROR', `Failed to write structured log: ${error.message}`);
            }
        }

        // Also log to console in readable format
        const extras = Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : '';
        this.log(level, message + extras);
    }

    /**
     * Patch global console methods
     */
    patchConsole() {
        const originalConsole = { ...console };

        console.error = (...args) => this.log('ERROR', ...args);
        console.warn = (...args) => this.log('WARN', ...args);
        console.info = (...args) => this.log('INFO', ...args);
        console.log = (...args) => this.log('INFO', ...args);
        console.debug = (...args) => this.log('DEBUG', ...args);

        // Add structured logging methods
        console.logStructured = (level, message, data) => this.logStructured(level, message, data);
        console.errorStructured = (message, data) => this.logStructured('ERROR', message, data);
        console.warnStructured = (message, data) => this.logStructured('WARN', message, data);
        console.infoStructured = (message, data) => this.logStructured('INFO', message, data);
        console.debugStructured = (message, data) => this.logStructured('DEBUG', message, data);

        // Keep reference to original methods
        console.originalError = originalConsole.error;
        console.originalWarn = originalConsole.warn;
        console.originalInfo = originalConsole.info;
        console.originalLog = originalConsole.log;
        console.originalDebug = originalConsole.debug;
    }

    /**
     * Create HTTP request logger middleware
     */
    createHttpLogger() {
        return (req, res, next) => {
            const start = Date.now();
            const userAgent = req.get('user-agent') || '';
            const ip = req.ip || req.connection.remoteAddress || 'unknown';

            res.on('finish', () => {
                const duration = Date.now() - start;
                const statusColor = res.statusCode >= 400 ? 'ERROR' : 'INFO';
                
                this.logStructured(statusColor, 'HTTP Request', {
                    method: req.method,
                    url: req.originalUrl,
                    status: res.statusCode,
                    duration: `${duration}ms`,
                    ip,
                    userAgent: userAgent.substring(0, 100) // Limit user agent length
                });
            });

            next();
        };
    }
}

// Initialize and export singleton
const logger = new Logger();
module.exports = logger;
