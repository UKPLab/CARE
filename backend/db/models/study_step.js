'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
  class StudyStep extends MetaModel {
    static autoTable = true;

    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
        // define association here
    }
  }

  StudyStep.init({
      studyId: DataTypes.INTEGER,
      workflowStepId: DataTypes.INTEGER,
      documentId: DataTypes.INTEGER
    }, {
      sequelize,
      modelName: 'study_step',
      tableName: 'study_step'
    }
  );

  return StudyStep;
};