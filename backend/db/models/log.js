'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Log extends Model {
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
        timestamp: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'log',
        tableName: 'log'
    });
    return Log;
};