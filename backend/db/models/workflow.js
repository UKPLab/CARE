'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
  class Workflow extends MetaModel {
    static autoTable = {
            foreignTables: [{
                table: "workflow_step",
                by: "workflowId"
            }]
        };
    static publicTable = true;

    static async deleteWorkflowSteps(workflowId, options) {
      const workflowSteps = await sequelize.models.workflow_step.getAllByKey("workflowId", workflowId);
      for (const step of workflowSteps) {
        await sequelize.models.workflow_step.deleteById(step.id, { transaction: options.transaction });
      }
    }

    static fields = [
        {
            key: "name",
            label: "Name of the Workflow:",
            placeholder: "My workflow",
            type: "text",
            required: true,
            default: "",
        },
        {
            key: "description",
            label: "Description of the Workflow:",
            placeholder: "Workflow description",
            type: "text",
            required: true,
            default: "",
        },
        {
            key: "hideInFrontend",
            label: "Hide Workflow in Frontend:",
            type: "switch",
            default: false,
            help: "If enabled, this workflow will be hidden from users in the frontend."
        }
    ]


    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Workflow.hasMany(models["workflow_step"], {
        foreignKey: "workflowId",
        as: "steps",
        onDelete: "CASCADE"
      });
      Workflow.hasMany(models["study"], {
        foreignKey: "workflowId",
        as: "studies"
      }); 
      // Self-referencing association for workflow versioning
      Workflow.belongsTo(models["workflow"], {
        foreignKey: "parentWorkflowId",
        as: "parentWorkflow"
      });
      Workflow.hasMany(models["workflow"], {
        foreignKey: "parentWorkflowId",
        as: "childWorkflows"
      });
    }
  }

  Workflow.init({
      name: DataTypes.STRING,
      description: DataTypes.TEXT,
      deleted: DataTypes.BOOLEAN,
      deletedAt: DataTypes.DATE,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      parentWorkflowId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'workflow',
          key: 'id'
        }
      },
      hideInFrontend: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      }
      }, {
      sequelize,
      modelName: 'workflow',
      tableName: 'workflow',
      hooks: {
        afterCreate: async (workflow, options) => {
          // Copy workflow steps from parent workflow if parentWorkflowId is set
          if (workflow.parentWorkflowId && workflow.parentWorkflowId !== null) {
            const parentSteps = await sequelize.models.workflow_step.getAllByKey("workflowId", workflow.parentWorkflowId);
            
            if (parentSteps && parentSteps.length > 0) {
              // Sort steps by their linked order
              const sortedSteps = [];
              const stepMap = new Map();
              
              // First pass: create map of steps
              parentSteps.forEach(step => stepMap.set(step.id, step));
              
              // Find the first step (no previous step)
              let currentStep = parentSteps.find(s => s.workflowStepPrevious === null);
              
              // Build sorted array following the linked list
              while (currentStep) {
                sortedSteps.push(currentStep);
                currentStep = parentSteps.find(s => s.workflowStepPrevious === currentStep.id);
              }
              
              // Map old step IDs to new step IDs
              const stepIdMap = new Map();
              
              // Copy steps in order
              for (const parentStep of sortedSteps) {
                const newStepData = {
                  name: parentStep.name,
                  workflowId: workflow.id,
                  stepType: parentStep.stepType,
                  allowBackward: parentStep.allowBackward,
                  configuration: parentStep.configuration,
                  workflowStepPrevious: stepIdMap.get(parentStep.workflowStepPrevious) || null,
                  workflowStepDocument: null, // Will be set in second pass
                };
                
                const newStep = await sequelize.models.workflow_step.create(newStepData, { transaction: options.transaction });
                stepIdMap.set(parentStep.id, newStep.id);
              }
              
              // Second pass: update workflowStepDocument references
              for (const parentStep of sortedSteps) {
                if (parentStep.workflowStepDocument && stepIdMap.has(parentStep.workflowStepDocument)) {
                  const newStepId = stepIdMap.get(parentStep.id);
                  await sequelize.models.workflow_step.update(
                    { workflowStepDocument: stepIdMap.get(parentStep.workflowStepDocument) },
                    { 
                      where: { id: newStepId },
                      transaction: options.transaction 
                    }
                  );
                }
              }
            }
          }
        },
        afterUpdate: async (workflow, options) => {
          if(workflow.deleted) {
            // Cascade delete workflow steps
            await Workflow.deleteWorkflowSteps(workflow.id, options);
          }
        }
      }
    }
  );

  return Workflow;
};