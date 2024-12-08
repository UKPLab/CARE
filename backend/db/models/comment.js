'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class Comment extends MetaModel {
        static autoTable = true;

        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
            
            Comment.belongsTo(models["study_step"], {
                foreignKey: 'studyStepId',
                as: 'studyStep',
            });
        }
    }

    Comment.init({
        userId: DataTypes.INTEGER,
        text: DataTypes.STRING(4096),
        draft: DataTypes.BOOLEAN,
        studySessionId: DataTypes.INTEGER,
        studyStepId: DataTypes.INTEGER,
        documentId: DataTypes.INTEGER,
        annotationId: DataTypes.INTEGER,
        parentCommentId: DataTypes.INTEGER,
        tags: DataTypes.STRING,
        anonymize: DataTypes.BOOLEAN,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'comment',
        tableName: 'comment'
    });
    return Comment;
};