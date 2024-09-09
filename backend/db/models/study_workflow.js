'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
  class StudyWorkflow extends MetaModel {
    static autoTable = true;

    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      StudyWorkflow.hasMany(models["study_workflow_step"], {
        foreignKey: "studyWorkflowId",
        as: "steps",
        onDelete: "CASCADE"
      });
      StudyWorkflow.hasMany(models["study"], {
        foreignKey: "studyWorkflowId",
        as: "studies"
      });
    }
  }

  StudyWorkflow.init({
      name: DataTypes.STRING,
      description: DataTypes.TEXT,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    }, {
      sequelize,
      modelName: 'study_workflow',
      tableName: 'study_workflow'
    }
  );

  return StudyWorkflow;
};