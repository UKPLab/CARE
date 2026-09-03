'use strict';

/** @type {import('sequelize-cli').Migration} */

const wordRangeOption = {
  name: 'wordRange',
  label: 'Word range',
  valueType: 'positiveIntegerRange',
};

const pageRangeOption = {
  name: 'pageRange',
  label: 'Page range',
  valueType: 'positiveIntegerRange',
};

const optionsByPlaceholderKey = {
  pdfText: [wordRangeOption, pageRangeOption],
  submissionFiles: [wordRangeOption, pageRangeOption],
  editorText: [wordRangeOption],
};

function optionsLiteral(Sequelize, options) {
  return Sequelize.literal(
    `'${JSON.stringify(options).replace(/'/g, "''")}'::jsonb`
  );
}

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

    for (const [placeholderKey, options] of Object.entries(optionsByPlaceholderKey)) {
      await queryInterface.bulkUpdate(
        'placeholder',
        { placeholderOptions: optionsLiteral(Sequelize, options) },
        {
          type: 8,
          placeholderKey,
          deleted: false,
        }
      );
    }
  },

  async down(queryInterface) {
    for (const placeholderKey of Object.keys(optionsByPlaceholderKey)) {
      await queryInterface.bulkUpdate(
        'placeholder',
        { placeholderOptions: null },
        {
          type: 8,
          placeholderKey,
        }
      );
    }

    await queryInterface.removeColumn('placeholder', 'placeholderOptions');
  },
};
