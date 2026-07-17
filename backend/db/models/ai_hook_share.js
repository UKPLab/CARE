'use strict';

/**
 * Delegated access grants for sharing an `ai_hook` with peers via direct users or roles.
 *
 * @author Akash Gundapuneni
 */
const MetaModel = require('../MetaModel.js');

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

        // Requester may write a foreign userId (the share recipient) when they own the referenced ai_hook .
        static foreignOwner = {column: "aiHookId", table: "ai_hook"};

        /**
         * Guards direct updateById calls 
         */
        static async validateOwnerUpdate(share, options = {}) {
            const currentUserId = Number(options?.context?.currentUserId);
            if (!Number.isInteger(currentUserId) || currentUserId <= 0) {
                return;
            }
            const allowed = await AiHookShare.validateForeignUserId(
                {aiHookId: share.aiHookId}, currentUserId, options.transaction
            );
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
