'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class CommentVote extends MetaModel {
        static autoTable = true;

        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here

            CommentVote.belongsTo(models["comment"], {
                foreignKey: 'commentId',
                as: 'comment',
            });

            CommentVote.belongsTo(models["user"], {
                foreignKey: 'userId',
                as: 'user',
            });

        }

        /**
         * Duplicate comment votes from original comment to duplicated comment
         * 
         * @param {number} originalCommentId - The ID of the original comment
         * @param {number} duplicatedCommentId - The ID of the duplicated comment
         * @param {Object} options - Database options including transaction
         * @returns {Promise<Array>} Array of duplicated comment votes
         */
        static async duplicateCommentVotes(originalCommentId, duplicatedCommentId, options) {
            // Fetch all votes for the original comment
            const originalVotes = await this.findAll({
                where: {
                    commentId: originalCommentId,
                    deleted: false
                },
                raw: true,
                transaction: options.transaction
            });
            
            const duplicatedVotes = [];
            
            // Create new votes for the duplicated comment
            for (const originalVote of originalVotes) {
                const duplicateVoteData = {
                    userId: originalVote.userId,
                    commentId: duplicatedCommentId,
                    vote: originalVote.vote,
                    deleted: false
                };
                
                const duplicatedVote = await this.add(duplicateVoteData, {transaction: options.transaction});
                duplicatedVotes.push(duplicatedVote);
            }
            
            return duplicatedVotes;
        }
    }

    CommentVote.init({
        userId: DataTypes.INTEGER,
        commentId: DataTypes.INTEGER,
        vote: DataTypes.INTEGER,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'comment_vote',
        tableName: 'comment_vote',
        hooks: {
            beforeCreate: async(commentVote, options) => {
                // if we create a vote, we need to make sure that there is not other vote from the same user on the same comment
                const commentVotes = await sequelize.models.comment_vote.findAll({
                    where: {
                        commentId: commentVote.commentId,
                        userId: commentVote.userId,
                        deleted: false,
                    },
                        raw: true
                }, {transaction: options.transaction});

                for (let vote of commentVotes) {
                    await sequelize.models.comment_vote.deleteById(vote.id, {transaction: options.transaction});
                }

            }
        }
    });
    return CommentVote;
};