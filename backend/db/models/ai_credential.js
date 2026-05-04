'use strict';
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class AiCredential extends MetaModel {
        static autoTable = true;

    }

    AiCredential.init({
        userId: DataTypes.INTEGER,
        name: DataTypes.STRING,
        apiKey: DataTypes.TEXT,
        apiBaseUrl: DataTypes.STRING,
        apiVersion: DataTypes.STRING,
        enabled: DataTypes.BOOLEAN,
        additionalParameters: DataTypes.JSONB,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'ai_credential',
        tableName: 'ai_credential',
    });

    return AiCredential;
};
