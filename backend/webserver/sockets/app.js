const Socket = require("../Socket.js");
const {relevantFields} = require("../../utils/auth");
const database = require("../../db");

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
     * @param {object} options - {transaction: Sequelize.Transaction}
     */
    async updateData(data, options = {}) {
        const transaction = options.transaction;

        console.log(data);
        // update only if we have fields defined
        if ("fields" in this.models[data.table]) {
            // check or set user information
            if ("userId" in data.data && !this.checkUserAccess(data.data.userId)) {
                throw new Error("You are not allowed to update the table " + data.table + " for another user!");
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
                            throw new Error("Required field missing: " + field.key);
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
                newEntry = await this.models[data.table].add(data.data, {context: data.data, transaction: transaction});
            } else {
                newEntry = await this.models[data.table].updateById(
                    data.data.id,
                    data.data,
                    {context: data.data, transaction: transaction}
                );
            }

            if (!newEntry) {
                throw new Error("Failed to update data");
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
                                        }, {transaction: transaction});
                                    })
                                );
                                return ids;
                            }
                        })
                );
            }
            return newEntry.id;
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
                return {name: table, fields: this.models[table].fields};
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
        await this.sendTableData(data.table, (data.filter) ? data.filter: [], (data.include)? data.include: []);
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
                where: {userId: this.userId},
                raw: true,
            });
            const userRoleIds = matchedRoles.map((role) => role.userRoleId);

            const roleRights = await this.models["role_right_matching"].findAll({
                where: {userRoleId: userRoleIds},
                raw: true,
            });
            const userRights = roleRights.map((right) => right.userRightName);

            const userWithRoleInfo = {
                ...user,
                roles: userRoleIds,
                rights: userRights,
                isAdmin: await this.isAdmin(),
            };
            this.socket.emit("appUser", userWithRoleInfo);
        } catch (error) {
            this.logger.error(error);
        }
    }

    /**
     * Sends all the roles CARE has from the DB.
     *
     * @returns {Promise<void>}
     */
    async sendSystemRoles() {
        try {
            const roles = await this.models["user_role"].findAll({
                attributes: ["id", "name"],
                raw: true,
            });
            this.socket.emit("appSystemRoles", roles);
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
            await this.sendSystemRoles();
        } catch (error) {
            this.logger.error(error);
        }
    }

    /**
     * Update data for a specific table to the client
     * @param data
     * @param options - {transaction: Sequelize.Transaction}
     * @returns {Promise<*>}
     */
    async updateAppData(data, options) {

        const id = await this.updateData(data, options);
        // send updated data to all clients
        options.transaction.afterCommit(() => {
            this.sendTableData(data.table, [{key: "id", value: id}], [], null,false, true);
        });
        return id;
    }

    init() {

        this.createSocket("appDataUpdate", this.updateAppData, {}, true);
        this.createSocket("appData", this.sendData, {}, false);

        this.socket.on("appInit", async (data) => {
            try {
                await this.sendInit(data);
            } catch (err) {
                this.logger.error(err.message);
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
