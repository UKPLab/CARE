const Socket = require("../Socket.js");

/**
 * Handle settings through websocket
 *
 * @author Dennis Zyska, Nils Dycke
 * @type {SettingSocket}
 */
module.exports = class SettingSocket extends Socket {

    /**
     * Send all settings to the client
     * @param {boolean} sendToAll broadcast to all clients
     * @return {Promise<void>}
     */
    async sendSettings(sendToAll = false) {
        try {
            let returnSettings = {};

            const settings = await this.models['setting'].getAll();
            settings.forEach(s => returnSettings[s.key] = s.value);

            const userSettings = await this.models['user_setting'].getAllByKey("userId", this.userId);
            userSettings.forEach(s => returnSettings[s.key] = s.value);

            if (sendToAll)
                this.io.emit("settingRefresh", returnSettings);
            else
                this.socket.emit("settingRefresh", returnSettings);
        } catch (err) {
            this.logger.error(err);
        }
    }

    /**
     * Send all navigation elements to the client
     * @return {Promise<void>}
     */
    async sendNavigation() {
        try {
            const elements = await this.models['nav_element'].getAll();
            const groups = await this.models['nav_group'].getAll();

            this.socket.emit("settingNavigation", {groups: groups, elements: elements})
        } catch (err) {
            this.logger.error(err);
        }
    }

    /**
     * Save settings
     * @param {[object]} data
     * @return {Promise<void>}
     */
    async saveSettings(data) {
        if (this.isAdmin()) {
            await Promise.all(data.map(async setting => await this.models['setting'].set(setting.key, setting.value)));
            await this.sendSettings(true);  // Send new settings to all clients
            this.sendToast("Settings saved", "Success", "success");
            this.socket.emit("settingData", await this.models['setting'].getAll());
        }
    }

    init() {

        this.socket.on("settingGetAll", async (data) => {
            await this.sendSettings();
        });

        this.socket.on("settingGetNavigation", async (data) => {
            await this.sendNavigation();
        });

        this.socket.on("settingSet", async (data) => {
            try {
                await this.models['user_setting'].set(data.key, data.value, this.userId);
                await this.sendSettings();
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("settingGetData", async (data) => {
            if (this.isAdmin()) {
                try {
                    this.socket.emit("settingData", await this.models['setting'].getAll());
                } catch (err) {
                    this.logger.error(err);
                }
            }
        });

        this.socket.on("settingSave", async (data) => {
            try {
                await this.saveSettings(data);
            } catch (err) {
                this.sendToast("Settings not saved: " + err, "Error", "danger");
                this.logger.error(err);
            }
        });

    }

}