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
