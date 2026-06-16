'use strict';

/**
 * Seeds a Peer Review workflow whose annotator step declares an AI-hook service slot.
 * Mirrors the "Peer Review Workflow (Assessment with AI)" template but uses `type: "aiHook"`
 * (resolved via the prompt-template + LiteLLM path) instead of the NLP `nlpRequest` slot.
 */
const workflows = [
  {
    name: "Peer Review Workflow (AI Hook Assessment)",
    description: "Peer Review Workflow with AI hooks: an annotator step that grades a PDF (result to the assessment sidebar) and an editor step whose hook drafts feedback into the editor.",
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
                    {key: "type", value: 0},
                    {key: "deleted", value: false}
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
          services: [
            {
              name: "aiAssessment",
              type: "aiHook",
              required: true,
              outputs: { assessment: { value: "saveInDocumentData" } },
            }
          ],
          placeholders: false
        }
      },
      {
        stepType: 2,
        allowBackward: true,
        workflowStepDocument: 1,
        configuration: {
          services: [
            {
              name: "aiFeedback",
              type: "aiHook",
              required: true,
              // we dont have output in other nlp request workflows
              outputs: { feedback: { value: "insertIntoEditor" } },
            }
          ],
          placeholders: false
        }
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
        {returning: true}
    );

    const workflowMap = {};
    workflowInsertions.forEach((w, index) => {
      workflowMap[workflows[index].name] = w.id;
    });

    // Insert workflow steps
    for (const workflow of workflows) {
      const workflowId = workflowMap[workflow.name];
      let previousStepId = null; // Keep track of the previous step
      const innerStepMap = {}; // Track inner step numbers to actual ids

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
            {returning: true}
        );

        const dbStepId = stepInsertion[0].id;
        innerStepMap[innerStepId] = dbStepId;
        previousStepId = dbStepId;
      }

      // Resolve workflowStepDocument references to the inserted step ids
      for (let innerStepId = 1; innerStepId <= workflow.steps.length; innerStepId++) {
        const step = workflow.steps[innerStepId - 1];

        if (step.workflowStepDocument !== null) {
          await queryInterface.bulkUpdate(
              'workflow_step',
              {workflowStepDocument: innerStepMap[step.workflowStepDocument]},
              {id: innerStepMap[innerStepId]}
          );
        }
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const workflowNames = workflows.map(w => w.name);

    const rows = await queryInterface.sequelize.query(
        'SELECT id FROM workflow WHERE name IN (:names)',
        {
          replacements: {names: workflowNames},
          type: Sequelize.QueryTypes.SELECT,
        }
    );
    const workflowIds = rows.map(row => row.id);

    if (workflowIds.length > 0) {
      await queryInterface.bulkDelete('workflow_step', {
        workflowId: {[Sequelize.Op.in]: workflowIds}
      }, {});
    }

    await queryInterface.bulkDelete('workflow', {
      name: workflowNames
    }, {});
  }
};
