"use strict";
const MetaModel = require("../MetaModel.js");
const { Op } = require("sequelize");
const { genSalt, genPwdHash } = require("../../utils/auth.js");

module.exports = (sequelize, DataTypes) => {
  class User extends MetaModel {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      User.hasMany(models["user_role_matching"], {
        foreignKey: "userId",
        as: "roles",
      });
    }

    /**
     * Find a user by username or email
     * @param {string} userName username or email
     * @returns {Promise<object>} user
     */
    static async find(userName) {
      try {
        return await this.findOne({
          where: {
            [Op.or]: [
              {
                userName: userName,
              },
              {
                email: userName,
              },
            ],
          },
          raw: true,
        });
      } catch (err) {
        console.log("Error in User.find: " + err);
      }
    }

    /**
     * Get user id by username or email
     * @param {string} userName username or email
     * @returns {Promise<integer>} user id
     */
    static async getUserIdByName(userName) {
      const user = await User.find(userName);
      if (user) {
        return user.id;
      } else {
        return 0;
      }
    }

    /**
     * Get user name by id
     * @param {number} userId user id
     * @returns {Promise<string>} user name
     */
    static async getUserName(userId) {
      try {
        const user = await User.getById(userId);
        if (user) {
          return user.userName;
        } else {
          return "System";
        }
      } catch (e) {
        console.log(e);
      }
    }

    /**
     * Get user id by email
     * @param {string} email email
     * @returns {Promise<integer>}} user id
     */
    static async getUserIdByEmail(email) {
      const user = await User.getByKey("email", email);
      if (user) {
        return user.id;
      } else {
        return 0;
      }
    }

    /**
     * Register a new login
     * @param {string} userId user id
     * @returns {Promise<boolean>}} true if successufl
     */
    static async registerUserLogin(userId) {
      try {
        const updatedObject = await this.update(
          { lastLoginAt: Date.now() },
          {
            where: {
              id: userId,
            },
            returning: true,
            plain: true,
          }
        );
        return updatedObject !== null && updatedObject !== undefined;
      } catch (e) {
        console.log(e);
      }
    }

    /**
     * Get all users
     * @returns {string[]} An array of all users.
     */
    static async getAllUsers() {
      try {
        return await User.getAll(false, ["passwordHash", "salt"]);
      } catch (error) {
        console.error(error);
      }
    }

    /**
     * Get users by their role
     * @param {string} role - The role of the users to fetch.
     * @param {Object} models - Sequelize models
     * @returns {string[]} An array of users with the specified role.
     */
    async getUsersByRole(role, models) {
      try {
        const matchedUsers = await models["user_role_matching"].findAll({
          where: { userRoleName: role },
          attributes: ["userId"],
          raw: true,
        });
        const userIds = matchedUsers.map((user) => user.userId);
        return await User.findAll({
          attributes: {
            exclude: ["passwordHash", "salt"],
          },
          where: {
            id: { [Op.in]: userIds },
          },
          raw: true,
        });
      } catch (error) {
        console.error(error);
      }
    }

    /**
     * Gets the rights associated with the user
     * @param {number} userId - The ID of the user
     * @param {Object} models - Sequelize models
     * @returns {Object<string, array>}
     */
    static async getUserRight(userId, models) {
      try {
        let roles = await models["user_role_matching"].findAll({
          where: { userId },
          raw: true,
        });
        if (roles.length === 0) {
          return {};
        }
        roles = roles.map((role) => role.userRoleName);
        let userRight = {};
        await Promise.all(roles.map(async (role) => {
          const matchedRoles = await models["role_right_matching"].findAll({
            where: { userRoleName: role },
            raw: true,
          });
    
          userRight[role] = matchedRoles.map((role) => role.userRightName);
        }));
        return userRight;
      } catch (error) {
        console.error(error);
      }
    }

    /**
     * Get specific user's details
     * @param {number} userId - The ID of the user
     * @param {Object} models - Sequelize models
     * @returns {Object}
     */
    static async getUserDetails(userId, models) {
      try {
        const user = await User.findOne({
          where: {
            id: userId,
            deleted: false,
          },
          attributes: {
            exclude: ["passwordHash", "salt", "deleted"],
          },
          include: [
            {
              model: models["user_role_matching"],
              as: "roles",
              attributes: ["userRoleName"],
              where: {
                deleted: false,
              },
              // Ensures we get the user even if they have no roles
              required: false,
            },
          ],
        });

        if (!user) {
          console.error("User not found");
          return;
        }
        const userDetails = user.get({ plain: true });
        userDetails.roles = userDetails.roles.map((role) => role.userRoleName);
        return userDetails;
      } catch (error) {
        console.error(error);
      }
    }

    /**
     * Updates user's details
     * @param {number} userId - The ID of the user
     * @param {Object} userData - Includes firstName, lastName, email, roles
     * @param {Object} models - Sequelize models
     * @returns {Promise<void>}
     */
    static async updateUserDetails(userId, userData, models) {
      const transaction = await sequelize.transaction();
      const UserRoleMatching = models["user_role_matching"];
      try {
        const [updatedRowsCount] = await User.update(
          {
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email,
          },
          {
            where: { id: userId },
            returning: true,
            transaction,
          }
        );

        if (updatedRowsCount === 0) {
          console.error("Failed to update user: User not found");
          return;
        }

        // Get current roles
        const currentRoles = await UserRoleMatching.findAll({
          where: { userId },
          transaction,
        });

        // Determine roles to add and remove
        const currentRoleNames = currentRoles.map((role) => role.userRoleName);
        const rolesToAdd = userData.roles.filter((role) => !currentRoleNames.includes(role));
        const rolesToRemove = currentRoleNames.filter((role) => !userData.roles.includes(role));

        // Add new roles
        await Promise.all(rolesToAdd.map((role) => UserRoleMatching.create({ userId, userRoleName: role }, { transaction })));

        // Remove roles
        await UserRoleMatching.destroy({
          where: {
            userId,
            userRoleName: rolesToRemove,
          },
          individualHooks: true,
          transaction,
        });
        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        console.error("Failed to update user: " + error);
      }
    }

    /**
     * Resets user's password
     * @param {number} userId - The ID of the user
     * @param {string} pwd - The new password
     * @returns {Promise<void>}
     */
    static async resetUserPwd(userId, pwd) {
      try {
        const salt = genSalt();
        const passwordHash = await genPwdHash(pwd, salt);
        const [updatedRowsCount] = await User.update(
          { passwordHash, salt },
          {
            where: { id: userId },
            returning: true,
          }
        );

        if (updatedRowsCount === 0) {
          console.log("Failed to update user: User not found");
          return;
        }
      } catch (error) {
        console.log(error);
      }
    }
  }

  User.init(
    {
      firstName: DataTypes.STRING,
      lastName: DataTypes.STRING,
      userName: DataTypes.STRING,
      email: DataTypes.STRING,
      passwordHash: DataTypes.STRING,
      acceptTerms: DataTypes.BOOLEAN,
      acceptStats: DataTypes.BOOLEAN,
      salt: DataTypes.STRING,
      deleted: DataTypes.BOOLEAN,
      lastLoginAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      rolesUpdatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "user",
      tableName: "user",
    }
  );

  return User;
};
