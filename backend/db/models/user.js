"use strict";
const MetaModel = require("../MetaModel.js");
const { Op } = require("sequelize");
const { genSalt, genPwdHash } = require("../../utils/auth.js");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

module.exports = (sequelize, DataTypes) => {
  class User extends MetaModel {
    static roleIdMap = null;
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
     * Retrieves or creates a map of role names to role Ids.
     * @returns {Promise<Object>} - an object that maps role names to role Ids.
     */
    static async getRoleIdMap() {
      if (!this.roleIdMap) {
        const roles = await this.sequelize.models["user_role"].findAll({
          attributes: ["id", "name"],
          raw: true,
        });
        this.roleIdMap = roles.reduce((acc, role) => {
          acc[role.name] = role.id;
          return acc;
        }, {});
      }
      return this.roleIdMap;
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
     * Get users' email
     * @param {string[]} emails a list of emails
     * @returns {Promise<array>} a list of emails
     */
    static async getUsersEmail(emails) {
      return await User.findAll({
        where: {
          email: {
            [Op.in]: emails,
          },
        },
        attributes: ["email"],
        raw: true,
      });
    }

    /**
     * Register a new login
     * @param {string} userId user id
     * @returns {Promise<boolean>}} true if successful
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
     * @param {string} roleName - The role of the users to fetch.
     * @returns {string[]} An array of users with the specified role.
     */
    async getUsersByRole(roleName) {
      try {
        const roleIdMap = await User.getRoleIdMap();
        const roleId = roleIdMap[roleName];

        if (!roleId) {
          console.error(`Role not found: ${roleName}`);
          return [];
        }

        const matchedUsers = await this.sequelize.models["user_role_matching"].findAll({
          where: { userRoleId: roleId },
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
     * @returns {Object<string, array>}
     */
    static async getUserRight(userId) {
      try {
        let roles = await this.sequelize.models["user_role_matching"].findAll({
          where: { userId },
          raw: true,
        });
        if (roles.length === 0) {
          return {};
        }
        roles = roles.map((role) => role.userRoleId);
        let userRight = {};
        await Promise.all(
          roles.map(async (role) => {
            const matchedRoles = await this.sequelize.models["role_right_matching"].findAll({
              where: { userRoleId: role },
              raw: true,
            });

            userRight[role] = matchedRoles.map((role) => role.userRightName);
          })
        );
        return userRight;
      } catch (error) {
        console.error(error);
      }
    }

    /**
     * Get specific user's details
     * @param {number} userId - The ID of the user
     * @returns {Object}
     */
    static async getUserDetails(userId) {
      try {
        const roleIdMap = await User.getRoleIdMap();
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
              model: this.sequelize.models["user_role_matching"],
              as: "roles",
              attributes: ["userRoleId"],
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
        userDetails.roles = userDetails.roles.map((role) => {
          const roleName = Object.keys(roleIdMap).find((key) => roleIdMap[key] === role.userRoleId);
          return roleName;
        });
        return userDetails;
      } catch (error) {
        console.error(error);
      }
    }

    /**
     * Updates user's details
     * @param {number} userId - The ID of the user
     * @param {Object} userData - Includes firstName, lastName, email, roles
     * @returns {Promise<void>}
     */
    static async updateUserDetails(userId, userData) {
      const transaction = await sequelize.transaction();
      const UserRoleMatching = this.sequelize.models["user_role_matching"];
      try {
        const roleIdMap = await User.getRoleIdMap();
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
        const currentRoleIds = currentRoles.map((role) => role.userRoleId);
        const currentRoleNames = currentRoleIds.map((id) =>
          Object.keys(roleIdMap).find((key) => roleIdMap[key] === id)
        );

        const rolesToAdd = userData.roles.filter((roleName) => !currentRoleNames.includes(roleName));
        const rolesToRemove = currentRoleIds.filter(
          (roleId) => !userData.roles.includes(Object.keys(roleIdMap).find((key) => roleIdMap[key] === roleId))
        );

        // Add new roles
        await Promise.all(
          rolesToAdd.map((roleName) =>
            UserRoleMatching.create({ userId, userRoleId: roleIdMap[roleName] }, { transaction })
          )
        );

        // Remove roles
        await UserRoleMatching.destroy({
          where: {
            userId,
            userRoleId: rolesToRemove,
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

    /**
     * Update user's consent data
     * @param {number} userId - ID of the user
     * @param {Object} consentData - The consent data object
     * @param {boolean} consentData.acceptTerms - Indicates whether the user has consented to the terms of service
     * @param {boolean} consentData.acceptStats - Indicates whether the user has agreed to tracking
     * @param {boolean} consentData.acceptDataSharing - Indicates whether the user has agreed to donate their annotation data
     * @param {string} consentData.acceptedAt - Time when the user made the consent
     * @returns {void}
     */
    static async updateUserConsent(userId, consentData) {
      try {
        const [updatedRowsCount] = await User.update(consentData, {
          where: { id: userId },
          returning: true,
        });
        if (updatedRowsCount === 0) {
          this.logger.error("Failed to update user: User not found");
          return;
        }
      } catch (error) {
        this.logger.error("Failed to update user: " + error);
      }
    }

    static async bulkCreateUsers(users) {
      try {
        const createdUsers = [];
        for (const user of users) {
          // Generate a password using UUID (8 characters)
          const password = uuidv4().replace(/-/g, "").substring(0, 8);
          const salt = genSalt();
          const pwdHash = await genPwdHash(password, salt);

          // Create the user
          const createdUser = await User.create({
            firstName: user.firstname,
            lastName: user.lastname,
            // TODO: Generate random user name
            userName: user.firstname,
            // FIXME: email should be unique
            email: user.email,
            passwordHash: pwdHash,
            salt,
            acceptTerms: false,
            acceptStats: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Find and assign roles
          const assignedRoles = [];
          const userRoles = user.roles.split(", ");
          for (const roleName of userRoles) {
            const userRole = await this.sequelize.models["user_role"].findOne({ where: { name: roleName } });
            if (!userRole) {
              continue;
            }

            await this.models["user_role_matching"].create({
              userId: createdUser.id,
              userRoleId: userRole.id,
            });
            assignedRoles.push(roleName);
          }

          createdUsers.push({
            id: createdUser.id,
            firstname: createdUser.firstName,
            lastname: createdUser.lastName,
            username: createdUser.userName,
            email: createdUser.email,
            roles: assignedRoles.join(", "),
            password,
          });
        }

        // Generate CSV content
        const headers = ["id", "firstname", "lastname", "username", "email", "roles", "password"];
        let csvContent = headers.join(",") + "\n";
        createdUsers.forEach((user) => {
          csvContent += headers.map((header) => `"${user[header]}"`).join(",") + "\n";
        });

        // Generate a unique filename
        const filename = `users_${Date.now()}.csv`;
        const csvFilePath = path.join(__dirname, "..", "..", "temp", filename);

        // Ensure the temp directory exists
        await fs.mkdir(path.dirname(csvFilePath), { recursive: true });

        // Write CSV content to file
        await fs.writeFile(csvFilePath, csvContent, "utf8");
        return {
          filename,
          url: `/download/temp/${filename}`,
        };
      } catch (error) {
        this.logger.error("Failed to bulk update users: " + error);
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
      acceptDataSharing: DataTypes.BOOLEAN,
      salt: DataTypes.STRING,
      deleted: DataTypes.BOOLEAN,
      lastLoginAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      acceptedAt: DataTypes.DATE,
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
