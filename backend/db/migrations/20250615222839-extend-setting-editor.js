'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('setting', [{
      key: "editor.document.showButtonPDFDownload",
      value: "true",
      type: "boolean",
      description: "Show download button for PDF documents with annotations",
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('setting', {
      key: "editor.document.showButtonPDFDownload"
    });
  }
};
