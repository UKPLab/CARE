'use strict';

/**
 * Delegated access grants for sharing an `ai_model` with peers via direct users or roles.
 *
 * @author Akash Gundapuneni
 */
const MetaModel = require('../MetaModel.js');

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

        // Requester may write a foreign userId (the share recipient) when they own the referenced ai_model
        static foreignOwner = {column: "aiModelId", table: "ai_model"};

        /**
         * Guards direct updateById calls 
         */
        static async validateOwnerUpdate(share, options = {}) {
            const currentUserId = Number(options?.context?.currentUserId);
            if (!Number.isInteger(currentUserId) || currentUserId <= 0) {
                return;
            }
            const allowed = await AiModelShare.validateForeignUserId(
                {aiModelId: share.aiModelId}, currentUserId, options.transaction
            );
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
