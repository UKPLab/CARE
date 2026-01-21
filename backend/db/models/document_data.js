"use strict";
const MetaModel = require("../MetaModel.js");
const {Op} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class DocumentData extends MetaModel {
        static autoTable = true;

        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {

            // define association here           
            DocumentData.belongsTo(models["document"], {
                foreignKey: "documentId",
                as: "document",
            });

            DocumentData.belongsTo(models["study_step"], {
                foreignKey: "studyStepId",
                as: "studyStep",
            });
        }

        /**
         * Upsert document data based on composite unique key
         * @param {Object} data - The data to insert or update
         * @param {Object} options - Additional options for the upsert operation
         * @returns {Promise<[DocumentData, boolean | null]>} - The upserted record and created flag
         */
        static async upsertData(data, options = {}) {
            return await this.upsert(data, {
                conflictFields: ['conflict_key'],
                returning: true,
                ...options
            });
        }

        /**
         * Duplicate document data from one document to another with flexible filtering
         * 
         * By default, copies ALL document data. Pass filters to filter what gets copied.
         * 
         * @param {number} originalDocumentId - The ID of the original document
         * @param {number} duplicateDocumentId - The ID of the duplicated document
         * @param {Object|Object[]} [filters] - Optional where clause condition(s) to filter which entries to copy.
         *   - If not provided or empty, copies ALL document data (default)
         *   - Single object: copies entries matching that condition
         *   - Array of objects: copies entries matching ANY of the conditions (OR logic)
         * @param {Object} transaction - Sequelize transaction object
         * @returns {Promise<void>}
         * 
         * @example
         * // Copy all data (default)
         * await duplicateDocumentData(1, 2, null, transaction);
         * 
         * @example
         * // Copy only entries where both studySessionId and studyStepId are null
         * await duplicateDocumentData(1, 2, { studySessionId: null, studyStepId: null }, transaction);
         * 
         * @example
         * // Copy entries with specific studySessionId (regardless of studyStepId)
         * await duplicateDocumentData(1, 2, { studySessionId: 45 }, transaction);
         * 
         * @example
         * // Copy entries matching multiple conditions (OR logic)
         * await duplicateDocumentData(1, 2, [
         *   { studySessionId: null, studyStepId: null },
         *   { studySessionId: 45, studyStepId: 12 },
         *   { studySessionId: 46 }
         * ], transaction);
         */
        static async duplicateDocumentData(originalDocumentId, duplicateDocumentId, filters = null, transaction) {

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
            // If no filters, copy ALL data (no additional filtering)
            
            // Fetch all document data matching the criteria
            const originalDataEntries = await this.findAll({
                where: whereClause,
                raw: true,
                transaction
            });       
            // Create new data entries for the duplicated document
            if (originalDataEntries.length > 0) {
                const newDataEntries = originalDataEntries.map(entry => ({
                    ...entry,
                    documentId: duplicateDocumentId, // Set to the new duplicated document ID
                    updatedAt: new Date(),
                    studySessionId: null,
                    studyStepId: null,
                    id: undefined
                }));
                await this.bulkCreate(newDataEntries, {transaction});
            }
        }
    }

    DocumentData.init(
        {
            userId: DataTypes.INTEGER,
            documentId: DataTypes.INTEGER,
            studySessionId: DataTypes.INTEGER,
            studyStepId: DataTypes.INTEGER,
            key: DataTypes.STRING,
            value: DataTypes.JSONB,
            deleted: DataTypes.BOOLEAN,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
            deletedAt: DataTypes.DATE,
        },
        {
            sequelize: sequelize,
            modelName: "document_data",
            tableName: "document_data",
        }
    );

    return DocumentData;
};
