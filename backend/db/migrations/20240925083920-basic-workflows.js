'use strict';

const workflows = [
  {
    name: "Peer Review Workflow",
    description: "EiWA Project: Review a PDF document and write free text.",
    steps: [
      { stepType: 1, allowBackward: false, workflowStepDocument: null },
      { stepType: 2, allowBackward: true, workflowStepDocument: 1 }
    ]
  },
  {
    name: "Rummels Project",
    description: "Rummels Project: Correct a document over two revisions with edits overview.",
    steps: [
      { stepType: 2, allowBackward: false, workflowStepDocument: null },
      { stepType: 3, allowBackward: false, workflowStepDocument: 1 },
      { stepType: 2, allowBackward: false, workflowStepDocument: 1 },
      { stepType: 3, allowBackward: false, workflowStepDocument: 3 }
    ]
  }
];

module.exports = { // TODO Code anpassen, workflowStepDocuments neue Werte - soll dann auch korrekt neu gesetzt werden
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

      let workflowMap = {};
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
                      configuration: JSON.stringify({}),
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
      await queryInterface.bulkDelete('workflow_step', {
          workflowId: {
              [Sequelize.Op.in]: workflows.map(w => workflowMap[w.name])
          }
      }, {});

      await queryInterface.bulkDelete('workflow', {
          name: workflows.map(w => w.name)
      }, {});
  }
};

