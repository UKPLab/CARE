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
        // by/target mirror study_step → study (owned parent ids → FK on this table).
        static accessMap = [
            {
                table: "ai_model",
                by: "id",
                target: "aiModelId",
                columns: this.getAttributes(),
            },
        ];

        // Requester may write a foreign userId (the share recipient) when they own the referenced ai_model.
        // AppSocket#updateData calls MetaModel.validateForeignUserId for this.
        static foreignOwner = {column: "aiModelId", table: "ai_model"};

        static associate(models) {
            AiModelShare.belongsTo(models["ai_model"], { foreignKey: "aiModelId", as: "model" });
            AiModelShare.belongsTo(models["user"], { foreignKey: "userId", as: "user" });
            AiModelShare.belongsTo(models["user_role"], { foreignKey: "roleId", as: "role" });
        }
    }

    AiModelShare.init({
        aiModelId: DataTypes.INTEGER,
        userId: DataTypes.INTEGER,
        roleId: DataTypes.INTEGER,
        expiryDate: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
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
