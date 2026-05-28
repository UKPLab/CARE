"use strict";

const { resolveEnText } = require("../migration-i18n-utils");

const NAME_KEY = "dashboard.projects.default.name";
const DESC_KEY = "dashboard.projects.default.description";

const LEGACY_NAME = "Default Project";
const LEGACY_DESCRIPTION = "The default project";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkUpdate(
      "project",
      { name: NAME_KEY, description: DESC_KEY },
      { userId: null, name: LEGACY_NAME, description: LEGACY_DESCRIPTION }
    );
  },

  async down(queryInterface) {
    const name = resolveEnText(NAME_KEY);
    const description = resolveEnText(DESC_KEY);
    if (name == null || description == null) {
      return;
    }
    await queryInterface.bulkUpdate(
      "project",
      { name, description },
      { userId: null, name: NAME_KEY, description: DESC_KEY }
    );
  },
};
