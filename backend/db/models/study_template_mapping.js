'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
  /**
   * Study Template Mapping model
   * Stores email template associations for studies
   */
  class StudyTemplateMapping extends MetaModel {
    static autoTable = true;

    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      StudyTemplateMapping.belongsTo(models["study"], {
        foreignKey: "studyId",
        as: "study",
      });
      StudyTemplateMapping.belongsTo(models["template"], {
        foreignKey: "templateId",
        as: "template",
      });
    }
  }

  StudyTemplateMapping.init(
    {
      studyId: DataTypes.INTEGER,
      templateType: DataTypes.STRING,
      templateId: DataTypes.INTEGER,
      deleted: DataTypes.BOOLEAN,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "study_template_mapping",
      tableName: "study_template_mapping",
    }
  );

  return StudyTemplateMapping;
};