'use strict';
/** @type {import('sequelize-cli').Migration} */
/**
 * Migration Script: Extend Basic Workflows Configuration
 *
 * This migration updates the first step of the 'Peer Review Workflow' to include a specific
 * configuration, adding a link to a questionnaire. This change is temporary and will be replaced.
 *
 * ⚠️ WARNING: This code is intended to be replaced by dynamic configuration settings 
 * through the frontend after the EiWA code is fully functional. 
 *
 * ⚠️ DO NOT MERGE THIS SCRIPT INTO THE MAIN BRANCH.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
      try {
          // Fetch the ID of the first workflow
          const [workflows] = await queryInterface.sequelize.query(
              `SELECT id FROM "workflow" WHERE name = 'Peer Review Workflow' LIMIT 1;`
          );

          const workflowId = workflows[0].id;

          // Fetch the first step of the workflow
          const [steps] = await queryInterface.sequelize.query(
              `SELECT id FROM "workflow_step" WHERE "workflowId" = :workflowId ORDER BY id ASC LIMIT 1;`,
              { replacements: { workflowId } }
          );

          const stepId = steps[0].id;

          // Update the configuration of the first step
          await queryInterface.bulkUpdate(
              'workflow_step',
              {
                  configuration: JSON.stringify({
                      questionnaire: "https://docs.google.com/forms/d/e/[PLACEHOLDER]/viewform"
                  }),
                  updatedAt: new Date()
              },
              { id: stepId }
          );
      } catch (error) {
          console.error('Migration failed:', error.message);
          throw error; 
      }
  },

  async down(queryInterface, Sequelize) {
      try {
          // Fetch the ID of the first workflow
          const [workflows] = await queryInterface.sequelize.query(
              `SELECT id FROM "workflow" WHERE name = 'Peer Review Workflow' LIMIT 1;`
          );

          const workflowId = workflows[0].id;

          // Fetch the first step of the workflow
          const [steps] = await queryInterface.sequelize.query(
              `SELECT id FROM "workflow_step" WHERE "workflowId" = :workflowId ORDER BY id ASC LIMIT 1;`,
              { replacements: { workflowId } }
          );

          const stepId = steps[0].id;

          // Remove the configuration of the first step
          await queryInterface.bulkUpdate(
              'workflow_step',
              {
                  configuration: JSON.stringify({}),
                  updatedAt: new Date()
              },
              { id: stepId }
          );
      } catch (error) {
          console.error('Rollback failed:', error.message);
          throw error; 
      }
  }
};