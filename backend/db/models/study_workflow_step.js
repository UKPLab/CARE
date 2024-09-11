'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
  class StudyWorkflowStep extends MetaModel {
    static autoTable = true;

    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      StudyWorkflowStep.belongsTo(models["study_workflow"], {
        foreignKey: "studyWorkflowId",
        as: "workflow"
      });
    }
  }

  StudyWorkflowStep.init({
      studyWorkflowId: DataTypes.INTEGER,
      stepType: DataTypes.INTEGER,
      order: DataTypes.INTEGER,
      configuration: DataTypes.JSONB,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    }, {
      sequelize,
      modelName: 'study_workflow_step',
      tableName: 'study_workflow_step'
    }
  );

  return StudyWorkflowStep;
};