"use strict";

/**
 * Add the dark mode accent colour setting, shown in the settings dashboard
 * next to the logo colour.
 *
 * @type {import('sequelize-cli').Migration}
 */

const settings = [
  {
    key: "theme.dark.accentColor",
    allowUserOverride: true,
    value: "#e3d5a8",
    type: "color",
    description: "Accent colour for buttons and controls in dark mode",
    displayName: "Dark mode accent colour",
    displayGroup: "Interface",
    displaySubsection: "Branding",
  },
  {
    key: "app.theme.mode",
    allowUserOverride: true,
    value: "light",
    type: "text",
    description: "Default colour theme for the interface",
    displayName: "Default theme",
    displayGroup: "Interface",
    displaySubsection: "Branding",
  },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      "setting",
      settings.map((t) => {
        t["createdAt"] = new Date();
        t["updatedAt"] = new Date();
        return t;
      }), { returning: true }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("setting", {
      key: settings.map((t) => t.key),
    }, {});
  },
};
