'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    /**
   * Template model
   * Stores reusable templates
   */
    class Template extends MetaModel {
        static autoTable = true;
        static publicTable = true;

        static fields = [
            {
                key: "name",
                label: "Name",
                type: "text",
                required: true,
            },
            {
                key: "description",
                label: "Description",
                type: "textarea",
                required: true
            },
            {
                key: "hidden",
                label: "Hidden",
                type: "switch",
                required: true,
                default: false
            },
            {
                key: "type",
                label: "Type",
                type: "select",
                required: true,
                options: [
                    {
                        name: "Choose type", 
                        value: null, 
                        disabled: true
                    },
                    {
                        name: "Email - General", 
                        value: 1
                    },
                    {
                        name: "Email - Study Session", 
                        value: 2
                    },
                    {
                        name: "Email - Assignment", 
                        value: 3
                    },
                    {
                        name: "Document - General", 
                        value: 4
                    },
                    {
                        name: "Document - Study", 
                        value: 5
                    }
                ],
            },
        ];
        static associate(models) {
            Template.hasMany(models["template_placeholder_mapping"], {
                foreignKey: "templateId",
                as: "placeholders"
            });
        }
    }
    Template.init(
        {
            name: DataTypes.STRING,
            description: DataTypes.TEXT,
            userId: DataTypes.INTEGER,
            hidden: DataTypes.BOOLEAN,
            type: DataTypes.INTEGER,
            content: DataTypes.JSONB,
            deleted: DataTypes.BOOLEAN,
            deletedAt: DataTypes.DATE,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        {
            sequelize,
            modelName: "template",
            tableName: "template",
        }
    );
    return Template;
}