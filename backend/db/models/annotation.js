'use strict';
const MetaModel = require("../MetaModel.js");
const { Op } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Annotation extends MetaModel {
        static autoTable = true;

        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
            
            Annotation.belongsTo(models["study_step"], {
                foreignKey: 'studyStepId',
                as: 'studyStep',
            });

            Annotation.belongsTo(models["user"], {
                foreignKey: 'userId',
                as: 'user',
            });
        }

        /**
         * Duplicate annotations from original document to duplicated document with flexible filtering
         * Also duplicates all associated comments for each annotation
         * 
         * By default, copies ALL annotations. Pass filters to filter what gets copied.
         * 
         * @param {number} originalDocumentId - The ID of the original document
         * @param {number} duplicatedDocumentId - The ID of the duplicated document
         * @param {Object|Object[]} [filters] - Optional where clause condition(s) to filter which entries to copy.
         *   - If not provided or empty, copies ALL annotations (default)
         *   - Single object: copies entries matching that condition
         *   - Array of objects: copies entries matching ANY of the conditions (OR logic)
         * @param {number|null} targetStudySessionId - Optional study session ID to set for the duplicated annotations (overrides original value)
         * @param {number|null} targetStudyStepId - Optional study step ID to set for the duplicated annotations (overrides original value)
         * @param {Object} options - Database options including transaction
         * @returns {Promise<Array>} Array of duplicated annotations with their comments
         * 
         * @example
         * // Copy all annotations (default)
         * await duplicateAnnotations(1, 2, null, null, null, options);
         * 
         * @example
         * // Copy only null entries
         * await duplicateAnnotations(1, 2, { studySessionId: null, studyStepId: null }, null, null, options);
         * 
         * @example
         * // Copy multiple conditions
         * await duplicateAnnotations(1, 2, [
         *   { studySessionId: null, studyStepId: null },
         *   { studySessionId: 45, studyStepId: 12 }
         * ], options);
         */
        static async duplicateAnnotations(originalDocumentId, duplicatedDocumentId, filters = null, targetStudySessionId = null, targetStudyStepId = null, options) {
            // Build where clause: start with documentId
            const whereClause = {
                documentId: originalDocumentId,
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
                        ...validConditions
                    ];
                }
            }
            // If no filters, copy ALL annotations (no additional filtering)
            
            // Fetch all annotations matching the criteria
            const originalAnnotations = await this.findAll({
                where: whereClause,
                raw: true,
                transaction: options.transaction
            });
            
            const duplicatedAnnotations = [];
            
            // Create new annotations and their comments
            for (const originalAnnotation of originalAnnotations) {
                // Create base annotation data
                const baseData = {
                    userId: originalAnnotation.userId,
                    text: originalAnnotation.text,
                    tagId: originalAnnotation.tagId,
                    documentId: duplicatedDocumentId,
                    selectors: originalAnnotation.selectors,
                    draft: originalAnnotation.draft,
                    anonymous: originalAnnotation.anonymous,
                    deleted: false,
                    studySessionId: targetStudySessionId,
                    studyStepId: targetStudyStepId
                };
                
                const duplicatedAnnotation = await this.add(baseData, {transaction: options.transaction});
                
                // Duplicate all comments for this annotation
                await sequelize.models.comment.duplicateComments(
                    originalAnnotation.id,
                    duplicatedAnnotation,
                    filters,
                    targetStudySessionId,
                    targetStudyStepId,
                    options
                );
                
                duplicatedAnnotations.push(duplicatedAnnotation);
            }
            
            return duplicatedAnnotations;
        }
    }

        

    Annotation.init({
        userId: DataTypes.STRING,
        text: DataTypes.STRING,
        tagId: DataTypes.INTEGER,
        documentId: DataTypes.INTEGER,
        studySessionId: DataTypes.INTEGER,
        studyStepId: DataTypes.INTEGER,
        selectors: DataTypes.JSONB,
        draft: DataTypes.BOOLEAN,
        anonymous: DataTypes.BOOLEAN,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'annotation',
        tableName: 'annotation',
        hooks: {
            afterUpdate: async (annotation, options) => {
                if (annotation.deleted && !annotation._previousDataValues.deleted) {
                    await sequelize.models.comment.deleteByAnnotationId(annotation.id, {transaction: options.transaction});
                }
            }
        }
    });
    return Annotation;
};