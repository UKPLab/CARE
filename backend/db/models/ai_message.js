'use strict';

/**
 * A visible message in an AI conversation.
 *
 * @author Mohammed Rawhani
 */
const MetaModel = require('../MetaModel.js');

const AI_MESSAGE_ROLES = Object.freeze({
    SYSTEM: 0,
    USER: 1,
    ASSISTANT: 2,
});

const AI_MESSAGE_STATUSES = Object.freeze({
    PENDING: 0,
    COMPLETED: 1,
    FAILED: 2,
    ABORTED: 3,
});

module.exports = (sequelize, DataTypes) => {
    class AiMessage extends MetaModel {
        static messageRoles = AI_MESSAGE_ROLES;
        static messageStatuses = AI_MESSAGE_STATUSES;

        static associate(models) {
            AiMessage.belongsTo(models["ai_conversation"], { foreignKey: "conversationId", as: "conversation" });
            AiMessage.belongsTo(models["study_step"], { foreignKey: "studyStepId", as: "studyStep" });
            AiMessage.belongsTo(models["document"], { foreignKey: "documentId", as: "document" });
            AiMessage.belongsTo(models["ai_model"], { foreignKey: "aiModelId", as: "model" });
            AiMessage.hasMany(models["ai_log"], { foreignKey: "aiMessageId", as: "logs" });
        }
    }

    AiMessage.init({
        conversationId: DataTypes.INTEGER,
        studyStepId: DataTypes.INTEGER,
        documentId: DataTypes.INTEGER,
        aiModelId: DataTypes.INTEGER,
        role: DataTypes.INTEGER,
        content: DataTypes.TEXT,
        status: DataTypes.INTEGER,
        metadata: DataTypes.JSONB,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'ai_message',
        tableName: 'ai_message',
    });

    return AiMessage;
};

module.exports.AI_MESSAGE_ROLES = AI_MESSAGE_ROLES;
module.exports.AI_MESSAGE_STATUSES = AI_MESSAGE_STATUSES;
