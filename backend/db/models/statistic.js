'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Statistic extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
        }
    }

    Statistic.init({
        action: DataTypes.STRING,
        data: DataTypes.STRING,
        user: DataTypes.INTEGER,
        timestamp: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'statistic',
        tableName: 'statistic'
    });
    return Statistic;
};