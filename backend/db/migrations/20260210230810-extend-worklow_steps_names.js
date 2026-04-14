'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Get all workflow steps that don't have names
    const workflowSteps = await queryInterface.sequelize.query(
      `SELECT id, "stepType", name
       FROM workflow_step 
       WHERE name IS NULL OR name = ''`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    // Get step type names
    const stepTypeNames = {
      1: 'Annotator',
      2: 'Editor', 
      3: 'Modal'
    };

    // Update each workflow step with step type name
    for (const step of workflowSteps) {
      const stepTypeName = stepTypeNames[step.stepType] || 'Unknown';
      
      await queryInterface.sequelize.query(
        `UPDATE workflow_step SET name = :name WHERE id = :id`,
        {
          replacements: { 
            name: stepTypeName, 
            id: step.id 
          }
        }
      );
    }
  },

  async down (queryInterface, Sequelize) {
    // Revert by setting names back to null for the step type names
    await queryInterface.sequelize.query(
      `UPDATE workflow_step SET name = NULL WHERE name IN ('Annotator', 'Editor', 'Modal')`
    );
  }
};
