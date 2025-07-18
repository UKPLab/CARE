const Socket = require("../Socket.js");

/**
 * Handle settings through websocket
 *
 * @author Dennis Zyska, Nils Dycke
 * @type {SettingSocket}
 * @class SettingSocket
 */
class SettingSocket extends Socket {

    /**
     * Fetches all system settings from the database.
     * This operation is restricted to users with administrator privileges.
     *
     * @socketEvent settingGetData
     * @param {any} data Currently unused.
     * @param {object} options Additional configuration parameters (currently unused).
     * @returns {Promise<Array<{ key: string, value: any }>>} All settings in flat key-value format
     * @throws {Error} Throws an error if the requesting user is not an administrator.
     */
    async sendSettings(data, options) {
         if (!(await this.isAdmin())) {
            throw new Error("You do not have permission to access settings.");
        }

        return await this.models["setting"].getAll(true);
    }

   /**
   * Save settings to the database
   *
   * @socketEvent settingSave
   * @param {Array<{key: string, value: any}>} data List of settings to be saved
   * @param {object} options Context passed through the socket pipeline
   * @param {Object} options.transaction A Sequelize DB transaction object to ensure all settings are saved atomically.
   * @returns {Promise<string>} A promise that resolves with a success message once the save operations are queued within the transaction.
   * @throws {Error} Throws an error if the requesting user is not an administrator.
   */
    async saveSettings(data, options) {
        if (!(await this.isAdmin())) {
            throw new Error("You do not have permission to save settings.");
        }

        for (const setting of data) {
            let value = setting.value;
            if (typeof value === "object") {
                value = JSON.stringify(value);
            }

            await this.models["setting"].set(setting.key, value, {
                transaction: options.transaction,
            });
        }

        options.transaction.afterCommit(async () => {
            await this.getSocket("AppSocket").sendSettings(true); // Notify all clients of new settings
            this.emit("settingData", await this.models["setting"].getAll(true)); // Refresh settings on this socket
        });

        return "Settings saved successfully.";
    }

    init() {
        this.createSocket("settingGetData", this.sendSettings, {}, false);
        this.createSocket("settingSave", this.saveSettings, {}, true);
    }
}

module.exports = SettingSocket;