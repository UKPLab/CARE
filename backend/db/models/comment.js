'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class comment extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
        }
    }

    comment.init({
        hash: DataTypes.STRING,
        creator: DataTypes.INTEGER,
        text: DataTypes.STRING(2000),
        referenceAnnotation: DataTypes.STRING,
        referenceComment: DataTypes.INTEGER,
        tags: DataTypes.STRING,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    }, {
        sequelize,
        modelName: 'comment',
        tableName: 'comment'
    });
    return comment;
};