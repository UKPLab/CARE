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
            // 🟢 Ensure message is a string
            let message = typeof info.message === 'string'
                ? info.message
                : JSON.stringify(info.message);

            // 🟢 Truncate if too long (DB column = varchar(1024))
            if (message.length > 1024) {
                message = message.slice(0, 1021) + '...';
            }

            // 🟢 Use safe, short message for DB insert
            const safeInfo = {...info, message};

            for (const [k, v] of Object.entries(safeInfo)) {
                if (typeof v === 'number' && !Number.isFinite(v)) {
                    safeInfo[k] = null;            // replace NaN/Infinity with NULL
                } else if (v === undefined) {
                    delete safeInfo[k];            // remove undefined so it won't be inserted
                } else if (v instanceof Error) {
                    safeInfo[k] = {                // serialize Errors nicely
                        name: v.name,
                        message: v.message,
                        stack: v.stack,
                    };
                }
            }

            this.db.models['log'].createLog(safeInfo)
                .then(() => {
                    setImmediate(() => this.emit('logged', info));
                    callback();
                })
                .catch((err) => {
                    console.error('SQLTransport insert failed:', err);
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
                    // Formats:
                    //  "at functionName (C:\\path\\file.js:line:column)"
                    //  "at C:\\path\\file.js:line:column"
                    let match = line.trim().match(/^at\s+(?:([^(]+)\s+\()?(.*):(\d+):(\d+)\)?$/);
                    if (match) {
                        const functionName = match[1] ? match[1].trim() : '';
                        const filePath = match[2];
                        const lineNumber = match[3];
                        const columnNumber = match[4];

                        // Extract just the filename from the full path
                        const fileName = filePath ? filePath.split(/[/\\]/).pop() : 'unknown';

                        info.caller = {
                            file: fileName,
                            filePath: filePath,
                            line: parseInt(lineNumber, 10),
                            column: parseInt(columnNumber, 10),
                            function: functionName ? functionName.trim() : 'anonymous'
                        };
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
            winston.format.json(),
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
