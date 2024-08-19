"use strict";
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
  class RoleRightMatching extends MetaModel {
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

  RoleRightMatching.init(
    {
      userRoleId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: {
          model: "user_role",
          key: "id",
        },
      },
      userRightName: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
        references: {
          model: "user_right",
          key: "name",
        },
      },
      deleted: DataTypes.BOOLEAN,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
    },
    {
      sequelize: sequelize,
      modelName: "role_right_matching",
      tableName: "role_right_matching",
    }
  );
  return RoleRightMatching;
};
