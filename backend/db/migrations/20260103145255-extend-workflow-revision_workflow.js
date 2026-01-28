'use strict';

const workflows = [
  {
    name: "Revision Workflow",
    description: "Two-step annotation workflow: review previous submission, then annotate with assessment",
    steps: [
      {
        stepType: 1,
        allowBackward: false,
        workflowStepDocument: null,
        configuration: {
          settings: {
            fields: [
              {
                key: "configurationId",
                label: "Assessment Configuration File:",
                type: "select",
                required: true,
                options: {
                  table: "configuration",
                  name: "name",
                  value: "id",
                  filter: [
                    { key: "type", value: 0 },
                    { key: "deleted", value: false }
                  ]
                },
                help: "Select the configuration file for assessment sidebar."
              },
              {
                key: "forcedAssessment",
                label: "Forced Assessment",
                type: "switch",
                required: false,
                default: false,
                help: "If enabled, users must save a score and justification for every criterion before they can proceed."
              },
              {
                key: "showAllDocumentAnnotations",
                label: "Show all document Annotations",
                type: "switch",
                required: false,
                default: true,
                help: "If enabled, all document annotations will be shown to the reviewer."
              }
            ],
          },
          readOnlyComponents: ["annotator", "assessment"],
          placeholders: false
        }
      },
      { 
        stepType: 1, 
        allowBackward: true, 
        workflowStepDocument: null,
        configuration: {
          settings: {
            fields: [
              {
                key: "configurationId",
                label: "Assessment Configuration File:",
                type: "select",
                required: true,
                options: {
                  table: "configuration",
                  name: "name",
                  value: "id",
                  filter: [
                    { key: "type", value: 0 },
                    { key: "deleted", value: false }
                  ]
                },
                help: "Select the configuration file for assessment sidebar."
              },
              {
                key: "forcedAssessment",
                label: "Forced Assessment",
                type: "switch",
                required: false,
                default: false,
                help: "If enabled, users must save a score and justification for every criterion before they can proceed."
              }
            ],
          },
          readOnlyComponents: [],
          placeholders: false
        }
      },
    ],
  }
];

module.exports = { 
  async up(queryInterface, Sequelize) {
      // Insert workflows
      const workflowInsertions = await queryInterface.bulkInsert(
          'workflow',
          workflows.map(w => ({
              name: w.name,
              description: w.description,
              createdAt: new Date(),
              updatedAt: new Date()
          })),
          { returning: true }
      );

      const workflowMap = {};
      workflowInsertions.forEach((w, index) => {
          workflowMap[workflows[index].name] = w.id;
      });

      // Insert workflow steps
      for (const workflow of workflows) {
          const workflowId = workflowMap[workflow.name];
          let previousStepId = null;
          const stepMap = {};
          const innerStepMap = {};

          for (let innerStepId = 1; innerStepId <= workflow.steps.length; innerStepId++) {
              const step = workflow.steps[innerStepId - 1];

              const stepInsertion = await queryInterface.bulkInsert(
                  'workflow_step',
                  [{
                      workflowId: workflowId,
                      stepType: step.stepType,
                      workflowStepPrevious: previousStepId, 
                      allowBackward: step.allowBackward,
                      workflowStepDocument: null, 
                      configuration: JSON.stringify(step.configuration || {}),
                      createdAt: new Date(),
                      updatedAt: new Date()
                  }],
                  { returning: true }
              );

              const dbStepId = stepInsertion[0].id; 
              stepMap[innerStepId] = dbStepId;
              innerStepMap[innerStepId] = dbStepId;
              previousStepId = dbStepId;
          }

          // Update workflowStepDocument with correct references
          for (let innerStepId = 1; innerStepId <= workflow.steps.length; innerStepId++) {
              const step = workflow.steps[innerStepId - 1];

              if (step.workflowStepDocument !== null) {
                  await queryInterface.bulkUpdate(
                      'workflow_step',
                      { workflowStepDocument: innerStepMap[step.workflowStepDocument] },
                      { id: innerStepMap[innerStepId] }
                  );
              }
          }
      }
  },

  async down(queryInterface, Sequelize) {
      const workflowNames = workflows.map(w => w.name);

      // First get workflow IDs
      const workflowRecords = await queryInterface.sequelize.query(
          `SELECT id, name FROM workflow WHERE name IN (:names)`,
          {
              replacements: { names: workflowNames },
              type: queryInterface.sequelize.QueryTypes.SELECT
          }
      );

      const workflowIds = workflowRecords.map(w => w.id);

      if (workflowIds.length > 0) {
          await queryInterface.bulkDelete('workflow_step', {
              workflowId: {
                  [Sequelize.Op.in]: workflowIds
              }
          }, {});

          await queryInterface.bulkDelete('workflow', {
              name: {
                  [Sequelize.Op.in]: workflowNames
              }
          }, {});
      }
  }
};
