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
         * Duplicate document edits from original document to duplicated document
         * 
         * @param {number} originalDocumentId - The ID of the original document
         * @param {Object} duplicatedDoc - The duplicated document object
         * @param {Object} overrides - Optional properties to override (e.g., { studySessionId, studyStepId })
         * @param {Object} transaction - The database transaction
         * @returns {Promise<Array>} Array of duplicated document edits
         */
        static async duplicateEditsByDocument(originalDocumentId, duplicatedDocumentId, overrides = {}, transaction) {
            
            // Build where clause similar to annotations
            const whereClause = {
                documentId: originalDocumentId,
                deleted: false,
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
            
            // Fetch all edits for the original document
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
