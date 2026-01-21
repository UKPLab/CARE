'use strict';
const MetaModel = require("../MetaModel.js");

const stepTypes = Object.freeze({
    STEP_TYPE_ANNOTATOR: 1,
    STEP_TYPE_EDITOR: 2,
    STEP_TYPE_MODAL: 3,
});


module.exports = (sequelize, DataTypes) => {
    class WorkflowStep extends MetaModel {
        static autoTable = true;
        static publicTable = true;

        static stepTypes = stepTypes;

        static fields = [{
            key: "name",
            label: "Name of the workflow step:",
            placeholder: "My workflow step",
            type: "text",
            required: true,
            default: "",
            minlength: 2,
            maxlength: 100
        }, {
            key: "stepType",
            label: "Select Step Type:",
            type: "select",
            options: [
                { value: 1, name: "Annotator" },
                { value: 2, name: "Editor" },
                { value: 3, name: "Modal" }
            ],
            icon: "list",
            required: true,
            default: 2,
            help: "Choose the type of workflow step."
        }, {
            key: "allowBackward",
            label: "Allow Backward Navigation:",
            type: "switch",
            default: false,
            help: "Allow users to navigate back to this step."
        }, {
            key: "workflowStepDocument",
            label: "Document Step Reference:",
            type: "select",
            options: {
                table: "workflow_step",
                name: "name",
                value: "id",
                filter: [
                    {type: "formData", key: "workflowId", value: "workflowId"}
                ]
            },
            required: false,
            help: "Reference to another workflow step for document handling."
        }, {
            key: "configuration",
            label: "Configuration:",
            placeholder: "Enter JSON configuration for this step",
            type: "editor",
            required: false,
            default: "",
            help: "Additional configuration settings for this workflow step in JSON format."
        }];

        /**
         * Get the workflow steps sorted by their order
         * @param workflowId
         * @returns {Promise<[]>} Array of workflow steps objects
         */
        static async getSortedWorkflowSteps(workflowId) {
            const workflowSteps = await sequelize.models.workflow_step.getAllByKey("workflowId", workflowId);
            const workflowStepsSorted = [];
            let current = workflowSteps.find(step => step.workflowStepPrevious === null);

            while (current) {
                workflowStepsSorted.push(current);
                current = workflowSteps.find(step => step.workflowStepPrevious === current.id);
            }

            return workflowStepsSorted;
        }

        static associate(models) {
            WorkflowStep.belongsTo(models["workflow"], {
                foreignKey: "workflowId",
                as: "workflow"
            });

            WorkflowStep.belongsTo(models["workflow_step"], {
                foreignKey: "workflowStepPrevious",
                as: "previousStep",
            });

            WorkflowStep.belongsTo(models["workflow_step"], {
                foreignKey: "workflowStepDocument",
                as: "documentStep",
            });

        }
    }

    WorkflowStep.init({
            name: DataTypes.STRING,
            workflowId: DataTypes.INTEGER,
            stepType: DataTypes.INTEGER,
            workflowStepPrevious: DataTypes.INTEGER,
            allowBackward: DataTypes.BOOLEAN,
            workflowStepDocument: DataTypes.INTEGER,
            configuration: DataTypes.JSONB,
            deleted: DataTypes.BOOLEAN,
            deletedAt: DataTypes.DATE,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE
        }, {
            sequelize,
            modelName: 'workflow_step',
            tableName: 'workflow_step'
        }
    );

    return WorkflowStep;
};

module.exports.stepTypes = stepTypes;