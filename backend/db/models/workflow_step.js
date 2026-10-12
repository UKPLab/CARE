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
        static accessMap = [
            {
                table: "workflow",
                by: "id",
                target: "workflowId",
                columns: this.getAttributes()
            }
        ];

        static stepTypes = stepTypes;

        // Switch in the study step configuration of every step that allows looking back (see LookBackSpotlight.vue).
        // The same definition is in the migration 20261012211500-extend-workflow_step-look_back_spotlight.js
        static lookBackSpotlightField = {
            key: "lookBackSpotlight",
            label: "Look-back Spotlight",
            type: "switch",
            required: false,
            default: false,
            help: "If enabled, documents of earlier steps are dimmed while looking back, except a band at the mouse height. The part being read is logged."
        };

        /**
         * Add the look-back spotlight switch to a step that allows looking back, and remove it from one that does not
         * @param {WorkflowStep} step the step that is about to be saved
         */
        static syncLookBackSpotlight(step) {
            if (typeof step.configuration === "string") {
                return;
            }
            const configuration = step.configuration || {};
            const settings = configuration.settings || {};
            const fields = Array.isArray(settings.fields) ? settings.fields : [];
            const key = WorkflowStep.lookBackSpotlightField.key;
            const hasSwitch = fields.some(field => field.key === key);

            if (step.allowBackward && !hasSwitch) {
                step.configuration = {...configuration, settings: {...settings, fields: [...fields, WorkflowStep.lookBackSpotlightField]}};
            } else if (!step.allowBackward && hasSwitch) {
                const otherFields = fields.filter(field => field.key !== key);
                const otherConfiguration = {...configuration, settings: {...settings, fields: otherFields}};
                // Remove the settings block again if the switch was its only content
                if (otherFields.length === 0 && Object.keys(settings).length === 1) {
                    delete otherConfiguration.settings;
                }
                step.configuration = otherConfiguration;
            }
        }

        static fields = [{
            key: "name",
            label: "workflow.fields.step.name.label",
            placeholder: "workflow.fields.step.name.placeholder",
            type: "text",
            required: true,
            default: "",
            minlength: 2,
            maxlength: 100
        }, {
            key: "stepType",
            label: "workflow.fields.step.stepType.label",
            type: "select",
            options: [
                { value: 1, name: "workflow.stepTypes.annotator" },
                { value: 2, name: "workflow.stepTypes.editor" },
                { value: 3, name: "workflow.stepTypes.modal" }
            ],
            icon: "list",
            required: true,
            default: 2,
            help: "workflow.fields.step.stepType.help"
        }, {
            key: "allowBackward",
            label: "workflow.fields.step.allowBackward.label",
            type: "switch",
            default: false,
            help: "workflow.fields.step.allowBackward.help"
        },{
            key: "configuration",
            label: "workflow.fields.step.configuration.label",
            placeholder: "workflow.fields.step.configuration.placeholder",
            type: "json",
            required: false,
            default: {},
            help: "workflow.fields.step.configuration.help"
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
            tableName: 'workflow_step',
            hooks: {
                beforeCreate: (step) => WorkflowStep.syncLookBackSpotlight(step),
                beforeUpdate: (step) => WorkflowStep.syncLookBackSpotlight(step),
            }
        }
    );

    return WorkflowStep;
};

module.exports.stepTypes = stepTypes;