"use strict";
const MetaModel = require("../MetaModel.js");

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
