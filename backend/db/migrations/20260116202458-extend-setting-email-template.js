"use strict";

/** @type {import('sequelize-cli').Migration} */

const settings = [
  {
    key: "email.template.sessionStart",
    value: "",
    type: "number",
    description: "Template ID for session start emails (Type 2: Email - Study Session). Leave empty to use default hardcoded email."
  },
  {
    key: "email.template.sessionFinish",
    value: "",
    type: "number",
    description: "Template ID for session finish emails (Type 2: Email - Study Session). Leave empty to use default hardcoded email."
  },
  {
    key: "email.template.assignment",
    value: "",
    type: "number",
    description: "Template ID for assignment notification emails (Type 3: Email - Assignment). Leave empty to use default hardcoded email."
  },
  {
    key: "email.template.studyClosed",
    value: "",
    type: "number",
    description: "Template ID for study closed emails (Type 2: Email - Study Session). Leave empty to use default hardcoded email."
  }
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      "setting",
      settings.map((t) => {
        t["createdAt"] = new Date();
        t["updatedAt"] = new Date();
        return t;
      }),
      { returning: true }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      "setting",
      {
        key: settings.map((t) => t.key),
      },
      {}
    );
  },
};
