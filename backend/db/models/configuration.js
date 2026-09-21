'use strict';
const MetaModel = require("../MetaModel.js");

const CONFIGURATION_TYPES = Object.freeze({
    ASSESSMENT: 0,
    VALIDATION: 1,
    DIALOGUE_PLAN: 2,
});

module.exports = (sequelize, DataTypes) => {
    /**
     * Configuration model
     * Stores named JSON configurations (e.g., assessment, validation).
     */
    class Configuration extends MetaModel {
        static autoTable = true;
        static publicTable = true;
        static configurationTypes = CONFIGURATION_TYPES;

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
                    { name: "Assessment", value: CONFIGURATION_TYPES.ASSESSMENT },
                    { name: "Validation", value: CONFIGURATION_TYPES.VALIDATION },
                    { name: "Dialogue Plan", value: CONFIGURATION_TYPES.DIALOGUE_PLAN },
                ],
                required: true,
            },
            {
                key: "content",
                label: "Config (JSON)",
                placeholder: "{ }",
                type: "json",
                required: true,
            },
        ];

        static associate(models) {
            Configuration.belongsTo(models["user"], {
                foreignKey: "userId",
                as: "user",
            });
        }
    }

    Configuration.init({
        name: DataTypes.STRING,
        description: DataTypes.TEXT,
        userId: DataTypes.INTEGER,
        hideInFrontend: DataTypes.BOOLEAN,
        type: DataTypes.INTEGER,
        content: DataTypes.JSONB,
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

module.exports.CONFIGURATION_TYPES = CONFIGURATION_TYPES;


