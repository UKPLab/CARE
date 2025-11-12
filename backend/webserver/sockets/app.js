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
 * @class AppSocket
 */
class AppSocket extends Socket {
    /**
     * Fetches and merges global application settings with user-specific settings, then sends the complete list to the client via a socket event.
     * 
     * @param {boolean} sendToAll [sendToAll=false] - If true, the settings are broadcast to all connected clients. If false, they are sent only to the client that initiated the request.
     * @return {Promise<void>} A promise that resolves (with no value) once the settings have been sent or an error has been caught and logged.
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
     * A generic and powerful method to create or update records in a specified database table.
     * 
     * It determines whether to create a new record or update an existing one based on the presence of an `id` in the `data.data` payload.
     * The function includes schema-based validation for required fields, handles default values, and supports recursive updates for nested table data.
     * 
     * Note: This works only for autoTable tables (see documentation for more information)
     * 
     * @param {Object} data The input data from the frontend
     * @param {String} data.table The name of the table to update
     * @param {Object} data.data New data to update
     * @param {Object} options holds the managed transaction of the database (see createSocket function)
     * @param {Object} options.transaction Sequelize DB transaction options
     * @returns {Promise<void>} A promise that resolves with the ID of the newly created or updated primary record.
     * @throws {Error} Throws an error under several conditions:
     *  If a non-admin user attempts to update a record for another user,
     *  If a required field (as defined in the model's schema) is missing from the `data.data` payload,
     *  If the database operation fails to return a new or updated entry after an add/update call.
     */
    async updateData(data, options = {}) {
        const transaction = options.transaction;

        let newEntry = null;
        if (("id" in data.data && data.data.id !== 0) &&
            ('deleted' in data.data || 'closed' in data.data || 'public' in data.data || 'end' in data.data)) {
            newEntry = await this.models[data.table].updateById(
                data.data.id,
                data.data,
                {context: data.data, transaction: transaction}
            );
            return newEntry.id;
        }

        // check or set user information
        if ("userId" in data.data && !await this.checkUserAccess(data.data.userId)) {
            throw new Error("You are not allowed to update the table " + data.table + " for another user!");
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
            if (!("userId" in data.data)) {
                data.data.userId = this.userId;
            }
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

    /**
     * Gathers the schema for all models configured for automatic table generation if 'autoTable = true'.
     * 
     * This structural data is then sent to the client via an 'appTables' socket event,
     * allowing the frontend to dynamically generate tables or forms.
     *
     * @return {Promise<void>} A promise that resolves (with no value) once the table schemas have been sent.
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
     * Handles the 'appData' socket event. It acts as a wrapper to fetch and send
     * filtered data from a specific table to the client.
     * 
     * @socketEvent appData
     * @param {Object} data The input data from the frontend
     * @param {String} data.table Table to send
     * @param {Object} data.filter Filters
     * @param {Object} data.include What data to include
     * @param {Object} options holds the managed transaction of the database (see createSocket function)
     * @returns {Promise<void>} Resolves when data is successfully retrieved and emitted to the client.
     */
    async sendData(data, options) {
        await this.sendTableData(data.table, (data.filter) ? data.filter : [], (data.include) ? data.include : []);
    }

    /**
     * Sends the user information for this user loaded from the db.
     * 
     * This includes core user data, associated role IDs, rights derived from those roles,
     * and whether the user has administrative privileges. The data is emitted via the `appUser` socket event.
     * 
     * @returns {Promise<void>} Resolves after the user information has been successfully sent to the client via a socket event
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
     * Retrieves role data from the database, including only role IDs and names,
     * and emits it via the `appSystemRoles` socket event.
     * 
     * @returns {Promise<void>} Resolves after the list of system roles has been successfully sent to the client via a socket event
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
     * Send all data needed for the frontend app for initialization.
     * 
     * Creates a series of socket events to provide user details, system tables,
     * configuration settings, and system roles to the client.
     * 
     * @socketEvent appInit
     * @param {Object} data The input data from the frontend
     * @param {Object} options Sequelize transaction options
     * @param {Object} options.transaction Sequelize DB transaction options
     * @return {Promise<void>} Resolves once all the initial data has been sent successfully
     */
    async sendInit(data, options) {
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
     * Update data for a specific table to the client.
     * 
     * Acts as a wrapper around the underlying `updateData` method, using a Sequelize
     * transaction if provided, and returns the outcome to the caller.
     * 
     * @socketEvent appDataUpdate
     * @param {Object} data The input data from the frontend
     * @param {Object} options Additional configuration parameter
     * @param {Object} options.transaction Sequelize DB transaction options
     * @returns {Promise<*>} A promise that resolves with the result from the underlying updateData method
     */
    async updateAppData(data, options) {
        return await this.updateData(data, options);
    }

    /**
     * Fetches and sends a single record from a specified table identified by a hash.
     * 
     * This function also serves as a permission check, ensuring data is only sent if found
     * 
     * @socketEvent appDataByHash
     * @param {Object} data The input data from the frontend
     * @param {String} data.hash The hash value
     * @param {String} data.table Table to send the data from
     * @param {Object} options Additional configuration parameter
     * @param {Object} [options.transaction] A Sequelize DB transaction object for future use.
     * @returns {Promise<void>} A promise that resolves if the data is found and sent successfully
     * @throws {Error} Throws error if results is empty (no record found or operation fails)
     */
    async sendDataByHash(data, options) {
        const result = await this.sendTable(data.table, mergeFilter([[{
            key: "hash",
            value: data.hash
        }]], this.models[data.table].getAttributes()));
        if (result.length === 0) {
            throw new Error("You don't have rights to access this data");
        }
    }


    /**
     * Subscribe to app data. Creates and manages a subscription for real-time updates on a specific database table. 
     * 
     * Merges filters from all active subscriptions for a table and sends the
     * client the initial data set required for the new subscription
     * 
     * @socketEvent subscribeAppData
     * @param {Object} data The configuration for the data subscription
     * @param {string} data.table The name of the database table to subscribe to
     * @param {Object[]} [data.filter] An optional filter array (e.g., Sequelize 'where' conditions) to specify a subset of data
     * @param {Object[]} [data.inject] Optional instructions for including related data (e.g., Sequelize 'include' models)
     * @param {Object} [options] Additional configuration parameters
     * @param {Object} [options.transaction] May contain a Sequelize DB transaction for future use
     * @returns {Promise<string>} A promise that resolves with the unique ID for the newly created subscription
     * @throws {Error} Throws an error if data.table is not provided
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
        this.socket.user = this.user;

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

        return newSubscriptionId;
    }

    /**
     * Unsubscribe from app data, removes a data subscription for the client.
     * 
     * Removes the corresponding data subscription entry from the socket's internal tracking lists
     * based on the provided identifier.
     * 
     * @socketEvent unsubscribeAppData
     * @param {Object} data The input data from the frontend. The identifier for the subscription to remove
     * @param {Object} options Additional configuration parameter
     * @return {Promise<void>} A promise that resolves once the subscription has been removed from the tracking lists
     */
    async unsubscribeAppData(data, options) {
        // remove subscription from the list
        if (this.socket.appDataSubscriptions["ids"][data].table) {
            const tableName = this.socket.appDataSubscriptions["ids"][data].table;
            delete this.socket.appDataSubscriptions["ids"][data];
            this.socket.appDataSubscriptions["tables"][tableName].delete(data);
        }
       
    }

    /**
     * Updates a single user-specific setting and then broadcasts the complete, refreshed settings to the client.
     * 
     * Saves the key–value pair for the current user in the database, then triggers an update
     * by emitting the complete set of user settings to the client.
     * 
     * @socketEvent appSettingSet
     * @param {Object} data The input data from the frontend
     * @param {String} data.key The key in the user setting table
     * @param {String} data.userId - The user ID to set the setting for, if not provided, it will use the current user
     * @param {String} data.value The value in the user setting table
     * @param {Object} options Additional configuration parameter
     * @return {Promise<void>} A promise that resolves after the setting is saved and the new configuration is sent
     */
    async sendOverallSetting(data, options) {
        const { key, value } = data;
        // Admin can set settings for other users (single or bulk)
        if (Array.isArray(data.userIds) && data.userIds.length > 0 && await this.isAdmin()) {
            for (const uid of data.userIds) {
                await this.models["user_setting"].set(key, value, uid);
            }
        } else if (data.userId && await this.isAdmin()) {
            await this.models["user_setting"].set(key, value, data.userId);
        } else {
            // Default: set for current user and refresh their settings
            console.log(`Setting ${key} for user ${this.userId} to ${value}`);
            await this.models["user_setting"].set(key, value, this.userId);
            await this.sendSettings();
        }   
    }

    init() {

        this.createSocket("appDataUpdate", this.updateAppData, {}, true);
        this.createSocket("appData", this.sendData, {}, false);
        this.createSocket("appDataByHash", this.sendDataByHash, {}, false);

        this.createSocket("subscribeAppData", this.subscribeAppData, {}, false);
        this.createSocket("unsubscribeAppData", this.unsubscribeAppData, {}, false);
        this.createSocket("appInit", this.sendInit, {}, false);
        this.createSocket("appSettingSet", this.sendOverallSetting, {}, false);
    }
};

module.exports = AppSocket;