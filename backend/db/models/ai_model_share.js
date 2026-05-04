'use strict';
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class AiModelShare extends MetaModel {
        static autoTable = true;
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
