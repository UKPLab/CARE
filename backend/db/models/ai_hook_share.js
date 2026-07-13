'use strict';

/**
 * Delegated access grants for sharing an `ai_hook` with peers via direct users or roles.
 *
 * @author Akash Gundapuneni
 */
const MetaModel = require('../MetaModel.js');
const {Op} = require("sequelize");

module.exports = (sequelize, DataTypes) => {
    class AiHookShare extends MetaModel {
        // Chain user → recipient row comes along when ai_hook_share is loaded
        // via another model's parentTables (e.g. ai_budget).
        static autoTable = {
            parentTables: [
                { table: "user", by: "userId" },
            ],
        };

        // Row access: visible/writable by anyone who owns the referenced ai_hook.
        static accessMap = [
            {
                table: "ai_hook",
                by: "aiHookId",
                columns: this.getAttributes(),
            },
        ];

        /**
         * Lets appDataUpdate accept a payload's userId as the share recipient (not the
         * requester) when the requester owns the referenced ai_hook. Called generically
         * from AppSocket#updateData's foreign-userId guard.
         *
         * @param {{aiHookId?: number, id?: number}} payload Incoming appDataUpdate payload.
         * @param {number} requesterId The socket's authenticated user id.
         * @param {import("sequelize").Transaction} [transaction]
         * @returns {Promise<boolean>}
         */
        static async validateForeignUserId(payload, requesterId, transaction) {
            const aiHookId = payload.aiHookId
                ?? (payload.id && (await this.findByPk(payload.id, {transaction}))?.aiHookId);
            if (!aiHookId) return false;

            const hook = await sequelize.models.ai_hook.findOne({
                where: {id: aiHookId, deleted: false},
                transaction,
            });
            return Boolean(hook) && Number(hook.userId) === Number(requesterId);
        }

        /**
         * Guards direct updateById calls
         */
        static async validateOwnerUpdate(share, options = {}) {
            const currentUserId = Number(options?.context?.currentUserId);
            if (!Number.isInteger(currentUserId) || currentUserId <= 0) {
                return;
            }
            const aiHookId = share.aiHookId;
            const allowed = await AiHookShare.validateForeignUserId({aiHookId}, currentUserId, options.transaction);
            if (!allowed) {
                throw new Error("You are not allowed to update this share");
            }
        }
    }

    AiHookShare.init({
        aiHookId: DataTypes.INTEGER,
        userId: DataTypes.INTEGER,
        roleId: DataTypes.INTEGER,
        expiryDate: DataTypes.DATE,
        deleted: {type: DataTypes.BOOLEAN, defaultValue: false},
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'ai_hook_share',
        tableName: 'ai_hook_share',
        hooks: {
            beforeUpdate: async (share, options) => {
                await AiHookShare.validateOwnerUpdate(share, options);
            },
        },
    });

    return AiHookShare;
};
