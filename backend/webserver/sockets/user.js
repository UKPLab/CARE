const Socket = require("../Socket.js");

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
        return { ...x, [targetName]: await this.models["user"].getUserName(x[key]) };
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
      this.socket.emit("userData", { success: false, message: "User rights and argument mismatch" });
      this.logger.error("User right and request parameter mismatch");
    }
  }

  /**
   * Update user's consent data
   * @param {Object} consentData - The consent data object
   * @param {boolean} consentData.termsConsented - Indicates whether the user has consented to the terms of service
   * @param {boolean} consentData.trackingAgreed - Indicates whether the user has agreed to tracking
   * @param {boolean} consentData.dataShared - Indicates whether the user has agreed to donate their annotation data
   * @param {string} consentData.consentedAt -
   * @returns {void}
   */
  async updateUserConsent(consentData) {
    const User = this.models["user"];
    try {
      const [updatedRowsCount] = await User.update(consentData, {
        where: { id: this.userId },
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

  init() {
    this.socket.on("userGetData", async (data) => {
      try {
        await this.sendUserData();
      } catch (e) {
        this.socket.emit("userData", { success: false, message: "Failed to retrieve all users" });
        this.logger.error("DB error while loading all users from database" + JSON.stringify(e));
      }
    });

    this.socket.on("userUpdateConsent", async (consentData, callback) => {
      try {
        await this.updateUserConsent(consentData);
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
  }
};
