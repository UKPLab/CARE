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

        // Visibility:
        //   - owner of the parent model sees ALL share rows on their models
        //   - the share's recipient sees their own row 
        static async getUserFilter(userId) {
            const models = await sequelize.models.ai_model.findAll({
                where: {userId, deleted: false},
                attributes: ["id"],
                raw: true,
            });
            const modelIds = models.map((m) => m.id);
            const orClauses = [{userId}];
            if (modelIds.length > 0) {
                orClauses.push({aiModelId: {[Op.in]: modelIds}});
            }
            return {[Op.or]: orClauses};
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
