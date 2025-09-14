"use strict";
const MetaModel = require("../MetaModel.js");

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
         * Upsert document data entry - create new or update existing based on composite key
         * @param {Object} data The data to upsert
         * @param {number} data.userId User ID
         * @param {number} data.documentId Document ID (can be null)
         * @param {number} data.studySessionId Study session ID (can be null)
         * @param {number} data.studyStepId Study step ID (can be null)
         * @param {string} data.key The key for the data being stored
         * @param {any} data.value The value to be stored
         * @param {Object} [options={}] Sequelize options including transaction
         * @returns {Promise<object>} The upserted document data instance
         */
        static async upsert(data, options = {}) {
            try {
                const query = `
                    INSERT INTO document_data ("userId", "documentId", "studySessionId", "studyStepId", "key", "value", "createdAt", "updatedAt")
                    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                    ON CONFLICT (COALESCE("documentId", -1), COALESCE("studySessionId", -1), COALESCE("studyStepId", -1), "key")
                    DO UPDATE SET 
                        "userId" = EXCLUDED."userId",
                        "value" = EXCLUDED."value",
                        "updatedAt" = NOW()
                    RETURNING *
                `;
                
                const result = await DocumentData.sequelize.query(query, {
                    bind: [
                        data.userId,
                        data.documentId,
                        data.studySessionId,
                        data.studyStepId,
                        data.key,
                        JSON.stringify(data.value)
                    ],
                    type: DocumentData.sequelize.QueryTypes.SELECT,
                    transaction: options.transaction
                });
                
                return result[0];
            } catch (e) {
                console.log('DocumentData upsert error:', e);
                throw e;
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
            sequelize: sequelize, modelName: "document_data", tableName: "document_data"
        }
    );

    DocumentData.removeAttribute('id');
    
    return DocumentData;
};
