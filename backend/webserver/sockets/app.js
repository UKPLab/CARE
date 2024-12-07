const Socket = require("../Socket.js");
const {relevantFields} = require("../../utils/auth");
const database = require("../../db");
const {v4: uuidv4} = require("uuid");
const {mergeFilter} = require("../../utils/data.js");
const {mergeInjects} = require("../../utils/data");

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

        let newEntry = null;
        if (("id" in data.data && data.data.id !== 0) &&
            ('deleted' in data.data || 'closed' in data.data || 'public' in data.data || 'end' in data.data)) {
            newEntry = await this.models[data.table].updateById(
                data.data.id,
                data.data,
                {transaction: transaction}
            );
            return newEntry.id;
        }


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
        await this.sendTableData(data.table, (data.filter) ? data.filter : [], (data.include) ? data.include : []);
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
        return await this.updateData(data, options);
    }


    /**
     * Subscribe to app data
     */
    async subscribeAppData(data, options) {
        if (!data.table) {
            throw new Error("Table name is required");
        }

        // add subscription to the list
        const newSubscriptionId = uuidv4();
        const tableName = data.table;
        this.socket.appDataSubscriptions["ids"][newSubscriptionId] = data;
        if (!this.socket.appDataSubscriptions["tables"][tableName]) {
            this.socket.appDataSubscriptions["tables"][tableName] = new Set();
        }
        this.socket.appDataSubscriptions["tables"][tableName].add(newSubscriptionId);

        // merge all filters
        const oldMerge = {...this.socket.appDataSubscriptions["merged"][tableName]};
        const currentFilter = mergeFilter([(data.filter) ? data.filter : []], this.models[tableName].getAttributes());
        const allFilter = [...this.socket.appDataSubscriptions["tables"][tableName]]
            .map(subId => this.socket.appDataSubscriptions["ids"][subId])
            .map(sub => (sub.filter) ? sub.filter : []);
        const mergedFilters = mergeFilter(allFilter, this.models[tableName].getAttributes());

        const currentInject = (data.inject) ? data.inject : [];
        const allInjects =
            [...this.socket.appDataSubscriptions["tables"][tableName]]
                .map(subId => this.socket.appDataSubscriptions["ids"][subId])
                .map(sub => (sub.inject) ? sub.inject : []);
        const mergedInjects = mergeInjects(allInjects);
        this.socket.appDataSubscriptions["merged"][tableName] = {
            filter: mergedFilters,
            inject: mergedInjects
        };

        // check if client already has the data
        if (oldMerge
            && oldMerge.filter && oldMerge.filter.length === 0
            && oldMerge.inject && oldMerge.inject.length === 0
            && mergedInjects.length === 0
        ) { // has already all data, no need for sending new data
            return newSubscriptionId;
        } else if (mergedFilters.length === 0) { // now need all data, so send it
            await this.sendTable(tableName, mergedFilters, mergedInjects);
        } else if ((oldMerge.filter && oldMerge.filter.length > 0)
            || (oldMerge.inject && oldMerge.inject.length > 0)) { // check if the we already has filter
            if (oldMerge.filter.includes(currentFilter) && oldMerge.inject.includes(currentInject)) { // and the new data is included in the old data
                return newSubscriptionId;
            } else { // if not, we need to send data for current filter
                await this.sendTable(tableName, currentFilter, mergedInjects);
            }
        } else {
            // just send data with additional current filter
            await this.sendTable(tableName, currentFilter, mergedInjects);
        }

        //TODO on unsubscribe, recalculate the merged filters
        //TODO the io appDataSubscription should maybe hold relevant users where then the merged data is checked

        return newSubscriptionId;
    }

    /**
     * Unsubscribe from app data
     */
    async unsubscribeAppData(data, options) {
        // remove subscription from the list
        const tableName = this.socket.appDataSubscriptions[data].table;
        delete this.socket.appDataSubscriptions["ids"][data];
        this.socket.appDataSubscriptions["tables"][tableName].delete(data);
    }

    init() {

        this.createSocket("appDataUpdate", this.updateAppData, {}, true);
        this.createSocket("appData", this.sendData, {}, false);

        this.createSocket("subscribeAppData", this.subscribeAppData, {}, false);
        this.createSocket("unsubscribeAppData", this.unsubscribeAppData, {}, false);

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
