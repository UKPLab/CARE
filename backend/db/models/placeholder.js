'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
  /**
   * Placeholder model
   * Stores placeholder definitions for different placeholders (e.g. template placeholders).
   */
  class Placeholder extends MetaModel {
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

  Placeholder.init(
    {
      type: DataTypes.INTEGER,
      placeholderKey: DataTypes.STRING,
      placeholderLabel: DataTypes.STRING,
      placeholderDescription: DataTypes.TEXT,
      placeholderExample: DataTypes.TEXT,
      placeholderType: DataTypes.STRING,
      required: DataTypes.BOOLEAN,
      deleted: DataTypes.BOOLEAN,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "placeholder",
      tableName: "placeholder",
    }
  );

  return Placeholder;
};

