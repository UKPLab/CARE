'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class Log extends MetaModel {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
        }

        /**
         * Get all logs
         * @param {number} limit Limit of the logs
         * @returns {Promise<array>} Logs
         */
        static async getLogs(limit = 100) {
            return await this.findAll({
                order: [
                    ['timestamp', 'DESC']
                ],
                limit: limit
            });
        }

        /**
         * Add a log to the database
         * @param info Log info object with level, message and meta data
         * @return {Promise<object>} Log object
         */
        static async createLog(info) {
            const {level, message, ...meta} = info;

            try {
                return await this.create({
                    level: level,
                    message: message,
                    service: meta.service,
                    userId: meta.userId !== undefined ? meta.userId : null,
                    timestamp: new Date(),
                });
            } catch (e) {
                console.log("Can't put log into the database: " + e);
                console.log("Log: ", info);
            }
        }

    }

    Log.init({
        level: DataTypes.STRING,
        message: DataTypes.STRING,
        service: DataTypes.STRING,
        userId: DataTypes.INTEGER,
        timestamp: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    }, {
        sequelize,
        modelName: 'log',
        tableName: 'log'
    });
    return Log;
};