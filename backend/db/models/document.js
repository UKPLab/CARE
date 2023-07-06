'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class Document extends MetaModel {
        static autoTable = true;

        static fields = [
            {
                key: "name",
                label: "Name of the document:",
                placeholder: "My document",
                type: "text",
                required: true,
                default: "",
            },
            {
                key: "hash",
                label: "Hash ID of the document",
                placeholder: "#",
                type: "text",
                required: false,
                default: "",
            },
            {
                key: "userId",
                label: "User ID of the document",
                placeholder: "#",
                type: "text",
                required: false,
                default: "",
            },
            {
                key: "public",
                label: "Is the document published?",
                type: "switch",
                required: false,
                default: false
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

    Document.init({
        name: DataTypes.STRING,
        hash: DataTypes.STRING,
        userId: DataTypes.INTEGER,
        public: DataTypes.BOOLEAN,
        updatedAt: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE
    }, {
        sequelize: sequelize,
        modelName: 'document',
        tableName: 'document'
    });
    return Document;
};