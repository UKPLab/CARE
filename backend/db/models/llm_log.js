'use strict';
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class LlmLog extends MetaModel {
        static autoTable = true;

        static associate(models) {
            LlmLog.belongsTo(models['user'], {
                foreignKey: 'userId',
                as: 'user',
            });
            LlmLog.belongsTo(models['api_key'], {
                foreignKey: 'apiKeyId',
                as: 'apiKey',
            });
        }

        /**
         * Get paginated logs with optional filters
         * @param {Object} data - { limit, page, filter, order }
         * @returns {Promise<{rows: LlmLog[], count: number}>}
         */
        static async getLogs(data) {
            return await LlmLog.findAndCountAll({
                where: ('filter' in data && data.filter) ? data.filter : {},
                order: ('order' in data && Array.isArray(data.order))
                    ? data.order.filter(o => o[0] in this.getAttributes())
                    : [['createdAt', 'DESC']],
                limit: Number.isFinite(Number(data.limit)) ? Number(data.limit) : 25,
                offset: (Number.isFinite(Number(data.page)) && Number.isFinite(Number(data.limit)))
                    ? Number(data.page) * Number(data.limit)
                    : 0,
                raw: true,
            });
        }

        /**
         * Get aggregated usage stats for a user or system-wide
         * @param {number|null} userId - null for system-wide
         * @param {number} days - number of days to look back
         * @returns {Promise<Object>}
         */
        static async getUsageStats(userId = null, days = 30) {
            const {Op, fn, col, literal} = require('sequelize');
            const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

            const where = {createdAt: {[Op.gte]: since}};
            if (userId) where.userId = userId;

            const totals = await LlmLog.findOne({
                where,
                attributes: [
                    [fn('COUNT', col('id')), 'totalRequests'],
                    [fn('SUM', col('inputTokens')), 'totalInputTokens'],
                    [fn('SUM', col('outputTokens')), 'totalOutputTokens'],
                    [fn('SUM', col('estimatedCost')), 'totalCost'],
                    [fn('AVG', col('latencyMs')), 'avgLatency'],
                ],
                raw: true,
            });

            const byProvider = await LlmLog.findAll({
                where,
                attributes: [
                    'provider',
                    [fn('COUNT', col('id')), 'requests'],
                    [fn('SUM', col('inputTokens')), 'inputTokens'],
                    [fn('SUM', col('outputTokens')), 'outputTokens'],
                    [fn('SUM', col('estimatedCost')), 'cost'],
                ],
                group: ['provider'],
                raw: true,
            });

            return {totals, byProvider};
        }
    }

    LlmLog.init({
        userId: DataTypes.INTEGER,
        apiKeyId: DataTypes.INTEGER,
        provider: DataTypes.STRING,
        model: DataTypes.STRING,
        skillName: DataTypes.STRING,
        documentId: DataTypes.INTEGER,
        studySessionId: DataTypes.INTEGER,
        studyStepId: DataTypes.INTEGER,
        input: DataTypes.JSONB,
        output: DataTypes.JSONB,
        inputTokens: DataTypes.INTEGER,
        outputTokens: DataTypes.INTEGER,
        estimatedCost: DataTypes.FLOAT,
        latencyMs: DataTypes.INTEGER,
        status: DataTypes.STRING,
        createdAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'llm_log',
        tableName: 'llm_log',
        updatedAt: false,
    });

    return LlmLog;
};
