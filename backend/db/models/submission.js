'use strict';
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
  class Submission extends MetaModel {

    static autoTable = true;               // enables CRUD helpers

    static fields = [ /* BUILD THE UI FORM IF NEEDED */ ];

    static associate(models) {
      // 1 submission → many documents
      Submission.hasMany(models['document'], {
        foreignKey: 'submissionId',
        as        : 'documents'
      });

      // parent-child chain
      Submission.belongsTo(models['submission'], {
        foreignKey: 'parentSubmissionId',
        as        : 'parentSubmission'
      });
    }
  }

  Submission.init({
    userId           : DataTypes.INTEGER,
    createdByUserId  : DataTypes.INTEGER,
    projectId        : DataTypes.INTEGER,
    parentSubmissionId: DataTypes.INTEGER,
    extId            : DataTypes.STRING,
    deleted          : DataTypes.BOOLEAN,
    deletedAt        : DataTypes.DATE,
    createdAt        : DataTypes.DATE,
    updatedAt        : DataTypes.DATE
  }, {
    sequelize,
    modelName: 'submission',
    tableName: 'submission'
  });

  return Submission;
};