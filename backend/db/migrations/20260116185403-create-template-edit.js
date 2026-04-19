"use strict";

/**
 * Migration to create template_edit table.
 *
 * This table stores draft edits for templates (like document_edit does for documents).
 * Enables stable content for resolution/viewing while owner sees live edits.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("template_edit", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      templateId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "template", key: "id" },
        onDelete: "CASCADE",
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      draft: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      offset: {
        type: Sequelize.INTEGER,
      },
      operationType: {
        type: Sequelize.INTEGER, // 0: Insert, 1: Delete, 2: Attribute-Change
      },
      span: {
        type: Sequelize.INTEGER,
      },
      text: {
        type: Sequelize.STRING,
      },
      attributes: {
        type: Sequelize.JSONB,
      },
      order: {
        type: Sequelize.INTEGER,
      },
      language: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      deleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("template_edit");
  },
};
