'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class tags extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  tags.init({
    name: DataTypes.STRING,
    description: DataTypes.STRING,
    colorCode: DataTypes.STRING,
    userId: DataTypes.INTEGER,
    public: DataTypes.BOOLEAN,
    updatedAt: DataTypes.DATE,
    setId: DataTypes.INTEGER,
    deleted: DataTypes.BOOLEAN,
    deletedAt: DataTypes.DATE,
    createdAt: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'tag',
    tableName: 'tag'
  });
  return tags;
};