'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Comment extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
        }
    }

    Comment.init({
        userId: DataTypes.INTEGER,
        text: DataTypes.STRING(4096),
        draft: DataTypes.BOOLEAN,
        documentId: DataTypes.INTEGER,
        referenceAnnotation: DataTypes.INTEGER,
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
    return Comment;
};