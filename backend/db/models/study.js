'use strict';
const MetaModel = require("../MetaModel.js");
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_PATH = `${__dirname}/../../../files`;

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
                key: "workflowId", 
                label: "Select Workflow for Study:",
                type: "select", 
                options: [
                    { value: 1, label: "Peer Review Workflow" },  
                    { value: 2, label: "Rummels Project" }        
                ],
                icon: "list", 
                required: true,
                help: "Choose a workflow template for the study steps."
            },
            {
                key: "stepDocuments",
                label: "Assign Documents to Workflow Steps:",
                type: "table",
                options: {
                    table: "study_step", id: "documentId" //TODO info mitgeben, dass bei selection referenzDatenbank angelegt ist - wäre workflowStep in study
                },
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
        ];

        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
            Study.belongsTo(models["user"], {
                foreignKey: "userId",
                as: "user"
            });

            // Association with the workflow model
            Study.belongsTo(models["workflow"], {
                foreignKey: "workflowId",
                as: "workflow"
            });

            // Association with study sessions
            Study.hasMany(models["study_session"], {
                foreignKey: "studyId",
                as: "sessions"
            });

            // Association with study steps
            Study.hasMany(models["study_step"], {
                foreignKey: "studyId",
                as: "steps"
            });
        }
    }

    Study.init({
        name: DataTypes.STRING,
        hash: DataTypes.STRING,
        userId: DataTypes.INTEGER,
        workflowId: DataTypes.INTEGER,
        collab: DataTypes.BOOLEAN,
        resumable: DataTypes.BOOLEAN,
        description: DataTypes.TEXT,
        timeLimit: DataTypes.INTEGER,
        multipleSubmit: DataTypes.BOOLEAN,
        limitSessions: DataTypes.INTEGER,
        closed: DataTypes.DATE,
        userIdClosed: DataTypes.INTEGER,
        start: DataTypes.DATE,
        end: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE
    }, {
        sequelize: sequelize,
        modelName: 'study',
        tableName: 'study',
        hooks: {
            afterCreate: async (study, options) => {
                const transaction = options.transaction || await sequelize.transaction();

                try {
                    const workflowSteps = await sequelize.models.workflow_step.findAll({
                        where: { workflowId: study.workflowId },
                        order: [['id', 'ASC']],
                        transaction
                    });

                    for (const step of workflowSteps) {
                        await sequelize.models.study_step.create({
                            studyId: study.id,
                            workflowStepId: step.id,
                            documentId: null 
                        }, { transaction });
                    }

                    await transaction.commit();
                } catch (error) {
                    console.error("Failed during study step creation:", error);
                    await transaction.rollback();
                    throw new Error(`Failed to create study steps for the study: ${error.message}`);
                }
            }
        }
    });

    return Study;
};