'use strict';

/**
 * Groups the messages in one AI conversation within a study session.
 *
 * @author Mohammed Rawhani
 */
const MetaModel = require('../MetaModel.js');

const AI_CONVERSATION_TYPES = Object.freeze({
    SIDEBAR: 0,
    ADAPTIVE: 1,
});

module.exports = (sequelize, DataTypes) => {
    class AiConversation extends MetaModel {
        static conversationTypes = AI_CONVERSATION_TYPES;

        static associate(models) {
            AiConversation.belongsTo(models["user"], { foreignKey: "userId", as: "user" });
            AiConversation.belongsTo(models["study_session"], { foreignKey: "studySessionId", as: "studySession" });
            AiConversation.hasMany(models["ai_message"], { foreignKey: "conversationId", as: "messages" });
        }
    }

    AiConversation.init({
        userId: DataTypes.INTEGER,
        studySessionId: DataTypes.INTEGER,
        type: DataTypes.INTEGER,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'ai_conversation',
        tableName: 'ai_conversation',
    });

    return AiConversation;
};

module.exports.AI_CONVERSATION_TYPES = AI_CONVERSATION_TYPES;
