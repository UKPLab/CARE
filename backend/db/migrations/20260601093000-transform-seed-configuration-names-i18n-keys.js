"use strict";

const { resolveEnText } = require("../migration-i18n-utils");

const NAME_MAPPINGS = [
  {
    from: "Exposé assessment configuration",
    key: "basic.configuration.presets.exposeAssessmentEn",
  },
  {
    from: "Exposé feedback configuration",
    key: "basic.configuration.presets.exposeFeedbackEn",
  },
  {
    from: "Exposé assessment configuration (German)",
    key: "basic.configuration.presets.exposeAssessmentDe",
  },
  {
    from: "Exposé feedback configuration (German)",
    key: "basic.configuration.presets.exposeFeedbackDe",
  },
];

async function updateNameAndContentName(queryInterface, fromName, toName) {
  await queryInterface.sequelize.query(
    `
      UPDATE configuration
      SET
        name = :toName,
        content = jsonb_set(content, '{name}', to_jsonb(CAST(:toName AS text)), true),
        "updatedAt" = NOW()
      WHERE type = 0 AND name = :fromName
    `,
    {
      replacements: { fromName, toName },
    }
  );
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    for (const mapping of NAME_MAPPINGS) {
      await updateNameAndContentName(queryInterface, mapping.from, mapping.key);
    }
  },

  async down(queryInterface) {
    for (const mapping of NAME_MAPPINGS) {
      const enText = resolveEnText(mapping.key);
      if (!enText) {
        continue;
      }
      await updateNameAndContentName(queryInterface, mapping.key, enText);
    }
  },
};
