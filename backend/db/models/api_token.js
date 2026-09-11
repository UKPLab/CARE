'use strict';
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class ApiToken extends MetaModel {
        // Secrets must not ride subscribeTable / autoTable broadcasts.
        static autoTable = false;
        static fields = [];
        static accessMap = [];

        static associate(models) {
            ApiToken.belongsTo(models['user'], {
                foreignKey: 'userId',
                as: 'user',
            });
            ApiToken.hasMany(models['api_token_right'], {
                foreignKey: 'apiTokenId',
                as: 'rights',
            });
        }
    }

    ApiToken.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        keyHash: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        prefix: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        lastUsedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        deleted: DataTypes.BOOLEAN,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
        deletedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'api_token',
        tableName: 'api_token',
    });

    return ApiToken;
};
