'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {

    // Removing `addLinkEOD` blocks from all workflow steps
    const [steps] = await queryInterface.sequelize.query(`
      SELECT id, configuration FROM workflow_step WHERE configuration IS NOT NULL
    `);

    for (const step of steps) {
      let config;
      try {
        if (typeof step.configuration === 'object' && step.configuration !== null) {
          config = step.configuration;
        } else {
          config = JSON.parse(step.configuration);
        }
      } catch (e) {
        continue;
      }

      if (config?.fields) {
        const newFields = config.fields.filter(field => field.type !== 'addLinkEOD');
        if (newFields.length !== config.fields.length) {
          config.fields = newFields;
          if (config.fields.length === 0) {
            await queryInterface.bulkUpdate(
              'workflow_step',
              { configuration: JSON.stringify({}) },
              { id: step.id }
            );
          }
          else {
            await queryInterface.bulkUpdate(
              'workflow_step',
              { configuration: JSON.stringify(config) },
              { id: step.id }
            );
          }
        }
      }
    }

    // Inserting a new 'Simple Annotation Workflow'
    const [newWorkflow] = await queryInterface.bulkInsert('workflow', [{
      name: 'Annotation Workflow',
      description: 'Workflow with one single annotation step.',
      createdAt: new Date(),
      updatedAt: new Date()
    }], { returning: true });

    const workflowId = newWorkflow.id ?? newWorkflow[0]?.id;

    await queryInterface.bulkInsert('workflow_step', [{
      workflowId: workflowId,
      stepType: 1, // Annotator
      workflowStepPrevious: null,
      allowBackward: false,
      workflowStepDocument: null,
      configuration: JSON.stringify({}),
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
  },

  async down(queryInterface, Sequelize) {
    const [workflows] = await queryInterface.sequelize.query(`
      SELECT id FROM workflow WHERE name = 'Annotation Workflow'
    `);

    const workflowIds = workflows.map(w => w.id);

    if (workflowIds.length > 0) {
      await queryInterface.bulkDelete('workflow_step', {
        workflowId: { [Sequelize.Op.in]: workflowIds }
      });

      await queryInterface.bulkDelete('workflow', {
        id: { [Sequelize.Op.in]: workflowIds }
      });
    }
  }
};