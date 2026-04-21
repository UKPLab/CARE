'use strict';
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class LlmModel extends MetaModel {
        static autoTable = true;

        static associate(models) {
            LlmModel.belongsTo(models['user'], {
                foreignKey: 'userId',
                as: 'creator',
            });
            LlmModel.belongsTo(models['llm_credential'], {
                foreignKey: 'llmCredentialId',
                as: 'credential',
            });
        }
    }

    LlmModel.init({
        llmCredentialId: DataTypes.INTEGER,
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
        modelName: 'llm_model',
        tableName: 'llm_model',
    });

    return LlmModel;
};
