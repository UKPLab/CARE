'use strict';

const workflows = [
  {
    name: "Peer Review Workflow",
    description: "EiWA Project: Review a PDF document and write free text.",
    steps: [
      { stepType: 1, allowBackward: false, workflowStepDocument: null },
      { stepType: 2, allowBackward: true, workflowStepDocument: 1,
        configuration: {
          fields: [
            {
              type: "addLinkEOD",
              required: false,
              fields: [
                {
                  name: "reviewLink",
                  help: "The link is added to the end of the document \n `~SESSION_HASH~` will be replace with the current session hash",
                  default: "https://example.com/document?hash=~SESSION_HASH~",
                },
                {
                  name: "reviewText",
                  help: "Do you find the feedback helpful?",
                }
              ],
            },
          ],
        },
      },
    ],
  },
  {
    name: "Ruhr-Uni Bochum Project",
    description: "Ruhr-Uni Bochum Project: Correct a document over two revisions with edits overview.",
    steps: [
      { stepType: 2, allowBackward: false, workflowStepDocument: null }, 
      { stepType: 3, allowBackward: false, workflowStepDocument: null, 
        configuration: {
          services: [
            {
              name: "nlpEditComparison",
              type: "nlpRequest",
              required: true
            }
          ],
        },
      },
      { stepType: 2, allowBackward: false, workflowStepDocument: 1 }, 
      { stepType: 3, allowBackward: false, workflowStepDocument: null, 
        configuration: {
          services: [
            {
              name: "nlpEditComparison",
              type: "nlpRequest",
              required: true
            }
          ],
        },
      },
    ],
  },
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

