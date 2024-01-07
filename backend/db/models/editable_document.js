'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class EditableDocument extends MetaModel {
        static autoTable = true;
        static fields = [
            {
                key: "text",
                label: "Content of the Study:",
                placeholder: "My editable document",
                type: "text",
                required: false,
                default: "",
                maxlength: 10000
            },
            {
                key: "documentId",
                label: "Selected document for the study:",
                type: "select",
                options: {
                    table: "document", name: "name", value: "id"
                },
                icon: "file-earmark",
                required: true,
            },
        ]

        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
        }
    }

    EditableDocument.init({
        userId: DataTypes.INTEGER,
        documentId: DataTypes.INTEGER,
        text: DataTypes.STRING(10000),
        version: DataTypes.INTEGER,
        updatedAt: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE
    }, {
        sequelize: sequelize,
        modelName: 'editable_document',
        tableName: 'editable_document'
    });
    return EditableDocument;
};