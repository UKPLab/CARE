/* logger.js - Logging everything

This module logs everything into different formats
Use:
const logger = require("../utils/logger.js")("service");
logger.debug(), logger.info(), logger.error(), ...
More information: https://github.com/winstonjs/winston

You can also put user information into the log:
const new_logger = logger.child({user: <uid_from_table_user>});
or logger.info(..., {user: <uid_from_table_user>});

Author: Dennis Zyska (zyska@ukp.informatik....)
Co-Author: --
Source: --
*/

const winston = require('winston');
const Transport = require('winston-transport');

const {
    add: addLog
} = require("../db/methods/log.js");

const logging_dir = process.env.LOGGING_PATH;

class SQLTransport extends Transport {
    constructor(opts) {
        super(opts);
    }

    log(info, callback) {
        addLog(info).then(() => {

            setImmediate(() => {
                this.emit('logged', info);
            });
            callback();
        });

    }
};

exports = module.exports = function (service = "log") {
    return winston.createLogger({
        level: process.env.LOGGING_LEVEL,
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        ),
        defaultMeta: {service: service},
        exitOnError: false,
        silent: (process.env.DISABLE_LOGGING === "true" || process.env.DISABLE_LOGGING === 1),
        transports:
            [
            new winston.transports.File({filename: logging_dir + '/error.log', level: 'error'}),
            new winston.transports.File({filename: logging_dir + '/complete.log', level: process.env.LOGGING_LEVEL}),
            new winston.transports.File({filename: logging_dir + '/activity.log', level: 'info'}),
            new winston.transports.Console({format: winston.format.simple()}),
            new SQLTransport({level: process.env.LOGGING_LEVEL})
        ]
    });

}
