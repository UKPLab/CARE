'use strict';
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
  class UserRole extends MetaModel {
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

  UserRole.init(
    {
      name: DataTypes.STRING,
      description: DataTypes.STRING,
      deleted: DataTypes.BOOLEAN,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
      
    },
    {
      sequelize: sequelize,
      modelName: 'user_role',
      tableName: 'user_role',
    }
  );
  
  UserRole.removeAttribute('id');

  return UserRole;
};
