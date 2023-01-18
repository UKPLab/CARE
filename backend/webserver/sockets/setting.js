const {getGroups, getElements} = require("../../db/methods/navigation");
const {getUserSettings, getSettings, setSetting, setUserSetting} = require("../../db/methods/settings");

const Socket = require("../Socket.js");

/**
 * Handle settings through websocket
 *
 * @author Dennis Zyska, Nils Dycke
 * @type {SettingSocket}
 */
module.exports = class SettingSocket extends Socket {

    async sendSettings() {
        try {
            const settings = await getSettings();
            const userSettings = await getUserSettings(this.user_id);

            let returnSettings = {};
            settings.forEach(s => returnSettings[s.key] = s.value);
            userSettings.forEach(s => returnSettings[s.key] = s.value);

            this.socket.emit("settingRefresh", returnSettings);
        } catch (err) {
            this.logger.error(err);
        }
    }

    async sendNavigation() {
        try {
            const elements = await getElements();
            const groups = await getGroups();

            this.socket.emit("settingNavigation", {groups: groups, elements: elements})
        } catch (err) {
            this.logger.error(err);
        }
    }

    init() {

        this.socket.on("settingGetAll", async (data) => {
            await this.sendSettings();
            await this.sendNavigation();
        });

        this.socket.on("settingSet", async (data) => {
            try {
                await setUserSetting(this.user_id, data.key, data.value);
                await this.sendSettings()
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("settingGetData", async (data) => {
            if (this.isAdmin()) {
                try {
                    const settings = await getSettings();
                    this.socket.emit("settingData", settings);
                } catch (err) {
                    this.logger.error(err);
                }
            }
        });

        this.socket.on("settingSave", async (data) => {
            try {
                if (this.isAdmin()) {
                    await Promise.all(data.map(setting => setSetting(setting.key, setting.value)));
                    await this.sendSettings()
                }
            } catch (err) {
                this.logger.error(err);
            }
        });



    }

}