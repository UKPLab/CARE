const winston = require('winston');
const Transport = require('winston-transport');

const logging_dir = process.env.LOGGING_PATH;

class SQLTransport extends Transport {
    constructor(opts) {
        super(opts);
        this.db = opts.db;
    }

    log(info, callback) {
        if (this.db) {
            this.db.models['log'].createLog(info).then(() => {
                setImmediate(() => {
                    this.emit('logged', info);
                });
                callback();
            });
        } else {
            callback();
        }
    }
}

/**
 * Custom Winston format to add caller information (file, line, column, function)
 * This helps identify where log messages originated from in the codebase
 */
function addCallerinfo() {
    return winston.format((info) => {
        const stack = new Error().stack;
        console.log("Stack trace:", stack);
        if (stack) {
            const stackLines = stack.split('\n');
            // Skip the first few lines which are internal winston/logger calls
            // Look for the first line that's not from winston internals or this logger file
            for (let i = 1; i < stackLines.length; i++) {
                const line = stackLines[i];
                if (line && 
                    !line.includes('winston') && 
                    !line.includes('logger.js') &&
                    !line.includes('node_modules') &&
                    line.includes('at ')) {
                    
                    // Parse the stack trace line
                    // Format: "    at functionName (file:line:column)" or "    at file:line:column"
                    const match = line.match(/at\s+(?:([^(]+)\s+\()?([^:]+):(\d+):(\d+)\)?/);
                    if (match) {
                        const [, functionName, filePath, lineNumber, columnNumber] = match;
                        
                        // Extract just the filename from the full path
                        const fileName = filePath ? filePath.split(/[/\\]/).pop() : 'unknown';
                        
                        info.caller = {
                            file: fileName,
                            line: parseInt(lineNumber, 10),
                            column: parseInt(columnNumber, 10),
                            function: functionName ? functionName.trim() : 'anonymous'
                        };
                        
                        // Add a formatted caller string for easy reading
                        info.callerInfo = `${fileName}:${lineNumber}:${columnNumber}${functionName ? ` (${functionName.trim()})` : ''}`;
                        break;
                    }
                }
            }
        }
        return info;
    })();
}

/**
 * This module logs everything into different formats
 * Use:
 * const logger = require("../utils/logger.js")("service");
 * logger.debug(), logger.info(), logger.error(), ...
 * More information: https://github.com/winstonjs/winston
 *
 * You can also put user information into the log:
 * const new_logger = logger.child({user: <uid_from_table_user>});
 * or logger.info(..., {user: <uid_from_table_user>});
 *
 * @author: Dennis Zyska
 *
 * @param {string} service - Name of the service
 * @param {object} db - Database connection
 * @return {object} - Logger
 */
exports = module.exports = function (service = "log", db = null) {
    return winston.createLogger({
        level: process.env.LOGGING_LEVEL,
        format: winston.format.combine(
            winston.format.timestamp(),
            addCallerinfo(),
            winston.format.json()
        ),
        defaultMeta: {service: service},
        exitOnError: false,
        silent: (process.env.DISABLE_LOGGING === "true" || process.env.DISABLE_LOGGING === 1),
        transports:
            [
                new winston.transports.File({filename: logging_dir + '/error.log', level: 'error'}),
                new winston.transports.File({
                    filename: logging_dir + '/complete.log',
                    level: process.env.LOGGING_LEVEL
                }),
                new winston.transports.File({filename: logging_dir + '/activity.log', level: 'info'}),
                new winston.transports.Console({format: winston.format.simple()}),
                new SQLTransport({level: process.env.LOGGING_LEVEL, db: db})
            ]
    });

}
