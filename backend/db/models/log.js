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
         * Get all logs with pagination
         * @param {object} data Data with limit and optional page, order and where
         * @returns {Promise<{rows: Log[]; count: number}>} Logs
         */
        static async getLogs(data) {
            return await Log.findAndCountAll({
                where: ("filter" in data) ? data.filter : {},
                order: ('order' in data && data.order) ? data.order.filter(o => o[0] in this.getAttributes()) : [
                    ['timestamp', 'DESC']
                ],
                limit: data.limit,
                offset: ("page" in data) ? data.page * data.limit : 0,
                raw: true
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