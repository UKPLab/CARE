'use strict';

// Switch shown in the study step configuration of every step that allows looking back
const spotlightField = {
  key: "lookBackSpotlight",
  label: "Look-back Spotlight",
  type: "switch",
  required: false,
  default: false,
  help: "If enabled, documents of earlier steps are dimmed while looking back, except a band at the mouse height. The part being read is logged."
};

/**
 * Read a workflow step configuration that may come back as an object or as a JSON string
 * @param {object|string|null} configuration
 * @returns {object|null} the configuration as object, null if it cannot be read
 */
function parseConfiguration(configuration) {
  if (configuration === null || configuration === undefined) {
    return {};
  }
  if (typeof configuration === 'object') {
    return configuration;
  }
  try {
    return JSON.parse(configuration);
  } catch (e) {
    return null;
  }
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [steps] = await queryInterface.sequelize.query(`
      SELECT id, configuration FROM workflow_step WHERE "allowBackward" = true
    `);

    for (const step of steps) {
      const config = parseConfiguration(step.configuration);
      if (!config) {
        continue;
      }

      const settings = config.settings || {};
      const fields = Array.isArray(settings.fields) ? settings.fields : [];
      if (fields.some(field => field.key === spotlightField.key)) {
        continue;
      }

      config.settings = { ...settings, fields: [...fields, spotlightField] };
      await queryInterface.bulkUpdate(
        'workflow_step',
        { configuration: JSON.stringify(config) },
        { id: step.id }
      );
    }
  },

  async down(queryInterface, Sequelize) {
    const [steps] = await queryInterface.sequelize.query(`
      SELECT id, configuration FROM workflow_step WHERE configuration IS NOT NULL
    `);

    for (const step of steps) {
      const config = parseConfiguration(step.configuration);
      if (!config || !config.settings || !Array.isArray(config.settings.fields)) {
        continue;
      }

      const fields = config.settings.fields.filter(field => field.key !== spotlightField.key);
      if (fields.length === config.settings.fields.length) {
        continue;
      }

      // Remove the settings block again if the spotlight switch was its only content
      if (fields.length === 0 && Object.keys(config.settings).length === 1) {
        delete config.settings;
      } else {
        config.settings.fields = fields;
      }

      await queryInterface.bulkUpdate(
        'workflow_step',
        { configuration: JSON.stringify(config) },
        { id: step.id }
      );
    }
  }
};