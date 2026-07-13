'use strict';

/**
 * Delegated access grants for sharing an `ai_model` with peers via direct users or roles.
 *
 * @author Akash Gundapuneni
 */
const MetaModel = require('../MetaModel.js');
const {Op} = require("sequelize");

module.exports = (sequelize, DataTypes) => {
    class AiModelShare extends MetaModel {
        // Chain user → so anything subscribing to ai_model_share also gets the recipient user row for free.
        static autoTable = {
            parentTables: [
                { table: "user", by: "userId" },
            ],
        };

        // Row access: visible/writable by anyone who owns the referenced ai_model.
        static accessMap = [
            {
                table: "ai_model",
                by: "aiModelId",
                columns: this.getAttributes(),
            },
        ];

        /**
         * Lets appDataUpdate accept a payload's userId as the share recipient (not the
         * requester) when the requester owns the referenced ai_model. Called generically
         * from AppSocket#updateData's foreign-userId guard.
         *
         * @param {{aiModelId?: number, id?: number}} payload Incoming appDataUpdate payload.
         * @param {number} requesterId The socket's authenticated user id.
         * @param {import("sequelize").Transaction} [transaction]
         * @returns {Promise<boolean>}
         */
        static async validateForeignUserId(payload, requesterId, transaction) {
            const aiModelId = payload.aiModelId
                ?? (payload.id && (await this.findByPk(payload.id, {transaction}))?.aiModelId);
            if (!aiModelId) return false;

            const model = await sequelize.models.ai_model.findOne({
                where: {id: aiModelId, deleted: false},
                transaction,
            });
            return Boolean(model) && Number(model.userId) === Number(requesterId);
        }

        /**
         * Guards direct updateById calls
         */
        static async validateOwnerUpdate(share, options = {}) {
            const currentUserId = Number(options?.context?.currentUserId);
            if (!Number.isInteger(currentUserId) || currentUserId <= 0) {
                return;
            }
            const aiModelId = share.aiModelId;
            const allowed = await AiModelShare.validateForeignUserId({aiModelId}, currentUserId, options.transaction);
            if (!allowed) {
                throw new Error("You are not allowed to update this share");
            }
        }
    }

    AiModelShare.init({
        aiModelId: DataTypes.INTEGER,
        userId: DataTypes.INTEGER,
        roleId: DataTypes.INTEGER,
        expiryDate: DataTypes.DATE,
        deleted: {type: DataTypes.BOOLEAN, defaultValue: false},
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'ai_model_share',
        tableName: 'ai_model_share',
        hooks: {
            beforeUpdate: async (share, options) => {
                await AiModelShare.validateOwnerUpdate(share, options);
            },
        },
    });

    return AiModelShare;
};
