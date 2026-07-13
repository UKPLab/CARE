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
    });

    return AiHookShare;
};
