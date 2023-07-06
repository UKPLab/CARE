const Socket = require("../Socket.js");

/**
 * Handle settings through websocket
 *
 * @author Dennis Zyska, Nils Dycke
 * @type {SettingSocket}
 */
module.exports = class SettingSocket extends Socket {

    /**
     * Save settings
     * @param {[object]} data
     * @return {Promise<void>}
     */
    async saveSettings(data) {
        if (this.isAdmin()) {
            await Promise.all(data.map(async setting => await this.models['setting'].set(setting.key, setting.value)));
            await this.getSocket('AppSocket').sendSettings(true);  // Send new settings to all clients
            this.sendToast("Settings saved", "Success", "success");
            this.socket.emit("settingData", await this.models['setting'].getAll());
        }
    }

    init() {

        this.socket.on("settingGetData", async (data) => {
            if (this.isAdmin()) {
                this.socket.emit("settingData", await this.models['setting'].getAll(true));
                try {
                    this.socket.emit("settingData", await this.models['setting'].getAll(true));
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