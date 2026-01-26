'use strict';

/** @type {import('sequelize-cli').Migration} */

/**
 * Transform setting description for email.template.studyClosed.
 * Updates the description to reference Type 6 (Email - Study Close) instead of Type 2.
 * This corrects the original migration which incorrectly referenced Type 2.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Update setting description to reference Type 6 instead of Type 2
    await queryInterface.sequelize.query(
      `UPDATE setting
       SET "description" = 'Template ID for study closed emails (Type 6: Email - Study Close). Leave empty to use default hardcoded email.'
       WHERE "key" = 'email.template.studyClosed'`
    );
  },

  async down(queryInterface, Sequelize) {
    // Revert to original description with Type 2
    await queryInterface.sequelize.query(
      `UPDATE setting
       SET "description" = 'Template ID for study closed emails (Type 2: Email - Study Session). Leave empty to use default hardcoded email.'
       WHERE "key" = 'email.template.studyClosed'`
    );
  },
};
