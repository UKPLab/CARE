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
