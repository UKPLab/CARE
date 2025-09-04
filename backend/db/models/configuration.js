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
                required: true,

            },
            {
                key: "hideInFrontend",
                label: "Hide in Frontend",
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
            },
            {
                key: "configContent",
                label: "Config (JSON)",
                placeholder: "{ }",
                type: "json",
                required: true,
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
        hideInFrontend: DataTypes.BOOLEAN,
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


