"use strict";
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
  class DocumentHistory extends MetaModel {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }

  DocumentHistory.init({
    userId: DataTypes.INTEGER,
    documentId: DataTypes.INTEGER,
    version: DataTypes.INTEGER,
    data: DataTypes.TEXT,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    deletedAt: DataTypes.DATE
  }, {
    sequelize: sequelize,
    modelName: "document_history",
    tableName: "document_history"
  });
  return DocumentHistory;
};
