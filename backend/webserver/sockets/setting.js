const Socket = require("../Socket.js");
const mailTest = require("../utils/mailTest.js");

const MAIL_SERVICE_KEY_PREFIX = "system.mailService.";

/**
 * @param {Array<{ key: string }>|undefined} data Settings payload from settingSave
 * @returns {boolean} True if any saved key is under system.mailService.*
 */
function payloadTouchesMailService(data) {
    if (!Array.isArray(data)) {
        return false;
    }
    for (const setting of data) {
        if (!setting || typeof setting.key !== "string") {
            continue;
        }
        if (setting.key.startsWith(MAIL_SERVICE_KEY_PREFIX)) {
            return true;
        }
    }
    return false;
}

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

        const shouldRefreshMail = payloadTouchesMailService(data);

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
            if (shouldRefreshMail) {
                await this.server.refreshMailServer();
            }
            await this.getSocket("AppSocket").sendSettings(true); // Notify all clients of new settings
            this.emit("settingData", await this.models["setting"].getAll(true)); // Refresh settings on this socket
        });

        return "Settings saved successfully.";
    }

    /**
     * Sends a fixed test email using current DB mail settings.
     *
     * @socketEvent mailSendTest
     * @param {{ to: string }} data Recipient address.
     * @returns {Promise<string>} Success message.
     */
    async mailSendTest(data) {
        if (!(await this.isAdmin())) {
            throw new Error("You do not have permission to send test mail.");
        }
        const to = data && data.to != null ? String(data.to).trim() : "";
        if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
            throw new Error("A valid recipient email address is required.");
        }

        const rows = await this.models["setting"].getAll(false);
        const map = mailTest.buildMailMapFromSettingsRows(rows);
        const transport = mailTest.buildTransportFromMailSettings(map);
        const from = map["system.mailService.senderAddress"] || "";
        await mailTest.sendFixedTestMail(transport, { from, to });
        return "Test email sent.";
    }

    init() {
        this.createSocket("settingGetData", this.sendSettings, {}, false);
        this.createSocket("settingSave", this.saveSettings, {}, true);
        this.createSocket("mailSendTest", this.mailSendTest, {}, false);
    }
}

module.exports = SettingSocket;