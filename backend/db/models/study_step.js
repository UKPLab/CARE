'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
  class StudyStep extends MetaModel {
    static autoTable = true;
    // TODO documentId festlegen für einzelne Schritte, wenn id verlangt wird
    static fields = [
      {
          key: "documentId",
          label: "Select Document",
          type: "select",  
          options: {
              table: "document", 
              id: "documentId",
              name: "name"  
          },
          required: true,
      },
    ];
    

    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
        // define association here
        StudyStep.belongsTo(models["study"], {
          foreignKey: "studyId",
          as: "study",
        });
  
        StudyStep.belongsTo(models["workflow_step"], {
          foreignKey: "workflowStepId",
          as: "workflowStep",
        });

        StudyStep.belongsTo(models["document"], {
          foreignKey: "documentId",
          as: "document",
        });
    }
  }

  StudyStep.init({
      studyId: DataTypes.INTEGER,
      workflowStepId: DataTypes.INTEGER,
      documentId: DataTypes.INTEGER,
      deleted: DataTypes.BOOLEAN,
      deletedAt: DataTypes.DATE,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    }, {
      sequelize,
      modelName: 'study_step',
      tableName: 'study_step'
    }
  );

  return StudyStep;
};