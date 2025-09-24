'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
  class Workflow extends MetaModel {
    static autoTable = {
            foreignTables: [{
                table: "workflow_step",
                by: "workflowId"
            }]
        };
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
      // Self-referencing association for workflow versioning
      Workflow.belongsTo(models["workflow"], {
        foreignKey: "parentWorkflowId",
        as: "parentWorkflow"
      });
      Workflow.hasMany(models["workflow"], {
        foreignKey: "parentWorkflowId",
        as: "childWorkflows"
      });
    }
  }

  Workflow.init({
      name: DataTypes.STRING,
      description: DataTypes.TEXT,
      deleted: DataTypes.BOOLEAN,
      deletedAt: DataTypes.DATE,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      parentWorkflowId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'workflow',
          key: 'id'
        }
      },
      hideInFrontend: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      }
    }, {
      sequelize,
      modelName: 'workflow',
      tableName: 'workflow'
    }
  );

  return Workflow;
};