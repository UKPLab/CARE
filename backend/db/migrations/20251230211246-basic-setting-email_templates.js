'use strict';

/** @type {import('sequelize-cli').Migration} */

const settings = [
  {
    key: "email.template.passwordReset",
    value: "",
    type: "number",
    description: "Template type for password reset emails (Email - General). Leave empty to use default hardcoded email."
  },
  {
    key: "email.template.verification",
    value: "",
    type: "number",
    description: "Template type for email verification emails (Email - General). Leave empty to use default hardcoded email."
  },
  {
    key: "email.template.registration",
    value: "",
    type: "number",
    description: "Template type for registration welcome emails (Email - General). Leave empty to use default hardcoded email."
  },
  {
    key: "email.template.sessionStart",
    value: "",
    type: "number",
    description: "Template type for session start emails (Email - Study Session). Leave empty to use default hardcoded email."
  },
  {
    key: "email.template.sessionFinish",
    value: "",
    type: "number",
    description: "Template type for session finish emails (Email - Study Session). Leave empty to use default hardcoded email."
  },
  {
    key: "email.template.assignment",
    value: "",
    type: "number",
    description: "Template type for assignment notification emails (Email - Assignment). Leave empty to use default hardcoded email."
  },
  {
    key: "email.template.studyClosed",
    value: "",
    type: "number",
    description: "Template type for study closed emails (Email - Study Close). Leave empty to use default hardcoded email."
  },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      'setting',
      settings.map((t) => ({
        ...t,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      { returning: true }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      "setting",
      { key: settings.map((t) => t.key) },
      {}
    );
  },
};
