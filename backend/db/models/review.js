'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Review extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
        }
    }

    Review.init({
        startAt: DataTypes.DATE,
        startBy: DataTypes.INTEGER,
        submitAt: DataTypes.DATE,
        submitted: DataTypes.BOOLEAN,
        decisionBy: DataTypes.INTEGER,
        document: DataTypes.STRING,
        hash: DataTypes.STRING,
        accepted: DataTypes.BOOLEAN,
        decisionAt: DataTypes.DATE,
        decisionReason: DataTypes.STRING,
    }, {
        sequelize,
        modelName: 'review',
        tableName: 'review'
    });
    return Review;
};