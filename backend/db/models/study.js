'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class Study extends MetaModel {
        static autoTable = true;
        static fields = [
            {
                key: "name",
                label: "Name of the study:",
                placeholder: "My user study",
                type: "text",
                required: true,
                //pattern: "^(\\d+)",
                //invalidText: "Test invalid text",
                default: "",
                minlength: 4,
                maxlength: 5
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
            {
                key: "description",
                label: "Description of the study:",
                help: "This text will be displayed at the beginning of the user study!",
                type: "editor",
                required: true
            },
            {
                key: "timeLimit",
                type: "slider",
                label: "How much time does a participant have for the study?",
                help: "0 = disable time limitation",
                size: 12,
                unit: "min",
                min: 0,
                max: 180,
                step: 1,
                default: 0,
            },
            {
                key: "collab",
                label: "Should the study be collaborative?",
                type: "switch",
                default: false,
            },
            {
                key: "resumable",
                label: "Should the study be resumable?",
                type: "switch",
                default: false,
            },
            {
                key: "start",
                label: "Study sessions can't start before",
                type: "datetime",
                size: 6,
                default: null,
                },
            {
                key: "end",
                label: "Study sessions can't start after:",
                type: "datetime",
                size: 6,
                default: null,
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

    Study.init({
        name: DataTypes.STRING,
        hash: DataTypes.STRING,
        userId: DataTypes.INTEGER,
        documentId: DataTypes.INTEGER,
        collab: DataTypes.BOOLEAN,
        resumable: DataTypes.BOOLEAN,
        description: DataTypes.TEXT,
        timeLimit: DataTypes.INTEGER,
        start: DataTypes.DATE,
        end: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE
    }, {
        sequelize: sequelize,
        modelName: 'study',
        tableName: 'study'
    });
    return Study;
};