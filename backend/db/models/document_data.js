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

        static async duplicateDocumentData(originalDocumentId, duplicateDocumentId, overrides = {}, transaction) {
            
            // Build where clause: find entries with documentId and either:
            // 1. Both studySessionId and studyStepId are null, OR
            // 2. Both studySessionId and studyStepId have specific values (from overrides)
            const whereClause = {
                documentId: originalDocumentId,
                [Op.or]: [
                    {
                        studySessionId: null,
                        studyStepId: null
                    }
                ]
            };
            
            // Add condition for specific studySessionId and studyStepId if provided in overrides
            if (overrides.studySessionId !== undefined && overrides.studyStepId !== undefined) {
                whereClause[Op.or].push({
                    studySessionId: overrides.studySessionId,
                    studyStepId: overrides.studyStepId
                });
            }
            
            // Fetch all document data for the original document
            const originalDataEntries = await this.findAll({
                where: whereClause,
                raw: true,
                transaction
            });            
            // Create new data entries for the duplicated document
            if (originalDataEntries.length > 0) {
                for (const entry of originalDataEntries) {
                    // Prepare the create data with the new document ID
                    const { id, createdAt, updatedAt, deletedAt, studySessionId, studyStepId, ...entryWithoutMeta } = entry;
                    const createData = {
                        ...entryWithoutMeta,
                        studySessionId: null,
                        studyStepId: null,
                        documentId: duplicateDocumentId, // Set to the new duplicated document ID
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    
                    // Create a new entry for the duplicated document
                    await this.create(createData, {
                        transaction
                    });
                }
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
