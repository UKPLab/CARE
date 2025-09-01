'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    /**
     * Configuration model
     * Stores named JSON configurations (e.g., assessment, validation).
     */
    class Configuration extends MetaModel {
        static autoTable = true;

        static fields = [
            {
                key: "name",
                label: "Name",
                placeholder: "Configuration name",
                type: "text",
                required: true,
                default: "",
            },
            {
                key: "description",
                label: "Description",
                placeholder: "Optional description",
                type: "text",
                required: false,
                default: "",
            },
            {
                key: "userId",
                label: "User ID",
                placeholder: "#",
                type: "text",
                required: false,
                default: "",
            },
            {
                key: "public",
                label: "Public",
                type: "switch",
                required: false,
                default: false,
            },
            {
                key: "type",
                label: "Type",
                placeholder: "0",
                type: "select",
                options: [
                    { name: "Assessment", value: 0 },
                    { name: "Validation", value: 1 },
                ],
                required: true,
                default: 0,
            },
            {
                key: "configContent",
                label: "Config (JSON)",
                placeholder: "{ }",
                type: "json",
                required: true,
                default: {},
            },
        ];

        static associate(models) {
            // no associations for now
        }
    }

    Configuration.init({
        name: DataTypes.STRING,
        description: DataTypes.TEXT,
        userId: DataTypes.INTEGER,
        public: DataTypes.BOOLEAN,
        type: DataTypes.INTEGER,
        configContent: DataTypes.JSONB,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'configuration',
        tableName: 'configuration',
    });

    return Configuration;
};


