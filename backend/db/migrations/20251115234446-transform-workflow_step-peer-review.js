'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Find workflows by name
    const [workflows] = await queryInterface.sequelize.query(`
      SELECT id FROM workflow 
      WHERE name IN ('Peer Review Workflow', 'Peer Review Workflow (Assessment)')
    `);

    const workflowIds = workflows.map(w => w.id);

    if (workflowIds.length > 0) {
      // Find workflow steps with stepType 2 for these workflows that have workflowStepDocument set
      const [steps] = await queryInterface.sequelize.query(`
        SELECT id, "workflowStepDocument" 
        FROM workflow_step 
        WHERE "workflowId" IN (${workflowIds.join(',')}) 
        AND "stepType" = 2 
        AND "workflowStepDocument" IS NOT NULL
      `);

      // Update workflowStepDocument to null for these steps
      for (const step of steps) {
        await queryInterface.bulkUpdate(
          'workflow_step',
          { workflowStepDocument: null },
          { id: step.id }
        );
      }
    }
  },

  async down (queryInterface, Sequelize) {
    // Find workflows by name
    const [workflows] = await queryInterface.sequelize.query(`
      SELECT id FROM workflow 
      WHERE name IN ('Peer Review Workflow', 'Peer Review Workflow (Assessment)')
    `);

    const workflowIds = workflows.map(w => w.id);

    if (workflowIds.length > 0) {
      // For each workflow, find the first step (stepType 1) to reference
      for (const workflowId of workflowIds) {
        const [firstSteps] = await queryInterface.sequelize.query(`
          SELECT id FROM workflow_step 
          WHERE "workflowId" = ${workflowId} 
          AND "stepType" = 1
          ORDER BY id
          LIMIT 1
        `);

        if (firstSteps && firstSteps.length > 0) {
          const firstStepId = firstSteps[0].id;
          
          // Update stepType 2 steps to reference the first step
          await queryInterface.bulkUpdate(
            'workflow_step',
            { workflowStepDocument: firstStepId },
            { 
              workflowId: workflowId,
              stepType: 2
            }
          );
        }
      }
    }
  }
};
