'use strict';
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class AiLog extends MetaModel {
        static autoTable = true;
    }

    AiLog.init({
        userId: DataTypes.INTEGER,
        aiModelId: DataTypes.INTEGER,
        documentId: DataTypes.INTEGER,
        studySessionId: DataTypes.INTEGER,
        studyStepId: DataTypes.INTEGER,
        requestId: DataTypes.STRING,
        input: DataTypes.TEXT,
        output: DataTypes.TEXT,
        reasoning: DataTypes.TEXT,
        inputTokens: DataTypes.INTEGER,
        outputTokens: DataTypes.INTEGER,
        totalTokens: {
            type: DataTypes.INTEGER,
            field: 'total_tokens',
        },
        costs: DataTypes.FLOAT,
        status: DataTypes.STRING,
        requestStart: DataTypes.DATE,
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
