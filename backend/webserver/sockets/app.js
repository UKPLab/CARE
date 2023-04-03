const Socket = require("../Socket.js");
const {relevantFields} = require("../../utils/auth");

/**
 * Send data for building the frontend app
 *
 * @author Dennis Zyska
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

            const settings = await this.models['setting'].getAll();
            settings.forEach(s => returnSettings[s.key] = s.value);

            const userSettings = await this.models['user_setting'].getAllByKey("userId", this.userId);
            userSettings.forEach(s => returnSettings[s.key] = s.value);

            if (sendToAll)
                this.io.emit("appSettings", returnSettings);
            else
                this.socket.emit("appSettings", returnSettings);
        } catch (err) {
            this.logger.error(err);
        }
    }

    /**
     * Send tables data to the client for automatic table generation
     *
     * @return {Promise<void>}
     */
    async sendTables() {
        const tables = Object.keys(this.models).filter(table => this.models[table].autoTable).map(table => {
            return {name: table, fields: this.models[table].fields}
        });
        this.socket.emit("appTables", tables);
    }

    async sendData(data) {
        await this.sendTableData(data.table)
    }

    async sendUser() {
        this.socket.emit("appUser",  relevantFields(await this.models['user'].getById(this.userId)));
    }

    /**
     * Send all data needed for the frontend app for initialization
     * @param {[object]} data
     * @return {Promise<void>}
     */
    async sendInit(data) {
        await this.sendUser();
        await this.sendTables();
        await this.sendSettings();
    }

    init() {

        this.socket.on("appInit", async (data) => {
            await this.sendInit(data);
        });

        this.socket.on("appData", async (data) => {
            await this.sendData(data);
        });

        this.socket.on("appDataUpdate", async (data) => {
            //TODO
            console.log(data);
        });

    }

}