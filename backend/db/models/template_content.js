'use strict';
const MetaModel = require("../MetaModel.js");

/**
 * TemplateContent model for storing template content per language.
 * Each row holds content for one (templateId, language) pair.
 * Draft edits for a language are merged into this content when the editor is closed.
 *
 */
module.exports = (sequelize, DataTypes) => {
  class TemplateContent extends MetaModel {
    static autoTable = false;

    static associate(models) {
      TemplateContent.belongsTo(models["template"], {
        foreignKey: "templateId",
        as: "template",
      });
    }

    /**
     * One content row for a template language, excluding soft-deleted rows.
     *
     * @param {number} templateId
     * @param {string} language
     * @param {Object} [options]
     * @returns {Promise<Object|null>}
     */
    static async getByTemplateIdAndLanguage(templateId, language, options = {}) {
      return await this.findOne({
        where: { templateId, language, deleted: false },
        raw: true,
        ...options,
      });
    }

    /**
     * Language codes a template has content for, sorted.
     *
     * @param {number} templateId
     * @param {Object} [options]
     * @returns {Promise<Array<string>>}
     */
    static async getLanguages(templateId, options = {}) {
      const rows = await this.findAll({
        where: { templateId, deleted: false },
        attributes: ["language"],
        raw: true,
        ...options,
      });
      return rows.map((row) => row.language).sort();
    }
  }

  TemplateContent.init(
    {
      templateId: DataTypes.INTEGER,
      language: DataTypes.STRING,
      content: DataTypes.JSONB,
      deleted: DataTypes.BOOLEAN,
      deletedAt: DataTypes.DATE,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "template_content",
      tableName: "template_content",
    }
  );

  return TemplateContent;
};

