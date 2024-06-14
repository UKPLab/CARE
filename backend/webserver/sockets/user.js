const Socket = require("../Socket.js");
const { Op } = require("sequelize");

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
  }
};
