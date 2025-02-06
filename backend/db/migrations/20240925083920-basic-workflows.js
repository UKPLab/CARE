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
    name: "Rummels Project (experimental)",
    description: "Rummels Project: Correct a document over two revisions with edits overview.",
    steps: [
      { stepType: 2, allowBackward: false, workflowStepDocument: null },
      { stepType: 3, allowBackward: false, workflowStepDocument: null,
        configuration: {
          fields: [
            {
              type: "placeholder",
              pattern: "/~nlp\[(\d+)\]~/g",
              required: true,
              function: "nlp", 
              fields: [
                {
                  name: "skillName",
                  label: "Skill Name",
                  placeholder: "Enter NLP skill name",
                  required: true,
                  default: "Text Analysis",
                },
                {
                  name: "dataSource",
                  label: "Data Source",
                  placeholder: "Enter the data source",
                  required: true,
                  default: "Editor Document",
                },
                {
                  name: "output",
                  label: "Output",
                  placeholder: "Location where expected output should be saved",
                  required: true,
                  default: "HTML Document",
                },
              ],
            },
          ],
        },
      },
      { stepType: 2, allowBackward: false, workflowStepDocument: 1 },
      { stepType: 3, allowBackward: false, workflowStepDocument: null,
        configuration: {
          fields: [
            {
              type: "placeholder",
              pattern: "/~nlp\[(\d+)\]~/g",
              required: true,
              function: "nlp", 
              fields: [
                {
                  name: "skillName",
                  label: "Skill Name",
                  placeholder: "Enter NLP skill name",
                  required: true,
                  default: "Text Analysis",
                },
                {
                  name: "dataSource",
                  label: "Data Source",
                  placeholder: "Enter the data source",
                  required: true,
                  default: "Editor Document",
                },
                {
                  name: "output",
                  label: "Output",
                  placeholder: "Location where expected output should be saved",
                  required: true,
                  default: "HTML Document",
                },
              ],
            },
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

          for (const step of workflow.steps) {
              const stepInsertion = await queryInterface.bulkInsert(
                  'workflow_step',
                  [{
                      workflowId: workflowId,
                      stepType: step.stepType,
                      workflowStepPrevious: previousStepId, 
                      allowBackward: step.allowBackward,
                      workflowStepDocument: step.workflowStepDocument,
                      configuration: JSON.stringify(step.configuration),
                      createdAt: new Date(),
                      updatedAt: new Date()
                  }],
                  { returning: true }
              );

              // Update `previousStepId` to the ID of the current step
              previousStepId = stepInsertion[0].id; 
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

