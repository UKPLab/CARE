'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
  class WorkflowStep extends MetaModel {
    static autoTable = true;

    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      WorkflowStep.belongsTo(models["workflow"], {
        foreignKey: "workflowId",
        as: "workflow"
      });

      WorkflowStep.belongsTo(models["workflow_step"], {
        foreignKey: "workflowStepPrevious", 
        as: "previousStep", 
      });

      WorkflowStep.belongsTo(models["workflow_step"], {
        foreignKey: "workflowStepDocument", 
        as: "documentStep", 
      });

    }
  }

  WorkflowStep.init({
      workflowId: DataTypes.INTEGER,
      stepType: DataTypes.INTEGER,
      workflowStepPrevious: DataTypes.INTEGER,
      allowBackward: DataTypes.BOOLEAN,
      workflowStepDocument: DataTypes.INTEGER,
      configuration: DataTypes.JSONB,
      deleted: DataTypes.BOOLEAN,
      deletedAt: DataTypes.DATE,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    }, {
      sequelize,
      modelName: 'workflow_step',
      tableName: 'workflow_step'
    }
  );

  return WorkflowStep;
};