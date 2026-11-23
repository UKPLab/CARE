'use strict';
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class ApiTokenRight extends MetaModel {
        static autoTable = false;
        static fields = [];
        static accessMap = [];

        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
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
