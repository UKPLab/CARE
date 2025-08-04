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

    /**
     * Gets user roles by user Id.
     * 
     * @param {number} userId user ID to search roles for
     * @returns {Promise<number[]>} An array of user role IDs.
     */
    static async getUserRolesById(userId) {
        const userRoles = await sequelize.models.user_role_matching.findAll({
            where: {userId: userId},
            raw: true,
        });
        return userRoles.map((role) => role.userRoleId);
    }

    /**
     * Checks whether if at least one of roles in roleIds is admin.
     * @param {object} roleIds Array of role Ids to check admin rights
     * @returns {Promise<boolean>} True if at least one role is admin
     */
    static async isAdminInUserRoles(roleIds) {
        // Get the admin role Id
        const adminRole = await sequelize.models.user_role.findOne({
            where: {name: "admin"},
            attributes: ["id"],
            raw: true
        })
        return roleIds.includes(adminRole.id);
    }

    /**
     * Checks if all roleIds have matching with the right
     * @param {object} roleIds The roleIds to look up in the table
     * @param {string} right The name of the right to check
     * @returns {Promise<boolean>} If roleIds have access to this right
     */
    static async hasAccessByUserRoles(roleIds, right) {
        return await Promise.all(
            roleIds.map(async (roleId) => {
                const matchedRoles = await sequelize.models.role_right_matching.findAll({
                    where: {userRoleId: roleId},
                    raw: true,
                });
                return matchedRoles.some((matchedRole) => matchedRole.userRightName === right);
            })
        ).then((results) => results.some((r) => Boolean(r)));
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
          try {
            await sequelize.models.user.update(
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
          try {
            await sequelize.models.user.update(
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