'use strict';

const workflows = [
  {
    name: "Peer Review Workflow (Assessment)",
    description: "Peer Review Workflow with Assessment: Review a PDF document, write free text, and select configuration.",
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
      { stepType: 3, allowBackward: false, workflowStepDocument: null,
        configuration: {
          services: [
            {
              name: "configurationSelection",
              type: "modalRequest",
              required: true
            }
          ],
        },
      },
    ],
  },
  {
    name: "Peer Review Workflow (Assessment with AI)",
    description: "Peer Review Workflow with Assessment and AI: Review a PDF document, write free text, select configuration, and use AI assessment.",
    steps: [
      { stepType: 1, allowBackward: false, workflowStepDocument: null },
      { stepType: 2, allowBackward: false, workflowStepDocument: 1,
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
      { stepType: 3, allowBackward: false, workflowStepDocument: null,
        configuration: {
          services: [
            {
              name: "configurationSelection",
              type: "modalRequest",
              required: true
            }
          ],
        },
      }
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

      // Get workflow IDs for deletion
      const workflowRecords = await queryInterface.sequelize.query(
          'SELECT id FROM workflow WHERE name IN (:workflowNames)',
          {
              replacements: { workflowNames },
              type: queryInterface.sequelize.QueryTypes.SELECT
          }
      );

      const workflowIds = workflowRecords.map(w => w.id);

      if (workflowIds.length > 0) {
          // Delete workflow steps first
          await queryInterface.bulkDelete('workflow_step', {
              workflowId: {
                  [Sequelize.Op.in]: workflowIds
              }
          }, {});

          // Delete workflows
          await queryInterface.bulkDelete('workflow', {
              id: {
                  [Sequelize.Op.in]: workflowIds
              }
          }, {});
      }
  }
};
