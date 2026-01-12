'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
  /**
   * Template Placeholder Mapping model
   * Stores placeholder definitions for template types
   */
  class TemplatePlaceholderMapping extends MetaModel {
    static autoTable = true;

    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // No association
    }
  }

  TemplatePlaceholderMapping.init(
    {
      templateType: DataTypes.INTEGER,
      placeholderKey: DataTypes.STRING,
      placeholderLabel: DataTypes.STRING,
      placeholderType: DataTypes.STRING,
      required: DataTypes.BOOLEAN,
      deleted: DataTypes.BOOLEAN,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "template_placeholder_mapping",
      tableName: "template_placeholder_mapping",
    }
  );

  return TemplatePlaceholderMapping;
};