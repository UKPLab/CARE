"use strict";
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
  class UserRoleMatching extends MetaModel {
    static autoTable = true;
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      UserRoleMatching.belongsTo(models["user"], {
        foreignKey: "userId",
        as: "user",
      });
    }
  }

  UserRoleMatching.init(
    {
      id: {
        allowNull: false,
        primaryKey: true,
        type: DataTypes.INTEGER,
        autoIncrement: true,
      },
      userId: DataTypes.INTEGER,
      userRoleId: DataTypes.INTEGER,
      deleted: DataTypes.BOOLEAN,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
    },
    {
      sequelize: sequelize,
      modelName: "user_role_matching",
      tableName: "user_role_matching",
      hooks: {
        afterCreate: async (userRole, options) => {
          const User = options.transaction.sequelize.models["user"];
          try {
            await User.update(
              { rolesUpdatedAt: new Date() },
              {
                where: { id: userRole.userId },
                transaction: options.transaction,
              }
            );
          } catch (error) {
            console.log(error);
          }
        },
        afterDestroy: async (userRole, options) => {
          const User = options.transaction.sequelize.models["user"];
          try {
            await User.update(
              { rolesUpdatedAt: new Date() },
              {
                where: { id: userRole.userId },
                transaction: options.transaction,
              }
            );
          } catch (error) {
            console.log(error);
          }
        },
      },
    }
  );

  return UserRoleMatching;
};
