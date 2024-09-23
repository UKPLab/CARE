const Socket = require("../Socket.js");

/**
 * Handle user through websocket
 *
 * @author Nils Dycke, Dennis Zyska, Linyin Huang
 * @type {UserSocket}
 */
module.exports = class UserSocket extends Socket {
  /**
   * Adds the username as creator_name of a database entry with column creator
   *
   * Accepts data as a list of objects or a single object
   * Note: Always returns a list of objects
   *
   * @param {object|object[]} data - The data to update
   * @param {string} key - The key of the user ID field
   * @param {string} targetName - The name of the target field
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
   * Shows only specific fields of a user
   * @param {object} user - The user object
   * @return {{[p: string]: any}}
   */
  minimalFields(user) {
    let include = ["id", "userName"];
    if (this.isAdmin()) {
      include.push("lastLoginAt", "acceptStats");
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
        this.logger.error("This user does not have the right to load users by their role.");
        return;
      }

      return role === "all" ? await this.models["user"].getAllUsers() : await this.models["user"].getUsersByRole(role);
    } catch (error) {
      this.logger.error(error);
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
        this.logger.error("DB error while loading all users from database" + JSON.stringify(e));
      }
    });

    // Update user's consent
    this.socket.on("userUpdateConsent", async (consentData, callback) => {
      try {
        await this.models["user"].updateUserConsent(this.userId, consentData);
        callback({
          success: true,
          message: "Successfully updated user consent!",
        });
      } catch (error) {
        callback({
          success: false,
          message: "Failed to updated user consent!",
        });
        this.logger.error(error);
      }
    });

    // Get users by their role
    this.socket.on("userGetByRole", async (role) => {
      try {
        const users = await this.getUsers(role);
        this.socket.emit("userByRole", {
          success: true,
          users,
        });
      } catch (error) {
        const errorMsg = "User rights and request parameter mismatch";
        this.socket.emit("userByRole", {
          success: false,
          message: errorMsg,
        });
        this.logger.error(errorMsg);
      }
    });

    // Get specific user's details
    this.socket.on("userGetDetails", async (userId) => {
      try {
        const user = await this.models["user"].getUserDetails(userId);
        this.socket.emit("userDetails", {
          success: true,
          user,
        });
      } catch (error) {
        this.socket.emit("userDetails", {
          success: false,
          message: "Failed to load user details",
        });
        this.logger.error(error);
      }
    });

    // Get right associated with the user
    this.socket.on("userGetRight", async (userId) => {
      try {
        const userRight = await this.models["user"].getUserRight(userId);
        this.socket.emit("userRight", {
          success: true,
          userRight,
        });
      } catch (error) {
        this.socket.emit("userRight", {
          success: false,
          message: "Failed to get user right",
        });
        this.logger.error(error);
      }
    });

    // Update user's following data: firstName, lastName, email, roles
    this.socket.on("userUpdateDetails", async (data, callback) => {
      const { userId, userData } = data;
      try {
        await this.models["user"].updateUserDetails(userId, userData);
        callback({
          success: true,
          message: "Successfully updated user!",
        });
      } catch (error) {
        callback({
          success: false,
          message: "Failed to update user details",
        });
        this.logger.error(error);
      }
    });

    // Reset user's password
    this.socket.on("userResetPwd", async (data, callback) => {
      const { userId, password } = data;
      try {
        await this.models["user"].resetUserPwd(userId, password);
        callback({
          success: true,
          message: "Successfully reset password!",
        });
      } catch (error) {
        callback({
          success: false,
          message: "Failed to reset password",
        });
        this.logger.error(error);
      }
    });

    this.socket.on("userCheckDuplicates", async (users, callback) => {
      try {
        const emails = users.map((user) => user.email);
        const existingEmails = await this.models["user"].getUsersEmail(emails);
        const duplicateEmails = existingEmails.map((item) => item.email);
        users.forEach((user) => {
          user.status = duplicateEmails.includes(user.email) ? "duplicate" : "new";
        });
        callback({
          success: true,
          users,
        });
      } catch (error) {
        callback({
          success: false,
          message: "Failed to check for duplicate users",
        });
        this.logger.error(error);
      }
    });
  }
};
