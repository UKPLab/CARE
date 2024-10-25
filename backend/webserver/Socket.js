/**
 * Defines as new Socket class
 *
 * This class is used to create a new socket connection to the server.
 *
 * @author Dennis Zyska
 * @type {Socket}
 */
module.exports = class Socket {
  /**
   * Creates a new socket connection to the server.
   *
   * @param server - The webserver instance
   * @param io - The socket.io instance
   * @param socket - The socket.io socket instance
   */
  constructor(server, io, socket) {
    this.logger = require("../utils/logger")(
      "Socket/" + this.constructor.name,
      server.db
    );

    this.server = server;
    this.io = io;
    this.socket = socket;

    this.models = this.server.db.models;
    this.user = this.socket.request.session.passport.user;
    this.userId = this.user.id;
    // Local cache of the user's current roles.
    // Note: This cache does not automatically update.
    // A reconnection or explicit refresh is required to update roles after any changes.
    this.userRoles = [];
    // Local cache of the timestamp when the user's roles were last updated.
    // This is used to determine if the cached roles need refreshing.
    this.lastRolesUpdate = null;
    this.isUserAdmin = null;
    this.logger.defaultMeta = { userId: this.userId };
    this.autoTables = Object.values(this.models)
      .filter((model) => model.autoTable)
      .map((model) => model.tableName);
  }

  /**
   * Initializes the socket connection
   * Note: Please overwrite with your sockets!
   */
  async init() {
    this.logger.info("Socket initialized");
  }

  /**
   * Get initialized socket class object by class name
   * @param {string} name The name of the socket class
   * @returns {Socket<>|null} The socket class object
   */
  getSocket(name) {
    if (this.socket.id in this.server.availSockets) {
      if (name in this.server.availSockets[this.socket.id]) {
        return this.server.availSockets[this.socket.id][name];
      } else {
        this.logger.error("Socket " + name + " not found!");
        return null;
      }
    } else {
      this.logger.error("Socket ID " + this.socket.id + " not available!");
      return null;
    }
  }

  /**
   * Send a toast to the client
   * @param {string} message The message to send
   * @param {string} title The title of the toast
   * @param {string} variant The variant of the toast
   */
  sendToast(message, title, variant = "success") {
    this.socket.emit("toast", {
      message: message,
      title: title,
      variant: variant,
    });
  }

  /**
   * Add username as creator_name of an database entry with column creator
   *
   * @param data
   */
  async updateCreatorName(data) {
    try {
      const socket = this.getSocket("UserSocket");
      if (socket) {
        // Check if server side pagination is used
        if (data && "count" in data) {
          data.rows = await socket.updateCreatorName(data.rows);
          return new Promise((resolve) => resolve(data));
        }
        return socket.updateCreatorName(data);
      } else {
        this.logger.error("UserSocket not found!");
        return data;
      }
    } catch (err) {
      this.logger.error(err);
    }
  }

  /**
   * Gets and caches user roles.
   *
   * Note: This method has side effects as it fills the `this.userRoles` cache
   * to avoid frequent database queries.
   * This can be problematic if user roles change during the login session,
   * as the changes won't be automatically reflected in the cache.
   *
   * @returns {integer[]} An array of user role Ids.
   */
  async getUserRoles() {
    try {
      if (!this.userRoles.length || !this.lastRolesUpdate || this.user.rolesUpdatedAt > this.lastRolesUpdate) {
        const userRoles = await this.models["user_role_matching"].findAll({
          where: { userId: this.userId },
          raw: true,
        });
        this.userRoles = userRoles.map((role) => role.userRoleId);
        this.lastRolesUpdate = new Date();
      }
      return this.userRoles;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  /**
   * Checks and caches whether the user is an admin.
   *
   * Note: This method has side effects as it caches the admin status in `this.isUserAdmin`
   * and calls `this.getUserRoles()`, which has its own caching behavior.
   * This can be problematic if the user's admin status changes
   * during their session, as the cached value won't automatically update.
   *
   * @returns {boolean} True if the user is an admin.
   */
  async isAdmin() {
    try {
      if (this.isUserAdmin === null) {
        const roleIds = await this.getUserRoles();
        // Get the admin role Id 
        const adminRole = await this.models["user_role"].findOne({
          where: {name: "admin"},
          attributes: ["id"],
          raw: true
        })
        this.isUserAdmin = roleIds.includes(adminRole.id);
      }
      return this.isUserAdmin;
    } catch (error) {
      this.logger.error(error);
      return false;
    }
  }

  /**
   * Check if the user has this right
   * @param {string} right The name of the right to check
   * @returns {boolean} True if the user has the specified right
   */
  async hasAccess(right) {
    try {
      // admin has full rights, so return true directly
      if (this.isAdmin()) return true;
      const roleIds = await this.getUserRoles();
      const hasRight = await Promise.all(
        roleIds.map(async (roleId) => {
          const matchedRoles = await this.models["role_right_matching"].findAll({
            where: { userRoleId: roleId },
            raw: true,
          });
          return matchedRoles.some((matchedRole) => matchedRole.userRightName === right);
        })
      ).then((results) => results.some((r) => Boolean(r)));

      return hasRight;
    } catch (error) {
      this.logger.error(err);
    }
  }

  /**
   * Check if the user has access
   * @param {number} userId The userId to check
   * @return {boolean}
   */
  checkUserAccess(userId) {
    if (this.isAdmin()) {
      return true;
    }
    if (this.userId !== userId) {
      this.logger.warn(
        "User " +
          this.userId +
          " tried to access user " +
          userId +
          ". Prohibiting access."
      );
      return false;
    }
    return true;
  }

  /**
   * Check if the user has access to a document
   * @param {number} documentId The documentId to check
   * @return {boolean}
   */
  checkDocumentAccess(documentId) {
    if ("DocumentSocket" in this.server.sockets) {
      return this.getSocket("DocumentSocket").checkDocumentAccess(documentId);
    } else {
      return true;
    }
  }

  /**
   * Emit to the client and add the creator_name to the data where userId exists
   * @param {string} event The event to emit
   * @param {dict|[dict]} data The data to send
   * @param {boolean} updateCreatorName If the creator_name should be updated
   * @return {void}
   */
  async emit(event, data, updateCreatorName = true) {
    if (updateCreatorName) {
      data = await this.updateCreatorName(data);
    }
    this.socket.emit(event, data);
  }

  /**
   * Emit to all clients on document and update the creator_name
   * @param {string} documentId The documentId to emit to
   * @param {string} event The event to emit
   * @param {dict|[dict]} data The data to send
   * @param {boolean} updateCreatorName If the creator_name should be updated
   * @return {void}
   */
  async emitDoc(documentId, event, data, updateCreatorName = true) {
    if (updateCreatorName) {
      data = await this.updateCreatorName(data);
    }
    this.io.to("doc:" + documentId).emit(event, data);
  }

  /**
   * Emit to all clients on document and update the creator_name
   * @param {string} room Emit to room if available
   * @param event
   * @param data
   * @param includeSender also send data to original sender
   * @param updateCreatorName
   * @return {Promise<void>}
   */
  async emitRoom(
    room,
    event,
    data,
    includeSender = true,
    updateCreatorName = true
  ) {
    if (updateCreatorName) {
      data = await this.updateCreatorName(data);
    }
    this.io.to(room).emit(event, data);
    if (includeSender) {
      this.socket.emit(event, data);
    }
  }

  /**
   * Send auto table data to the clients
   * @param table
   * @param filterIds list of ids to send
   * @param userId
   * @param includeForeignData also includes data from foreign keys tables
   * @return {Promise<void>}
   */
  async sendTableData(
    table,
    filterIds = null,
    userId = null,
    includeForeignData = true
  ) {
    try {
      if (!this.autoTables.includes(table)) {
        this.logger.error("Table " + table + " is not an auto table!");
        return;
      } else {
        //check to update creator name
        const updateCreatorName =
          "userId" in this.models[table].getAttributes();

        let data = [];
        if (this.isAdmin()) {
          data = await this.models[table].getAutoTable(userId, filterIds);
        } else {
          data = await this.models[table].getAutoTable(this.userId, filterIds);
        }

        if (includeForeignData) {
          const foreignKeys = await this.server.db.sequelize
            .getQueryInterface()
            .getForeignKeyReferencesForTable(table);

          // send all foreign keys of table that are in autoTables
          foreignKeys
            .filter((fk) => this.autoTables.includes(fk.referencedTableName) && fk.referencedTableName !== table)
            .map(async (fk) => {
              const uniqueIds = data
                .map((d) => d[fk.columnName])
                .filter(
                  (value, index, array) => array.indexOf(value) === index
                );
              if (uniqueIds.length > 0) {
                await this.sendTableData(
                  fk.referencedTableName,
                  uniqueIds,
                  userId,
                  includeForeignData
                );
              }
            });
        }
        this.emit(table + "Refresh", data, updateCreatorName);
      }
    } catch (err) {
      this.logger.error(err);
    }
  }
};
