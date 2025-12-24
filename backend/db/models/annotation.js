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
        }

        /**
         * Duplicate annotations from original document to duplicated document
         * Also duplicates all associated comments for each annotation
         * 
         * @param {number} originalDocumentId - The ID of the original document
         * @param {Object} duplicatedDoc - The duplicated document object
         * @param {Object} overrides - Optional properties to override (e.g., { studySessionId, studyStepId })
         * @param {Object} transaction - The database transaction
         * @returns {Promise<Array>} Array of duplicated annotations with their comments
         */
        static async duplicateAnnotations(originalDocumentId, duplicatedDocumentId, overrides = {}, transaction) {

            
            // Build where clause similar to document_data
            const whereClause = {
                documentId: originalDocumentId,
                [Op.or]: [
                    {
                        studySessionId: null,
                        studyStepId: null
                    }
                ]
            };
            
            // Add condition for specific studySessionId and studyStepId if provided
            if (overrides.studySessionId !== undefined && overrides.studyStepId !== undefined) {
                whereClause[Op.or].push({
                    studySessionId: overrides.studySessionId,
                    studyStepId: overrides.studyStepId
                });
            }
            
            // Fetch all annotations for the original document
            const originalAnnotations = await this.findAll({
                where: whereClause,
                raw: true,
                transaction
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
                    deleted: false
                };
                
                const duplicatedAnnotation = await this.add(baseData, {transaction});
                
                // Duplicate all comments for this annotation
                await sequelize.models.comment.duplicateComments(
                    originalAnnotation.id,
                    duplicatedAnnotation,
                    overrides,
                    transaction
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