'use strict';
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class AiLog extends MetaModel {
        static autoTable = true;

        static associate(models) {
        }
    }

    AiLog.init({
        userId: DataTypes.INTEGER,
        apiKeyId: DataTypes.INTEGER,
        modelId: DataTypes.INTEGER,
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
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'ai_log',
        tableName: 'ai_log',
    });

    return AiLog;
};
