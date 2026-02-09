/**
 * Centralized Logger with Winston
 * Replaces scattered console.log/warn/error calls throughout the app
 *
 * Usage:
 *   const logger = require('./utils/logger');
 *   logger.info('User logged in', { userId: 123 });
 *   logger.error('Database error', { error: err, context: 'payment' });
 */

const winston = require('winston');
const path = require('path');
const { app } = require('electron');

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};

// Define colors for console output
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue'
};

winston.addColors(colors);

// Custom format for console output
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
        let msg = `${timestamp} [${level}]: ${message}`;

        // Add metadata if present
        if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
        }

        return msg;
    })
);

// Custom format for file output (JSON for easier parsing)
const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Create logs directory path
const getLogsPath = () => {
    try {
        return path.join(app.getPath('userData'), 'logs');
    } catch (e) {
        // Fallback for tests or non-Electron environments
        return path.join(__dirname, '../../../logs');
    }
};

// Create transports array
const transports = [
    // Console transport (for development)
    new winston.transports.Console({
        format: consoleFormat,
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    }),

    // Error log file
    new winston.transports.File({
        filename: path.join(getLogsPath(), 'error.log'),
        level: 'error',
        format: fileFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5
    }),

    // Combined log file
    new winston.transports.File({
        filename: path.join(getLogsPath(), 'combined.log'),
        format: fileFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5
    })
];

// Create the logger
const logger = winston.createLogger({
    levels,
    transports,
    exitOnError: false
});

// Add helper methods for common logging patterns
logger.logError = (message, error, context = {}) => {
    logger.error(message, {
        error: error?.message || error,
        stack: error?.stack,
        ...context
    });
};

logger.logDebug = (message, context = {}) => {
    logger.debug(message, context);
};

logger.logInfo = (message, context = {}) => {
    logger.info(message, context);
};

logger.logWarn = (message, context = {}) => {
    logger.warn(message, context);
};

// Export both default logger and a function to create child loggers
module.exports = logger;

// Create child logger for specific modules
module.exports.createModuleLogger = (moduleName) => {
    return logger.child({ module: moduleName });
};
