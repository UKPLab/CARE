'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
  class Workflow extends MetaModel {
    static autoTable = true;
    static publicTable = true;

    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Workflow.hasMany(models["workflow_step"], {
        foreignKey: "workflowId",
        as: "steps",
        onDelete: "CASCADE"
      });
      Workflow.hasMany(models["study"], {
        foreignKey: "workflowId",
        as: "studies"
      });
    }
  }

  Workflow.init({
      name: DataTypes.STRING,
      description: DataTypes.TEXT,
      deleted: DataTypes.BOOLEAN,
      deletedAt: DataTypes.DATE,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    }, {
      sequelize,
      modelName: 'workflow',
      tableName: 'workflow'
    }
  );

  return Workflow;
};