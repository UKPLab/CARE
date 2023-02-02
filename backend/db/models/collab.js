'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Collab extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
        }
    }

    Collab.init({
        collabHash: DataTypes.STRING,
        userId: DataTypes.INTEGER,
        documentId: DataTypes.INTEGER,
        studySessionId: DataTypes.INTEGER,
        targetType: DataTypes.STRING,
        targetId: DataTypes.INTEGER,
        timestamp: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    }, {
        sequelize,
        modelName: 'collab',
        tableName: 'collab'
    });
    return Collab;
};