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
