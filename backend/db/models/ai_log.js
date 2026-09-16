'use strict';

/**
 * Append-only audit trail for AI chat/test invocations (tokens, cost, status).
 *
 * @author Akash Gundapuneni
 */
const MetaModel = require('../MetaModel.js');
const TranslatableError = require("../../utils/TranslatableError");

module.exports = (sequelize, DataTypes) => {
    class AiLog extends MetaModel {
        static autoTable = true;

        static associate(models) {
            AiLog.belongsTo(models["study_session"], { foreignKey: "studySessionId", as: "studySession" });
        }

        // appDataUpdate always sets context.currentUserId. request.js writes omit it.
        static rejectClientWrite(options = {}) {
            const currentUserId = Number(options?.context?.currentUserId);
            if (!Number.isInteger(currentUserId) || currentUserId <= 0) {
                return;
            }
            throw new TranslatableError("errors.ai.log.updateNotAllowed");
        }
    }

    AiLog.init({
        userId: DataTypes.INTEGER,
        aiModelId: DataTypes.INTEGER,
        aiHookId: DataTypes.INTEGER,
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
        hooks: {
            beforeCreate: (_row, options) => {
                AiLog.rejectClientWrite(options);
            },
            beforeUpdate: (_row, options) => {
                AiLog.rejectClientWrite(options);
            },
        },
    });

    return AiLog;
};
