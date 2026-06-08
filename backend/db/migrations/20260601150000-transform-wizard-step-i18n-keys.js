"use strict";

const { resolveEnText } = require("../migration-i18n-utils");

/** Wizard step titles/descriptions from basic-wizard_steps seed. */
const WIZARD_STEPS = [
  { key: "admin", title: "setupWizard.steps.admin.title", description: "setupWizard.steps.admin.description" },
  { key: "general", title: "setupWizard.steps.general.title", description: "setupWizard.steps.general.description" },
  { key: "mail", title: "setupWizard.steps.mail.title", description: "setupWizard.steps.mail.description" },
  { key: "registration", title: "setupWizard.steps.registration.title", description: "setupWizard.steps.registration.description" },
  { key: "moodle", title: "setupWizard.steps.moodle.title", description: "setupWizard.steps.moodle.description" },
  { key: "summary", title: "setupWizard.steps.summary.title", description: "setupWizard.steps.summary.description" },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    for (const step of WIZARD_STEPS) {
      await queryInterface.bulkUpdate(
        "wizard_step",
        {
          title: step.title,
          description: step.description,
          updatedAt: new Date(),
        },
        { key: step.key },
        {}
      );
    }
  },

  async down(queryInterface) {
    for (const step of WIZARD_STEPS) {
      const title = resolveEnText(step.title);
      const description = resolveEnText(step.description);
      if (!title || !description) {
        continue;
      }
      await queryInterface.bulkUpdate(
        "wizard_step",
        {
          title,
          description,
          updatedAt: new Date(),
        },
        { key: step.key, title: step.title, description: step.description },
        {}
      );
    }
  },
};
