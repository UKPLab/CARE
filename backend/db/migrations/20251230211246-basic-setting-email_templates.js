'use strict';

/** @type {import('sequelize-cli').Migration} */

const settings = [
  {
    key: "email.template.passwordReset",
    value: "",
    type: "number",
    description: "Template ID for password reset emails (Type 1: Email - General). Leave empty to use default hardcoded email."
  }, 
  {
    key: "email.template.verification",
    value: "",
    type: "number",
    description: "Template ID for email verification emails (Type 1: Email - General). Leave empty to use default hardcoded email."
  }, 
  {
    key: "email.template.registration",
    value: "",
    type: "number",
    description: "Template ID for registration welcome emails (Type 1: Email - General). Leave empty to use default hardcoded email."
  }
]

module.exports = {
  async up (queryInterface, Sequelize) {
    const groups = await queryInterface.bulkInsert('setting', settings.map(t => {
      t['createdAt'] = new Date();
      t['updatedAt'] = new Date();
      return t;
    }), {returning: true});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete("setting", {
      key: settings.map(t => t.key)
    }, {}); 
  }
};
