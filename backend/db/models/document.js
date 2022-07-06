'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class document extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  document.init({
    name: DataTypes.STRING,
    hash: DataTypes.STRING,
    creator: DataTypes.INTEGER,
    updatedAt: DataTypes.DATE,
    deleted: DataTypes.BOOLEAN,
    deletedAt: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'document',
  });
  return document;
};