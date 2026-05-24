'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class Statistic extends MetaModel {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            Statistic.belongsTo(models["user"], {
                foreignKey: "userId",
                as: "user",
            });
        }
    }

    Statistic.init({
        action: DataTypes.STRING,
        data: DataTypes.TEXT,
        userId: DataTypes.INTEGER,
        session: DataTypes.STRING,
        timestamp: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    }, {
        sequelize,
        modelName: 'statistic',
        tableName: 'statistic'
    });
    return Statistic;
};