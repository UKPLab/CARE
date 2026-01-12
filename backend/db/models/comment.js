'use strict';
const MetaModel = require("../MetaModel.js");
const {Op} = require('sequelize');
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
            const relevantComments = await sequelize.models.comment.getAllByKey('annotationId', annotationId, {transaction: options.transaction}, true);

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
            const comments = await sequelize.models.comment.getAllByKey("parentCommentId", commentId);
            await Promise.all(comments.map(async comment => {
                await sequelize.models.comment.deleteById(comment.id, {transaction: options.transaction});
            }));
        }

        /**
         * Duplicate comments from original annotation to duplicated annotation with flexible filtering
         * Recursively duplicates child comments as well
         * 
         * By default, copies ALL comments. Pass filters to filter what gets copied.
         * 
         * @param {number} originalAnnotationId - The ID of the original annotation
         * @param {Object} duplicatedAnnotation - The duplicated annotation object
         * @param {Object|Object[]} [filters] - Optional where clause condition(s) to filter which entries to copy.
         *   - If not provided or empty, copies ALL comments (default)
         *   - Single object: copies entries matching that condition
         *   - Array of objects: copies entries matching ANY of the conditions (OR logic)
         * @param {Object} transaction - The database transaction
         * @returns {Promise<Array>} Array of duplicated comments
         * 
         * @example
         * // Copy all comments (default)
         * await duplicateComments(1, dupAnnotation, null, transaction);
         * 
         * @example
         * // Copy only null entries
         * await duplicateComments(1, dupAnnotation, { studySessionId: null, studyStepId: null }, transaction);
         * 
         * @example
         * // Copy multiple conditions
         * await duplicateComments(1, dupAnnotation, [
         *   { studySessionId: null, studyStepId: null },
         *   { studySessionId: 45, studyStepId: 12 }
         * ], transaction);
         */
        static async duplicateComments(originalAnnotationId, duplicatedAnnotation, filters = null, transaction) {
            
            // Build where clause for root comments (no parent)
            const whereClause = {
                annotationId: originalAnnotationId,
                parentCommentId: null,
                deleted: false
            };
            
            // If filters provided, apply them with OR logic
            if (filters) {
                const conditions = Array.isArray(filters) ? filters : [filters];
                
                // Filter out any empty objects
                const validConditions = conditions.filter(cond => 
                    cond && Object.keys(cond).length > 0
                );
                
                // Always include default null condition + provided conditions
                if (validConditions.length > 0) {
                    whereClause[Op.or] = [
                        { studySessionId: null, studyStepId: null },
                        ...validConditions
                    ];
                }
            }
            // If no filters, copy ALL comments (no additional filtering)
            
            // Fetch all root comments for the original annotation
            const originalComments = await this.findAll({
                where: whereClause,
                raw: true,
                transaction
            });
            
            const duplicatedComments = [];
            const commentIdMap = new Map(); // Map original comment IDs to duplicated comment IDs
            
            // Duplicate root comments and their children recursively
            for (const originalComment of originalComments) {
                const duplicated = await this.duplicateCommentWithChildren(
                    originalComment,
                    duplicatedAnnotation,
                    null,
                    filters,
                    transaction,
                    commentIdMap
                );
                duplicatedComments.push(...duplicated);
            }
            
            return duplicatedComments;
        }

        /**
         * Recursively duplicate a comment and all its children
         * 
         * @param {Object} originalComment - The original comment object
         * @param {Object} duplicatedAnnotation - The duplicated annotation object
         * @param {number|null} newParentCommentId - The ID of the parent comment in the duplicated tree
         * @param {Object|Object[]} filters - Optional where clause conditions for filtering
         * @param {Object} transaction - The database transaction
         * @param {Map} commentIdMap - Map to track original to duplicated comment IDs
         * @returns {Promise<Array>} Array of duplicated comments
         */
        static async duplicateCommentWithChildren(originalComment, duplicatedAnnotation, newParentCommentId, filters, transaction, commentIdMap) {
            // Create base comment data
            const baseData = {
                userId: originalComment.userId,
                text: originalComment.text,
                draft: originalComment.draft,
                documentId: duplicatedAnnotation.documentId,
                annotationId: duplicatedAnnotation.id,
                parentCommentId: newParentCommentId,
                tags: originalComment.tags,
                anonymous: originalComment.anonymous,
                deleted: false
            };
                      
            const duplicatedComment = await this.add(baseData, {transaction});
            commentIdMap.set(originalComment.id, duplicatedComment.id);
            
            const allDuplicated = [duplicatedComment];
            
            // Duplicate comment votes for this comment
            await sequelize.models.comment_vote.duplicateCommentVotes(
                originalComment.id,
                duplicatedComment.id,
                transaction
            );
            
            // Find and duplicate child comments
            const childComments = await this.getAllByKey(
                "parentCommentId",
                originalComment.id,
                {transaction},
                true
            );
            
            for (const childComment of childComments) {
                const duplicatedChildren = await this.duplicateCommentWithChildren(
                    childComment,
                    duplicatedAnnotation,
                    duplicatedComment.id,
                    filters,
                    transaction,
                    commentIdMap
                );
                allDuplicated.push(...duplicatedChildren);
            }
            
            return allDuplicated;
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