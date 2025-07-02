const Socket = require("../Socket.js");

/**
 * Handle settings through websocket
 *
 * @author Dennis Zyska, Nils Dycke
 * @type {SettingSocket}
 */
module.exports = class SettingSocket extends Socket {

    /**
     * Send current settings to the client
     *
     * @param {any} data - Unused
     * @param {object} options - Context passed through the socket pipeline
     * @returns {Promise<Array<{ key: string, value: any }>>} All settings in flat key-value format
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
   * @param {Array<{key: string, value: any}>} data - List of settings to be saved
   * @param {object} options - Context passed through the socket pipeline
   * @returns {Promise<string>} Success message
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