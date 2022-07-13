'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class annotation extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  annotation.init({
    hash: DataTypes.STRING,
    creator: DataTypes.STRING,
    text: DataTypes.STRING,
    tags: DataTypes.STRING,
    document: DataTypes.STRING,
    selectors: DataTypes.JSONB,
    draft: DataTypes.BOOLEAN,
    deleted: DataTypes.BOOLEAN,
    deletedAt: DataTypes.DATE,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'annotation',
    tableName: 'annotation'
  });
  return annotation;
};