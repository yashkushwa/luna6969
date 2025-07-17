// Simple console logger with timestamp and colorization
// This patches the global console methods so any module that uses console.log/error etc.
// will automatically get nicely formatted, colorized, timestamped output.

const util = require('util');

// ANSI color codes
const COLORS = {
    reset: '\x1b[0m',
    info: '\x1b[32m',   // green
    warn: '\x1b[33m',   // yellow
    error: '\x1b[31m',  // red
    debug: '\x1b[36m'   // cyan
};

function format(level, colorCode, args) {
    const timestamp = new Date().toISOString();
    const message = util.format(...args); // util.format preserves printf-style substitutions
    return `${colorCode}[${timestamp}] ${level.toUpperCase()}:${COLORS.reset} ${message}`;
}

// Patch console methods
console.info = (...args) => process.stdout.write(format('info', COLORS.info, args) + '\n');
console.log  = console.info;

console.warn = (...args) => process.stdout.write(format('warn', COLORS.warn, args) + '\n');

console.error = (...args) => process.stderr.write(format('error', COLORS.error, args) + '\n');

console.debug = (...args) => process.stdout.write(format('debug', COLORS.debug, args) + '\n');

module.exports = console;
