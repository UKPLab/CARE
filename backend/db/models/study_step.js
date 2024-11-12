'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
  class StudyStep extends MetaModel {
    static autoTable = true;
    static fields = [
      {
          key: "documentId",
          label: "Select Document",
          type: "select",  
          options: {
              table: "document", 
              id: "documentId",
              name: "name",
              filter: [
                { key: "hideInFrontend", value: true },
                // Additional filter objects can be added as needed
              ],
              relatedTable: {
                table: "workflow_step", 
                foreignKey: "workflowId", 
                id: "id",               
                name: "name"            
              }
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

        StudyStep.belongsTo(models["study_step"], {
        foreignKey: "studyStepPrevious",
        as: "previousStep",
      });
    }
  }

  StudyStep.init({
      studyId: DataTypes.INTEGER,
      workflowStepId: DataTypes.INTEGER,
      documentId: DataTypes.INTEGER,
      studyStepPrevious: DataTypes.INTEGER,
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