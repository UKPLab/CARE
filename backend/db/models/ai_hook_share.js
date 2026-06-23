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

        // Visibility:
        //   - owner of the parent hook sees ALL share rows on their hooks
        //   - the share's recipient sees their own row
        static async getUserFilter(userId) {
            const hooks = await sequelize.models.ai_hook.findAll({
                where: {userId, deleted: false},
                attributes: ["id"],
                raw: true,
            });
            const hookIds = hooks.map((h) => h.id);
            const orClauses = [{userId}];
            if (hookIds.length > 0) {
                orClauses.push({aiHookId: {[Op.in]: hookIds}});
            }
            return {[Op.or]: orClauses};
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
