const Socket = require("../Socket.js");
const mailTest = require("../utils/mailTest.js");

const MAIL_SERVICE_KEY_PREFIX = "system.mailService.";

/**
 * Returns whether a settingSave payload includes any key under system.mailService.*.
 * Used to decide if the nodemailer transport should be rebuilt after commit.
 *
 * @param {object} data     Settings array from settingSave
 * @param {string} data.key Setting key
 * @returns {boolean}
 */
function savePayloadTouchesMailService(data) {
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
     * Build dashboard settings payload and enrich wizard settings with wizardStep key
     * (string), so frontend grouping can use the same shape as setup wizard config.
     * @returns {Promise<object[]>}
     */
    async getDashboardSettingsPayload() {
        const settings = await this.models["setting"].getAll(true);
        const wizardSettings = await this.models["setting"].getWizardSettings();
        const wizardStepByKey = new Map(wizardSettings.map((s) => [s.key, s.wizardStep]));
        return settings.map((setting) => ({
            ...setting,
            wizardStep: wizardStepByKey.get(setting.key) || setting.wizardStep || null,
        }));
    }

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

        return await this.getDashboardSettingsPayload();
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

        const shouldRefreshMail = savePayloadTouchesMailService(data);

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
                await this.server.initMailServer();
            }
            await this.getSocket("AppSocket").sendSettings(true); // Notify all clients of new settings
            this.emit("settingData", await this.getDashboardSettingsPayload()); // Refresh settings on this socket
        });

        return "Settings saved successfully.";
    }

    /**
     * Sends a fixed test email using current mail settings from the database.
     *
     * @socketEvent mailSendTest
     * @param {object} data       The input data from the frontend
     * @param {string} data.to    Recipient email address
     * @param {object} options
     * @returns {Promise<string>} A promise that resolves with a success message once the test email is sent.
     * @throws {Error}            If the user is not an admin or mail fails
     */
    async mailSendTest(data, options) {
        if (!(await this.isAdmin())) {
            throw new Error("You do not have permission to send test mail.");
        }

        const rows = await this.models["setting"].getMailServiceSettings();
        const mailSettings = mailTest.buildMailMapFromSettingsRows(rows);
        const transport = mailTest.buildTransportFromMailSettings(mailSettings);
        const from = mailSettings["system.mailService.senderAddress"] || "";
        const to = data && data.to != null ? String(data.to).trim() : "";
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