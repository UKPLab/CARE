'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    try {
      const stepIds = [4, 6];

      const steps = await queryInterface.sequelize.query(
        `SELECT id, configuration FROM workflow_step 
         WHERE id IN (:stepIds)
         ORDER BY id ASC`,
        { 
          replacements: { stepIds },
          type: Sequelize.QueryTypes.SELECT 
        }
      );

      if (steps && steps.length > 0) {
        for (const step of steps) {
          const stepId = step.id;
          const existingConfig = step.configuration ? step.configuration : {};

          const updatedConfig = {
            ...existingConfig,
            settings: [
              {
                name: "modalSize",
                label: "Modal Size",
                type: "select",
                required: true,
                default: "md",
                options: [
                  { value: "sm", name: "Small" },
                  { value: "md", name: "Medium" },
                  { value: "lg", name: "Large" },
                  { value: "xl", name: "Extra Large" },
                ],
              }
            ]
          };

          await queryInterface.bulkUpdate(
            'workflow_step',
            { configuration: JSON.stringify(updatedConfig) },
            { id: stepId }
          );
        }
      }
    } catch (error) {
    }
  },

  async down (queryInterface, Sequelize) {
    try {      
      const stepIds = [4, 6];

      const steps = await queryInterface.sequelize.query(
        `SELECT id, configuration FROM workflow_step 
         WHERE id IN (:stepIds)
         ORDER BY id ASC`,
        { 
          replacements: { stepIds },
          type: Sequelize.QueryTypes.SELECT 
        }
      );

      if (steps && steps.length > 0) {
        for (const step of steps) {
          const stepId = step.id;
          const existingConfig = step.configuration ? JSON.parse(step.configuration) : {};

          const updatedConfig = { ...existingConfig };
          delete updatedConfig.settings;

          await queryInterface.bulkUpdate(
            'workflow_step',
            { configuration: JSON.stringify(updatedConfig) },
            { id: stepId }
          );
        }
      }
    } catch (error) {
    }
  }
};
