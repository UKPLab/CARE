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
                label: "basic.configuration.fields.name.label",
                placeholder: "basic.configuration.fields.name.placeholder",
                type: "text",
                required: true,
                default: "",
            },
            {
                key: "description",
                label: "basic.configuration.fields.description.label",
                placeholder: "basic.configuration.fields.description.placeholder",
                type: "text",
                required: false,
                default: "",
            },
            {
                key: "userId",
                label: "basic.configuration.fields.userId.label",
                placeholder: "#",
                type: "text",
                required: true,

            },
            {
                key: "hideInFrontend",
                label: "basic.configuration.fields.hideInFrontend.label",
                type: "switch",
                required: false,
                default: false,
            },
            {
                key: "type",
                label: "basic.configuration.fields.type.label",
                placeholder: "0",
                type: "select",
                options: [
                    { name: "basic.configuration.types.assessment", value: CONFIGURATION_TYPES.ASSESSMENT },
                    { name: "basic.configuration.types.validation", value: CONFIGURATION_TYPES.VALIDATION },
                    { name: "basic.configuration.types.dialoguePlan", value: CONFIGURATION_TYPES.DIALOGUE_PLAN },
                ],
                required: true,
            },
            {
                key: "content",
                label: "basic.configuration.fields.content.label",
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


