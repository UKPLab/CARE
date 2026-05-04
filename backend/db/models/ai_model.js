'use strict';
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class AiModel extends MetaModel {
        static autoTable = true;
    }

    AiModel.init({
        aiCredentialId: DataTypes.INTEGER,
        userId: DataTypes.INTEGER,
        name: DataTypes.STRING,
        model: DataTypes.STRING,
        provider: DataTypes.STRING,
        description: DataTypes.TEXT,
        additionalParameters: DataTypes.JSONB,
        enabled: DataTypes.BOOLEAN,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'ai_model',
        tableName: 'ai_model',
    });

    return AiModel;
};
