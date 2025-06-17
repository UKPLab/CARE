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
            sequelize: sequelize, modelName: "document_data", tableName: "document_data", hooks: {
                beforeCreate: async (documentData, options) => {
                    const exists = await DocumentData.findOne({
                        where: {
                            studySessionId: documentData.studySessionId,
                            studyStepId: documentData.studyStepId,
                            key: documentData.key
                        },
                        transaction: options.transaction
                    });
                    if (exists) {
                        await exists.update(
                            {value: documentData.value},
                            { transaction: options.transaction });
                        return false;
                    }
                }
            }
        }
    );
    return DocumentData;
};
