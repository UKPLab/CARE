'use strict';

/**
 * Append-only audit trail for AI chat/test invocations (tokens, cost, status).
 *
 * @author Akash Gundapuneni
 */
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class AiLog extends MetaModel {
        static autoTable = true;

        static associate(models) {
            AiLog.belongsTo(models["study_session"], { foreignKey: "studySessionId", as: "studySession" });
            AiLog.belongsTo(models["ai_message"], { foreignKey: "aiMessageId", as: "message" });
        }
    }

    AiLog.init({
        userId: DataTypes.INTEGER,
        aiModelId: DataTypes.INTEGER,
        aiHookId: DataTypes.INTEGER,
        documentId: DataTypes.INTEGER,
        studySessionId: DataTypes.INTEGER,
        studyStepId: DataTypes.INTEGER,
        aiMessageId: DataTypes.INTEGER,
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
        totalLatencyMs: DataTypes.INTEGER,
        ttftMs: DataTypes.INTEGER,
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
