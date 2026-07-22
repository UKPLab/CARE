'use strict';

/** @type {import('sequelize-cli').Migration} */

const pdfTextPlaceholderOptions = [
  {
    name: 'characterLimit',
    label: 'Character limit',
    valueType: 'positiveInteger',
  },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('placeholder');
    if (!table.placeholderOptions) {
      await queryInterface.addColumn('placeholder', 'placeholderOptions', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
      });
    }

    const placeholderOptionsJson = Sequelize.literal(
      `'${JSON.stringify(pdfTextPlaceholderOptions).replace(/'/g, "''")}'::jsonb`
    );

    await queryInterface.bulkUpdate(
      'placeholder',
      { placeholderOptions: placeholderOptionsJson },
      {
        type: 8,
        placeholderKey: 'pdfText',
        deleted: false,
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkUpdate(
      'placeholder',
      { placeholderOptions: null },
      {
        type: 8,
        placeholderKey: 'pdfText',
      }
    );

    await queryInterface.removeColumn('placeholder', 'placeholderOptions');
  },
};
