'use strict';

/**
 * Groups the messages in one AI conversation within a study session.
 *
 * @author Mohammed Rawhani
 */
const MetaModel = require('../MetaModel.js');

const AI_CONVERSATION_TYPES = Object.freeze({
    CHAT: 0,
    DIALOGUE: 1,
});

module.exports = (sequelize, DataTypes) => {
    class AiConversation extends MetaModel {
        /**
         * Finds a conversation within its authenticated session and type.
         * @param {number} id - Conversation id.
         * @param {number} userId - Authenticated owner id.
         * @param {number} studySessionId - Session id.
         * @param {number} type - Conversation type.
         * @param {Object} [options] - Database options.
         * @returns {Promise<Object|null>} Owned conversation.
         */
        static async getOwnedConversation(id, userId, studySessionId, type, options = {}) {
            return this.findOne({
                where: {id, userId, studySessionId, type, deleted: false},
                raw: true,
                transaction: options.transaction,
            });
        }

        /**
         * Lists safe conversation summaries in activity order.
         * @param {number} userId - Authenticated owner id.
         * @param {number} studySessionId - Session id.
         * @param {number} type - Conversation type.
         * @param {Object} [options] - Database options.
         * @returns {Promise<Object[]>} Conversation summaries.
         */
        static async getSessionConversations(userId, studySessionId, type, options = {}) {
            return this.findAll({
                where: {userId, studySessionId, type, deleted: false},
                attributes: ["id", "studySessionId", "type", "title", "includeContext", "createdAt", "updatedAt"],
                order: [["updatedAt", "DESC"], ["id", "DESC"]],
                raw: true,
                transaction: options.transaction,
            });
        }

        /**
         * Records activity without passing timestamps through editable fields.
         * @param {number} id - Conversation id.
         * @param {Object} [options] - Database options.
         * @returns {Promise<number>} Number of updated conversations.
         */
        static async touch(id, options = {}) {
            const conversation = await this.findOne({
                where: {id, deleted: false},
                transaction: options.transaction,
            });
            if (!conversation) return 0;
            conversation.changed("updatedAt", true);
            await conversation.save({fields: ["updatedAt"], transaction: options.transaction});
            return 1;
        }

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
        title: DataTypes.TEXT,
        includeContext: {type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true},
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
