'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('study_template_mapping', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      studyId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'study',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      templateType: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      templateId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'template',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      deleted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // Add unique constraint: one mapping per studyId + templateType combination (only when not deleted)
    // Using partial unique index for PostgreSQL
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX unique_study_template_type 
      ON study_template_mapping ("studyId", "templateType") 
      WHERE deleted = false
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS unique_study_template_type
    `).catch(() => {
      // Ignore if index doesn't exist
    });
    await queryInterface.dropTable('study_template_mapping');
  },
};