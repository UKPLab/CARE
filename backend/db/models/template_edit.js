"use strict";
const MetaModel = require("../MetaModel.js");

/**
 * TemplateEdit model for storing draft edits on templates
 *
 * This model mirrors document_edit and enables the draft/save mechanism for templates.
 * Draft edits (draft=true) are merged into template.content when the editor is closed.
 *
 * @author Mohammad Elwan
 */
module.exports = (sequelize, DataTypes) => {
  class TemplateEdit extends MetaModel {
    // No need to sync to frontend - internal use only
    static autoTable = false;

    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      TemplateEdit.belongsTo(models["template"], {
        foreignKey: "templateId",
        as: "template",
      });
    }
  }

  TemplateEdit.init(
    {
      userId: DataTypes.INTEGER,
      templateId: DataTypes.INTEGER,
      draft: DataTypes.BOOLEAN,
      offset: DataTypes.INTEGER,
      operationType: DataTypes.INTEGER, // 0: Insert, 1: Delete, 2: Attribute-Change (only retain)
      span: DataTypes.INTEGER,
      text: DataTypes.STRING,
      attributes: DataTypes.JSONB,
      order: DataTypes.INTEGER,
      deleted: DataTypes.BOOLEAN,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
    },
    {
      sequelize: sequelize,
      modelName: "template_edit",
      tableName: "template_edit",
    }
  );
  return TemplateEdit;
};
