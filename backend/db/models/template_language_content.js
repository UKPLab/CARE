'use strict';
const MetaModel = require("../MetaModel.js");

/**
 * TemplateLanguageContent model for storing template content per language.
 * Each row holds content for one (templateId, language) pair.
 * Draft edits for a language are merged into this content when the editor is closed.
 *
 */
module.exports = (sequelize, DataTypes) => {
  class TemplateLanguageContent extends MetaModel {
    static autoTable = false;

    static associate(models) {
      TemplateLanguageContent.belongsTo(models["template"], {
        foreignKey: "templateId",
        as: "template",
      });
    }
  }

  TemplateLanguageContent.init(
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
      modelName: "template_language_content",
      tableName: "template_language_content",
    }
  );

  return TemplateLanguageContent;
};
