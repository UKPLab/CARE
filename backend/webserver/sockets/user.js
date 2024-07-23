const Socket = require("../Socket.js");
const { Op } = require("sequelize");
const db = require("../../db/index.js");
const { genSalt, genPwdHash } = require("../../utils/auth.js");

/**
 * Handle user through websocket
 *
 * @author Nils Dycke, Dennis Zyska, Linyin Huang
 * @type {UserSocket}
 */
module.exports = class UserSocket extends Socket {
  /**
   * Add username as creator_name of an database entry with column creator
   *
   * Accept data as list of objects or single object
   * Note: returns always list of objects!
   *
   * @param data {object|object[]} data to update
   * @param key {string} key of the user id field
   * @param targetName {string} name of the target field
   * @returns {Promise<Awaited<*&{creator_name: string|*|undefined}>[]>}
   */
  async updateCreatorName(data, key = "userId", targetName = "creator_name") {
    if (!Array.isArray(data)) {
      data = [data];
    }

    return Promise.all(
      data.map(async (x) => {
        return {
          ...x,
          [targetName]: await this.models["user"].getUserName(x[key]),
        };
      })
    );
  }

  /**
   * show only specific fields of a user
   * @param user
   * @return {{[p: string]: any}}
   */
  minimalFields(user) {
    let include = ["id", "userName"];
    if (this.isAdmin()) {
      include.push("lastLoginAt", "sysrole", "acceptStats");
    }

    const entries = Object.entries(user);
    const filtered = entries.filter(([k, v]) => include.indexOf(k) !== -1);

    return Object.fromEntries(filtered);
  }

  /**
   * Send all user data to the client (only for admins)
   * @return {Promise<void>}
   */
  async sendUserData() {
    if (this.isAdmin()) {
      const users = await this.models["user"].getAll();
      const mappedUsers = users.map((x) => this.minimalFields(x));

      this.socket.emit("userData", { success: true, users: mappedUsers });
    } else {
      this.socket.emit("userData", {
        success: false,
        message: "User rights and argument mismatch",
      });
      this.logger.error("User right and request parameter mismatch");
    }
  }

  /**
   * Get users by their role
   * @param {string} role - The role of the users to fetch. Possible values: "student", "mentor", "all"
   * @returns {string[]} An array of users.
   */
  async getUsers(role) {
    try {
      const rightToFetch = `backend.socket.user.getUsers.${role}`;
      if (!(await this.hasAccess(rightToFetch))) {
        this.logger.error(
          "This user is not an admin and does not have the right to load users by their role."
        );
        return;
      }

      return role === "all"
        ? await this.getAllUsers()
        : await this.getSpecificUsers(role);
    } catch (error) {
      this.logger.error(error);
    }
  }

  /**
   * Get all users
   * @returns {string[]} An array of all users.
   */
  async getAllUsers() {
    return await this.models["user"].findAll({
      attributes: {
        exclude: ["passwordHash", "salt"],
      },
      raw: true,
    });
  }

  /**
   * Get users by their role
   * @param {string} role - The role of the users to fetch.
   * @returns {string[]} An array of users with the specified role.
   */
  async getSpecificUsers(role) {
    const matchedUsers = await this.models["user_role_matching"].findAll({
      where: { userRoleName: role },
      attributes: ["userId"],
      raw: true,
    });
    const userIds = matchedUsers.map((user) => user.userId);
    return await this.models["user"].findAll({
      attributes: {
        exclude: ["passwordHash", "salt"],
      },
      where: {
        id: {
          [Op.in]: userIds,
        },
      },
      raw: true,
    });
  }

  /**
   * Get the right associated with the user
   * @returns {Object<string, array>}
   */
  async getUserRight(userId) {
    let roles = await this.models["user_role_matching"].findAll({
      where: { userId },
      raw: true,
    });
    if (roles.length === 0) return {};
    roles = roles.map((role) => role.userRoleName);
    let userRight = {};
    for (const role of roles) {
      const matchedRoles = await this.models["role_right_matching"].findAll({
        where: { userRoleName: role },
        raw: true,
      });
      Object.assign(userRight, {
        [role]: matchedRoles.map((role) => role.userRightName),
      });
    }
    return userRight;
  }

  /**
   * Get specific user's details
   * @param {number} userId
   * @returns {Object}
   */
  async getUserDetails(userId) {
    try {
      const user = await this.models["user"].findOne({
        where: {
          id: userId,
          deleted: false,
        },
        attributes: [
          "userName",
          "firstName",
          "lastName",
          "email",
          "acceptTerms",
          "acceptStats",
          "lastLoginAt",
          "createdAt",
          "updatedAt",
          "deletedAt",
        ],
        include: [
          {
            model: this.models["user_role_matching"],
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
        this.logger.error("User not found");
        return;
      }
      const userDetails = user.get({ plain: true });
      userDetails.roles = userDetails.roles.map((role) => role.userRoleName);
      return userDetails;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Update user's details
   * @param {number} userId
   * @param {Object} userData Includes firstName, lastName, email, roles
   * @returns
   */
  async updateUserDetails(userId, userData) {
    const transaction = await db.sequelize.transaction();
    const User = this.models["user"];
    const UserRoleMatching = this.models["user_role_matching"];
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
        this.logger.error("Failed to update user: User not found");
        return;
      }

      // Get current roles
      const currentRoles = await UserRoleMatching.findAll({
        where: { userId },
        transaction,
      });

      // Determine roles to add and remove
      const currentRoleNames = currentRoles.map((role) => role.userRoleName);
      const rolesToAdd = userData.roles.filter(
        (role) => !currentRoleNames.includes(role)
      );
      const rolesToRemove = currentRoleNames.filter(
        (role) => !userData.roles.includes(role)
      );

      // Add new roles
      await Promise.all(
        rolesToAdd.map((role) =>
          UserRoleMatching.create(
            { userId, userRoleName: role },
            { transaction }
          )
        )
      );

      // Remove roles
      await UserRoleMatching.destroy({
        where: {
          userId,
          userRoleName: rolesToRemove,
        },
        transaction,
      });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      this.logger.error("Failed to update user: " + error);
    }
  }

  /**
   * Reset user's password
   * @param {number} userId
   * @param {string} pwd
   * @returns
   */
  async resetUserPwd(userId, pwd) {
    const User = this.models["user"];
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
        this.logger.error("Failed to update user: User not found");
        return;
      }
    } catch (error) {
      this.logger.error("Failed to update user: " + error);
    }
  }

  init() {
    this.socket.on("userGetData", async (data) => {
      try {
        await this.sendUserData();
      } catch (e) {
        this.socket.emit("userData", {
          success: false,
          message: "Failed to retrieve all users",
        });
        this.logger.error(
          "DB error while loading all users from database" + JSON.stringify(e)
        );
      }
    });

    // Get users by their role
    this.socket.on("requestUsersByRole", async (role) => {
      try {
        const users = await this.getUsers(role);
        this.socket.emit("respondUsersByRole", {
          success: true,
          users,
        });
      } catch (error) {
        const errorMsg = "User Authority and request parameter mismatch";
        this.socket.emit("respondUsersByRole", {
          success: false,
          message: errorMsg,
        });
        this.logger.error(errorMsg);
      }
    });

    // Get specific user's details
    this.socket.on("requestUserDetails", async (userId) => {
      try {
        const user = await this.getUserDetails(userId);
        this.socket.emit("respondUserDetails", {
          success: true,
          user,
        });
      } catch (error) {
        this.socket.emit("respondUserDetails", {
          success: false,
          message: "Fail to load user details",
        });
        this.logger.error(error);
      }
    });

    // Get right associated with the user
    this.socket.on("requestUserRight", async (userId) => {
      try {
        const userRight = await this.getUserRight(userId);
        this.socket.emit("respondUserRight", {
          success: true,
          userRight,
        });
      } catch (error) {
        this.socket.emit("respondUserRight", {
          success: false,
          message: "Failed to get user right",
        });
        this.logger.error(error);
      }
    });

    // Update user's following data: firstName, lastName, email, roles
    this.socket.on("updateUserDetails", async (data, callback) => {
      const { userId, userData } = data;
      try {
        await this.updateUserDetails(userId, userData);
        callback({
          success: true,
          message: "Successfully updated user!",
        });
      } catch (error) {
        callback({
          success: false,
          message: "Fail to update user details",
        });
        this.logger.error(error);
      }
    });

    // Reset user's password
    this.socket.on("resetUserPwd", async (data, callback) => {
      const { userId, password } = data;
      try {
        await this.resetUserPwd(userId, password);
        callback({
          success: true,
          message: "Successfully reset password!",
        });
      } catch (error) {
        callback({
          success: false,
          message: "Fail to reset password",
        });
        this.logger.error(error);
      }
    });
  }
};
