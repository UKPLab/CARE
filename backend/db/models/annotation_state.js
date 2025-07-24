'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    /**
     * CommentState model
     * Stores state information for comments, linked to user_environment style.
     */
    class CommentState extends MetaModel {
        static autoTable = true;
        static associate(models) {
        }
    }

    CommentState.init({
        documentId: DataTypes.INTEGER,
        userId: DataTypes.INTEGER,
        studySessionId: DataTypes.INTEGER,
        studyStepId: DataTypes.INTEGER,
        commentId: DataTypes.INTEGER,
        state: DataTypes.INTEGER,
        updatedAt: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE
    }, {
        sequelize: sequelize,
        modelName: 'comment_state',
        tableName: 'comment_state'
    });
    return CommentState;
};