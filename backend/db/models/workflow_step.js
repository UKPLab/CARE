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

        static stepTypes = stepTypes;

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