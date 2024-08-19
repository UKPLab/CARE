const Socket = require("../Socket.js");
const { relevantFields } = require("../../utils/auth");

/**
 * Send data for building the frontend app
 *
 * @author Dennis Zyska, Linyin Huang
 * @type {SettingSocket}
 */
module.exports = class AppSocket extends Socket {
  /**
   * Send all settings to the client
   * @param {boolean} sendToAll broadcast to all clients
   * @return {Promise<void>}
   */
  async sendSettings(sendToAll = false) {
    try {
      let returnSettings = {};

      const settings = await this.models["setting"].getAll();
      settings.forEach((s) => (returnSettings[s.key] = s.value));

      const userSettings = await this.models["user_setting"].getAllByKey(
        "userId",
        this.userId
      );
      userSettings.forEach((s) => (returnSettings[s.key] = s.value));

      if (sendToAll) {
        this.io.emit("appSettings", returnSettings);
      } else {
        this.socket.emit("appSettings", returnSettings);
      }
    } catch (err) {
      this.logger.error(err);
    }
  }

  /**
   * Updates data in the database
   * @param {object} data - {table: string, data: object}
   */
  async updateData(data) {
    try {
      // update only if we have fields defined
      if ("fields" in this.models[data.table]) {
        // check or set user information
        if ("userId" in data.data && !this.checkUserAccess(data.data.userId)) {
          this.sendToast(
            "error",
            "User access error",
            "You are not allowed to update the table " +
              data.table +
              " for another user!"
          );
          return;
        } else {
          data.data.userId = this.userId;
        }

        // check data exists for required fields
        for (let field of this.models[data.table].fields) {
          if (field.required) {
            if (
              !(field.key in data.data) ||
              data.data[field.key] === null ||
              data.data[field.key] === ""
            ) {
              {
                this.sendToast("Required field missing", "Error", field.key);
                this.logger.error("Required field missing: " + field.key);
                return false;
              }
            }
          }
          // defaults
          if (!(field.key in data.data || data.data[field.key] === null)) {
            // only if default is set and we are not updating an existing entry
            if (field.default !== null && !("id" in data.data)) {
              data.data[field.key] = field.default;
            }
          }
        }

        // update data
        let newEntry = null;
        if (!("id" in data.data) || data.data.id === 0) {
          newEntry = await this.models[data.table].add(data.data);
        } else {
          newEntry = await this.models[data.table].updateById(
            data.data.id,
            data.data
          );
        }
        // check if table has a field with table options
        if (newEntry) {
          const tableResults = await Promise.all(
            this.models[data.table].fields
              .filter((f) => f.type === "table")
              .map(async (f) => {
                if ("table" in f.options) {
                  const ids = await Promise.all(
                    data.data[f.key].map((tf) => {
                      tf[f.options.id] = newEntry.id;
                      return this.updateData({
                        table: f.options.table,
                        data: tf,
                      });
                    })
                  );
                  return ids;
                }
              })
          );
          if (!tableResults.flat(1).every((e) => !!e)) {
            newEntry = await this.models[data.table].updateById(newEntry.id, {
              deleted: true,
            });
            this.models[data.table].fields
              .filter((f) => f.type === "table")
              .map(async (f, i) => {
                const newObjects = await Promise.all(
                  tableResults[i].map((id) => {
                    return this.models[f.options.table].updateById(id, {
                      deleted: true,
                    });
                  })
                );
                await this.sendTableData(
                  f.options.table,
                  newObjects.map((e) => e.id),
                  null,
                  false
                );
              });
          }
          await this.sendTableData(data.table, [newEntry.id], null, false);
          return newEntry.id;
        }
      }
    } catch (err) {
      this.logger.error(err);
      return false;
    }
  }

  /**
   * Send tables data to the client for automatic table generation
   *
   * @return {Promise<void>}
   */
  async sendTables() {
    const tables = Object.keys(this.models)
      .filter((table) => this.models[table].autoTable)
      .map((table) => {
        return { name: table, fields: this.models[table].fields };
      });
    this.socket.emit("appTables", tables);
  }

  /**
   * Sends the data stored under data.table.
   *
   * @param data incl. table data
   * @returns {Promise<void>}
   */
  async sendData(data) {
    try {
      await this.sendTableData(data.table);
    } catch (error) {
      this.logger.error(error);
    }
  }

  /**
   * Sends the user information for this user loaded from the db.
   *
   * @returns {Promise<void>}
   */
  async sendUser() {
    try {
      const user = relevantFields(
        await this.models["user"].getById(this.userId)
      );
      const matchedRoles = await this.models["user_role_matching"].findAll({
        where: { userId: this.userId },
        raw: true,
      });
      const userRoles = matchedRoles.map((role) => role.userRoleId);
      const userWithRoleInfo = {
        ...user,
        roles: userRoles,
        isAdmin: this.isAdmin(),
      };
      this.socket.emit("appUser", userWithRoleInfo);
    } catch (error) {
      this.logger.error(error);
    }
  }

  /**
   * Send all data needed for the frontend app for initialization
   * @param {[object]} data
   * @return {Promise<void>}
   */
  async sendInit(data) {
    try {
      await this.sendUser();
      await this.sendTables();
      await this.sendSettings();
    } catch (error) {
      this.logger.error(error);
    }
  }

  init() {
    this.socket.on("appInit", async (data) => {
      await this.sendInit(data);
    });

    this.socket.on("appData", async (data) => {
      await this.sendData(data);
    });

    this.socket.on("appDataUpdate", async (data) => {
      const id = await this.updateData(data);
      if (id) {
        await this.socket.emit("appDataUpdateSuccess", {
          requestId: data.id,
          id: id,
          success: true,
        });
      } else {
        await this.socket.emit("appDataUpdateSuccess", {
          requestId: data.id,
          success: false,
        });
      }
    });

    this.socket.on("appSettingSet", async (data) => {
      try {
        await this.models["user_setting"].set(data.key, data.value, this.userId);
        await this.sendSettings();
      } catch (err) {
        this.logger.error(err);
      }
    });
  }
};
