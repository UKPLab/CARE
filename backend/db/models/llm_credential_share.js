'use strict';
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class LlmCredentialShare extends MetaModel {
        static autoTable = true;

        static associate(models) {
            LlmCredentialShare.belongsTo(models['llm_credential'], {
                foreignKey: 'llmCredentialId',
                as: 'credential',
            });
        }
    }

    LlmCredentialShare.init({
        llmCredentialId: DataTypes.INTEGER,
        userId: DataTypes.INTEGER,
        roleId: DataTypes.INTEGER,
        expiryDate: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'llm_credential_share',
        tableName: 'llm_credential_share',
    });

    return LlmCredentialShare;
};
