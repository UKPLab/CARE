'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class Comment extends MetaModel {
        static autoTable = true;

        /**
         * Delete comments by annotationId
         * @param annotationId
         * @param options
         * @returns {Promise<void>}
         */
        static async deleteByAnnotationId(annotationId, options = {}) {
            const relevantComments = await sequelize.models.comment.getAllByKey('annotationId', annotationId, {transaction: options.transaction});

            for (const comment of relevantComments) {
                await sequelize.models.comment.deleteById(comment.id, {transaction: options.transaction});
            }
        }

        /**
         * Delete child comments of a comment
         * @param commentId
         * @param options
         * @returns {Promise<void>}
         */
        static async deleteChildComments(commentId, options = {}) {
            const comments = sequelize.models.comment.getAllByKey("parentCommentId", commentId);
            await Promise.all(comments.map(async comment => {
                await sequelize.models.comment.deleteById(comment.id, {transaction: options.transaction});
            }));
        }


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
        anonymous: DataTypes.BOOLEAN,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'comment',
        tableName: 'comment',
        hooks: {
            afterUpdate: async (comment, options) => {
                if (comment.deleted && comment._previousDataValues.deleted === false) {
                    await sequelize.models.comment.deleteChildComments(comment.id, {transaction: options.transaction});
                }
            },
        }
    });
    return Comment;
};