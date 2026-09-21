'use strict';

/**
 * A visible message in an AI conversation.
 *
 * @author Mohammed Rawhani
 */
const MetaModel = require('../MetaModel.js');
const {Op} = require('sequelize');

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

        /**
         * Loads displayable messages, optionally limited to a dialogue step.
         * @param {number} conversationId - Conversation id.
         * @param {number|null} [studyStepId] - Optional study step id.
         * @param {Object} [options] - Database options.
         * @returns {Promise<Object[]>} Safe messages in chronological order.
         */
        static async getVisibleMessages(conversationId, studyStepId = null, options = {}) {
            return this.findAll({
                where: {
                    conversationId,
                    ...(studyStepId === null ? {} : {studyStepId}),
                    role: {[Op.in]: [AI_MESSAGE_ROLES.USER, AI_MESSAGE_ROLES.ASSISTANT]},
                    deleted: false,
                },
                attributes: [
                    "id", "conversationId", "studyStepId", "aiModelId", "role", "content",
                    "metadata", "status", "createdAt", "updatedAt",
                ],
                order: [["id", "ASC"]],
                raw: true,
                transaction: options.transaction,
            });
        }

        /**
         * Builds complete model history using only completed messages.
         * @param {number} conversationId - Conversation id.
         * @param {Object} [options] - Database options.
         * @returns {Promise<Object[]>} Model role/content pairs.
         */
        static async getModelMessages(conversationId, options = {}) {
            const roles = {
                [AI_MESSAGE_ROLES.SYSTEM]: "system",
                [AI_MESSAGE_ROLES.USER]: "user",
                [AI_MESSAGE_ROLES.ASSISTANT]: "assistant",
            };
            const rows = await this.findAll({
                where: {
                    conversationId,
                    role: {[Op.in]: Object.keys(roles).map(Number)},
                    status: AI_MESSAGE_STATUSES.COMPLETED,
                    deleted: false,
                },
                attributes: ["role", "content"],
                order: [["id", "ASC"]],
                raw: true,
                transaction: options.transaction,
            });
            return rows.map((message) => ({role: roles[message.role], content: message.content}));
        }

        /**
         * Lists steps whose system context has been stored.
         * @param {number} conversationId - Conversation id.
         * @param {Object} [options] - Database options.
         * @returns {Promise<number[]>} Introduced step ids.
         */
        static async getIntroducedContextStepIds(conversationId, options = {}) {
            const rows = await this.findAll({
                where: {
                    conversationId, role: AI_MESSAGE_ROLES.SYSTEM,
                    status: AI_MESSAGE_STATUSES.COMPLETED, deleted: false,
                },
                attributes: ["studyStepId"],
                order: [["id", "ASC"]],
                raw: true,
                transaction: options.transaction,
            });
            return [...new Set(rows.map((row) => Number(row.studyStepId)).filter(Boolean))];
        }

        /**
         * Lists sources recorded in completed system context; older untagged rows add none.
         * @param {number} conversationId - Conversation id.
         * @param {Object} [options] - Database options.
         * @returns {Promise<string[]>} Introduced source keys.
         */
        static async getIntroducedContextSourceKeys(conversationId, options = {}) {
            const rows = await this.findAll({
                where: {
                    conversationId, role: AI_MESSAGE_ROLES.SYSTEM,
                    status: AI_MESSAGE_STATUSES.COMPLETED, deleted: false,
                },
                attributes: ["metadata"],
                order: [["id", "ASC"]],
                raw: true,
                transaction: options.transaction,
            });
            return [...new Set(rows.flatMap((row) => Array.isArray(row.metadata?.contextSourceKeys)
                ? row.metadata.contextSourceKeys.filter((key) => typeof key === "string" && key.length > 0)
                : []))];
        }

        /**
         * Loads the system context for one study step.
         * @param {number} conversationId - Conversation id.
         * @param {number} studyStepId - Study step id.
         * @param {Object} [options] - Database options.
         * @returns {Promise<Object|null>} Stored context and metadata.
         */
        static async getSystemMessage(conversationId, studyStepId, options = {}) {
            return this.findOne({
                where: {
                    conversationId, studyStepId, role: AI_MESSAGE_ROLES.SYSTEM,
                    status: AI_MESSAGE_STATUSES.COMPLETED, deleted: false,
                },
                order: [["id", "DESC"]],
                raw: true,
                transaction: options.transaction,
            });
        }

        /**
         * Loads the latest assistant response for retry validation.
         * @param {number} conversationId - Conversation id.
         * @param {Object} [options] - Database options.
         * @returns {Promise<Object|null>} Latest assistant row.
         */
        static async getLatestAssistantMessage(conversationId, options = {}) {
            return this.findOne({
                where: {conversationId, role: AI_MESSAGE_ROLES.ASSISTANT, deleted: false},
                order: [["id", "DESC"]],
                raw: true,
                transaction: options.transaction,
            });
        }

        /**
         * Loads the answer preceding an assistant in the same dialogue step.
         * @param {Object} assistantMessage - Assistant row being retried.
         * @param {Object} [options] - Database options.
         * @returns {Promise<Object|null>} Previous user row.
         */
        static async getPreviousUserMessage(assistantMessage, options = {}) {
            return this.findOne({
                where: {
                    conversationId: assistantMessage.conversationId,
                    studyStepId: assistantMessage.studyStepId,
                    role: AI_MESSAGE_ROLES.USER,
                    id: {[Op.lt]: assistantMessage.id},
                    deleted: false,
                },
                order: [["id", "DESC"]],
                raw: true,
                transaction: options.transaction,
            });
        }

        /**
         * Finds a pending response in an authenticated study session.
         * @param {number} userId - Authenticated owner id.
         * @param {number} studySessionId - Session id.
         * @param {Object} [options] - Database options.
         * @returns {Promise<Object|null>} Pending assistant id.
         */
        static async getPendingMessage(userId, studySessionId, options = {}) {
            return this.findOne({
                where: {role: AI_MESSAGE_ROLES.ASSISTANT, status: AI_MESSAGE_STATUSES.PENDING, deleted: false},
                include: [{
                    model: sequelize.models.ai_conversation,
                    as: "conversation",
                    where: {userId, studySessionId, deleted: false},
                    attributes: [],
                    required: true,
                }],
                attributes: ["id"],
                transaction: options.transaction,
            });
        }

        /**
         * Changes an assistant only while its status still matches.
         * @param {number} id - Assistant message id.
         * @param {number[]} statuses - Allowed current statuses.
         * @param {Object} values - Server-prepared message fields.
         * @param {Object} [options] - Database options.
         * @returns {Promise<number>} Number of changed messages.
         */
        static async updateMessageIfStatus(id, statuses, values, options = {}) {
            const [count] = await this.update(values, {
                where: {
                    id, role: AI_MESSAGE_ROLES.ASSISTANT,
                    status: {[Op.in]: statuses}, deleted: false,
                },
                transaction: options.transaction,
            });
            return count;
        }

        static associate(models) {
            AiMessage.belongsTo(models["ai_conversation"], { foreignKey: "conversationId", as: "conversation" });
            AiMessage.belongsTo(models["study_step"], { foreignKey: "studyStepId", as: "studyStep" });
            AiMessage.belongsTo(models["ai_model"], { foreignKey: "aiModelId", as: "model" });
            AiMessage.hasMany(models["ai_log"], { foreignKey: "aiMessageId", as: "logs" });
        }
    }

    AiMessage.init({
        conversationId: DataTypes.INTEGER,
        studyStepId: DataTypes.INTEGER,
        aiModelId: DataTypes.INTEGER,
        role: DataTypes.INTEGER,
        content: DataTypes.TEXT,
        metadata: DataTypes.JSONB,
        status: DataTypes.INTEGER,
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
