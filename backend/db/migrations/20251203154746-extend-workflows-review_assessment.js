'use strict';

const workflows = [
  {
    name: "Review Grading Workflow ",
    description: "Review Grading Workflow with Assessment: Review a submiited study session",
    readOnlyComponents: ["annotater", "Editor", "document", "assessment"],
    steps: [
      {
        stepType: 1,
        allowBackward: false,
        workflowStepDocument: null,
      },
      { 
        stepType: 2, 
        allowBackward: true, 
        workflowStepDocument: 1,
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
                help: "Select the configuration file for this workflow step assessment."
              },
              {
                key: "forcedAssessment",
                label: "Forced Assessment",
                type: "switch",
                required: false,
                default: false,
                help: "If enabled, reviewers must save a score and justification for every criterion before they can proceed."
              }
            ],
          },
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
          let previousStepId = null;  // Keep track of the previous step
          const stepMap = {}; // Track actual step IDs
          const innerStepMap = {}; // Track inner step numbers to actual IDs

          for (let innerStepId = 1; innerStepId <= workflow.steps.length; innerStepId++) {
              const step = workflow.steps[innerStepId - 1]; // Get step

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

      await queryInterface.bulkDelete('workflow_step', {
          workflowId: {
              [Sequelize.Op.in]: workflowNames.map(name => workflowMap[name])
          }
      }, {});

      await queryInterface.bulkDelete('workflow', {
          name: workflowNames
      }, {});
  }
};
