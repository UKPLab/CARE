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
    creator: DataTypes.STRING,
    text: DataTypes.STRING,
    tags: DataTypes.STRING,
    shared: DataTypes.BOOLEAN,
    document: DataTypes.STRING,
    selectors: DataTypes.JSONB,
    references: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'annotation',
  });
  return annotation;
};