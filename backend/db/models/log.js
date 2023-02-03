'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class Log extends MetaModel {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
        }
    }

    Log.init({
        level: DataTypes.STRING,
        message: DataTypes.STRING,
        service: DataTypes.STRING,
        userId: DataTypes.INTEGER,
        timestamp: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    }, {
        sequelize,
        modelName: 'log',
        tableName: 'log'
    });
    return Log;
};