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
        // by/target mirror study_step → study (owned parent ids → FK on this table).
        static accessMap = [
            {
                table: "ai_hook",
                by: "id",
                target: "aiHookId",
                columns: this.getAttributes(),
            },
        ];

        // Requester may write a foreign userId (the share recipient) when they own the referenced ai_hook.
        // AppSocket#updateData calls MetaModel.validateForeignUserId for this.
        static foreignOwner = {column: "aiHookId", table: "ai_hook"};

        static associate(models) {
            AiHookShare.belongsTo(models["ai_hook"], { foreignKey: "aiHookId", as: "hook" });
            AiHookShare.belongsTo(models["user"], { foreignKey: "userId", as: "user" });
            AiHookShare.belongsTo(models["user_role"], { foreignKey: "roleId", as: "role" });
        }
    }

    AiHookShare.init({
        aiHookId: DataTypes.INTEGER,
        userId: DataTypes.INTEGER,
        roleId: DataTypes.INTEGER,
        expiryDate: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
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
