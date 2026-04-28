"use strict";
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class DocumentMetadata extends MetaModel {
        static autoTable = true;

        static associate(models) {
            DocumentMetadata.belongsTo(models["document"], {
                foreignKey: "documentId",
                as: "document",
            });

            DocumentMetadata.belongsTo(models["user"], {
                foreignKey: "userId",
                as: "user",
            });
        }
    }

    DocumentMetadata.init({
        documentId: DataTypes.INTEGER,
        userId: DataTypes.INTEGER,
        metaKey: DataTypes.STRING,
        metaValue: DataTypes.JSONB,
        deleted: DataTypes.BOOLEAN,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
        deletedAt: DataTypes.DATE,
    }, {
        sequelize: sequelize,
        modelName: 'document_metadata',
        tableName: 'document_metadata',
    });

    return DocumentMetadata;
};
