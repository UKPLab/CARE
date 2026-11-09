'use strict';
const MetaModel = require("../MetaModel.js");
const {Op} = require("sequelize");

/**
 * Problem report submitted from the topbar Report button.
 *
 * Deliberately not an autoTable: reports are read and written only through
 * ProblemReportSocket, which limits access to the reporter and administrators
 * and keeps generic appDataUpdate writes away from this table.
 *
 * @author Akash Gundapuneni
 */
module.exports = (sequelize, DataTypes) => {
    class ProblemReport extends MetaModel {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            ProblemReport.belongsTo(models["user"], {
                foreignKey: "userId",
                as: "user",
            });
        }

        /**
         * Find a user's report created from the same opened form (duplicate submit protection).
         *
         * @param {number} userId Reporter
         * @param {string} clientRequestId Client-generated form id
         * @param {Object} [options={}] Sequelize options (transaction)
         * @returns {Promise<Object|null>}
         */
        static async getByClientRequestId(userId, clientRequestId, options = {}) {
            return await this.findOne({
                where: {userId, clientRequestId},
                raw: true,
                transaction: options.transaction,
            });
        }

        /**
         * Count a user's reports created since the given time.
         *
         * @param {number} userId Reporter
         * @param {Date} since Start of the window
         * @param {Object} [options={}] Sequelize options (transaction)
         * @returns {Promise<number>}
         */
        static async countSince(userId, since, options = {}) {
            return await this.count({
                where: {userId, deleted: false, createdAt: {[Op.gte]: since}},
                transaction: options.transaction,
            });
        }

        /**
         * One page of non-deleted reports, newest first.
         *
         * @param {number} page Zero-based page
         * @param {number} limit Page size
         * @returns {Promise<{rows: Object[], count: number}>}
         */
        static async getPage(page, limit) {
            return await this.findAndCountAll({
                where: {deleted: false},
                order: [["createdAt", "DESC"], ["id", "DESC"]],
                limit,
                offset: page * limit,
                raw: true,
            });
        }
    }

    ProblemReport.init({
        userId: DataTypes.INTEGER,
        clientRequestId: DataTypes.STRING,
        problemTypes: DataTypes.JSONB,
        blocked: DataTypes.BOOLEAN,
        frequency: DataTypes.STRING,
        description: DataTypes.TEXT,
        context: DataTypes.JSONB,
        diagnostics: DataTypes.JSONB,
        attachments: DataTypes.JSONB,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'problem_report',
        tableName: 'problem_report',
    });
    return ProblemReport;
};
