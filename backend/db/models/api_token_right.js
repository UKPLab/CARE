'use strict';
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class ApiTokenRight extends MetaModel {
        static autoTable = false;
        static fields = [];
        static accessMap = [];

        static associate(models) {
            ApiTokenRight.belongsTo(models['api_token'], {
                foreignKey: 'apiTokenId',
                as: 'token',
            });
        }
    }

    ApiTokenRight.init({
        apiTokenId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
        },
        userRightName: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: false,
        },
        deleted: DataTypes.BOOLEAN,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
        deletedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'api_token_right',
        tableName: 'api_token_right',
    });

    return ApiTokenRight;
};
