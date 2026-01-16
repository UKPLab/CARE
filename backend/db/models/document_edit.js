"use strict";
const MetaModel = require("../MetaModel.js");
const {dbToDelta, deltaToDb} = require("editor-delta-conversion");
const {Op} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class DocumentEdit extends MetaModel {
        static autoTable = true;

        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here

            DocumentEdit.belongsTo(models["study_step"], {
                foreignKey: 'studyStepId',
                as: 'studyStep',
            });
        }

       /**
        * Copy edits from source step to the next step
        * 
        * @param {Object} sourceStep - the object with the source step information
        * @param {Object} destStep - the object with the destination step information
        * @param {number} studySessionId - the ID of study session
        * @param {Object} transaction - the transaction object
        * @returns {Promise<*>}
        */
        static async copyEditsByStep(sourceStep, destStep, studySessionId, transaction) {
            // Copy all edits from the source document's session
            const sourceEdits = await this.findAll({
                where: {
                    documentId: sourceStep.documentId,
                    studySessionId: studySessionId,
                    studyStepId: sourceStep.id,
                    deleted: false
                },
                raw: true,
            }, {transaction: transaction});

            // Create new edits for the current step
            if (sourceEdits.length > 0) {
                const newEdits = sourceEdits.map(edit => ({
                    ...edit,
                    id: undefined,
                    documentId: destStep.documentId,
                    updatedAt: new Date()
                }));

                await this.bulkCreate(newEdits, {transaction: transaction});
            }
        }

        /**
         * Duplicate document edits from original document to duplicated document with flexible filtering
         * 
         * By default, copies ALL edits. Pass filters to filter what gets copied.
         * 
         * @param {number} originalDocumentId - The ID of the original document
         * @param {number} duplicatedDocumentId - The ID of the duplicated document
         * @param {Object|Object[]} [filters] - Optional where clause condition(s) to filter which entries to copy.
         *   - If not provided or empty, copies ALL edits (default)
         *   - Single object: copies entries matching that condition
         *   - Array of objects: copies entries matching ANY of the conditions (OR logic)
         * @param {Object} transaction - The database transaction
         * @returns {Promise<Array>} Array of duplicated document edits
         * 
         * @example
         * // Copy all edits (default)
         * await duplicateEditsByDocument(1, 2, null, transaction);
         * 
         * @example
         * // Copy only null entries
         * await duplicateEditsByDocument(1, 2, { studySessionId: null, studyStepId: null }, transaction);
         * 
         * @example
         * // Copy multiple conditions
         * await duplicateEditsByDocument(1, 2, [
         *   { studySessionId: null, studyStepId: null },
         *   { studySessionId: 45, studyStepId: 12 }
         * ], transaction);
         */
        static async duplicateEditsByDocument(originalDocumentId, duplicatedDocumentId, filters = null, transaction) {
            // Build where clause: start with documentId and deleted=false
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
            // If no filters, copy ALL edits (no additional filtering)
            
            // Fetch all edits matching the criteria
            const originalEdits = await this.findAll({
                where: whereClause,
                raw: true,
                transaction
            });
            
            const duplicatedEdits = [];
            
            // Create new edits for the duplicated document
            for (const originalEdit of originalEdits) {
                // Create base edit data
                const baseData = {
                    userId: originalEdit.userId,
                    documentId: duplicatedDocumentId,
                    draft: originalEdit.draft,
                    offset: originalEdit.offset,
                    operationType: originalEdit.operationType,
                    span: originalEdit.span,
                    text: originalEdit.text,
                    attributes: originalEdit.attributes,
                    deleted: false,
                    order: originalEdit.order
                };
                
                const duplicatedEdit = await this.add(baseData, {transaction});
                duplicatedEdits.push(duplicatedEdit);
            }
            
            return duplicatedEdits;
        }
    }

    DocumentEdit.init(
        {
            userId: DataTypes.INTEGER,
            documentId: DataTypes.INTEGER,
            studySessionId: DataTypes.INTEGER,
            studyStepId: DataTypes.INTEGER,
            draft: DataTypes.BOOLEAN,
            offset: DataTypes.INTEGER,
            operationType: DataTypes.INTEGER, // 0: Insert, 1: Delete, 2: Attribute-Change (only retain)
            span: DataTypes.INTEGER,
            text: DataTypes.STRING,
            attributes: DataTypes.JSONB,
            deleted: DataTypes.BOOLEAN,
            order: DataTypes.INTEGER,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
            deletedAt: DataTypes.DATE,
        },
        {
            sequelize: sequelize,
            modelName: "document_edit",
            tableName: "document_edit"
        }
    );
    return DocumentEdit;
};
