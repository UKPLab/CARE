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
    });

    return AiModelShare;
};
