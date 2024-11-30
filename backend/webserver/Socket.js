const {inject} = require("../utils/generic");
const {Sequelize, Op} = require("sequelize");
const _ = require("lodash");

/**
 * Defines as new Socket class
 *
 * This class is used to create a new socket connection to the server.
 *
 * @author Dennis Zyska
 * @type {Socket}
 */
module.exports = class Socket {
    /**
     * Creates a new socket connection to the server.
     *
     * @param server - The webserver instance
     * @param io - The socket.io instance
     * @param socket - The socket.io socket instance
     */
    constructor(server, io, socket) {
        this.logger = require("../utils/logger")(
            "Socket/" + this.constructor.name,
            server.db
        );

        this.server = server;
        this.io = io;
        this.socket = socket;

        this.models = this.server.db.models;
        this.user = this.socket.request.session.passport.user;
        this.userId = this.user.id;
        // Local cache of the user's current roles.
        // Note: This cache does not automatically update.
        // A reconnection or explicit refresh is required to update roles after any changes.
        this.userRoles = [];
        // Local cache of the timestamp when the user's roles were last updated.
        // This is used to determine if the cached roles need refreshing.
        this.lastRolesUpdate = null;
        this.isUserAdmin = null;
        this.logger.defaultMeta = {userId: this.userId};
        this.autoTables = Object.values(this.models)
            .filter((model) => model.autoTable)
            .map((model) => model.tableName);
    }

    /**
     * Initializes the socket connection
     * Note: Please overwrite with your sockets!
     */
    async init() {
        this.logger.info("Socket initialized");
    }

    /**
     * Creates a new socket event
     * @param eventName The name of the event
     * @param func  The function to execute (need parameter data and options)
     * @param options Additional options for the function
     * @param transaction If the function should be executed in a transaction for db operations
     * @returns
     */
    createSocket(eventName, func, options = {}, transaction = false) {
        this.socket.on(eventName, async (data, callback) => {
            let t = undefined;
            try {
                if (transaction) {
                    t = await this.server.db.sequelize.transaction();
                    options.transaction = t;

                    t.afterCommit(() => {
                        try {
                            const defaultExcludes = ["deletedAt", "passwordHash", "salt"];

                            t.changes.map(async (entry) => {
                                if (entry.constructor.autoTable) {
                                    this.emit(entry.constructor.tableName + "Refresh", _.omit(entry.dataValues, defaultExcludes), true);
                                }
                            });
                        } catch (e) {
                            this.logger.error("Error in afterCommit sending data to client: " + e);
                        }
                    });
                }

                const result = await func.bind(this)(data, options);
                if (t) {
                    await t.commit();
                }
                if (callback) {
                    callback({success: true, data: result});
                }
            } catch (err) {
                this.logger.error(err.message);
                if (t) {
                    await t.rollback();
                }
                if (callback) {
                    callback({success: false, message: err.message});
                }
            }
        });

    }

    /**
     * Get initialized socket class object by class name
     * @param {string} name The name of the socket class
     * @returns {Socket<>|null} The socket class object
     */
    getSocket(name) {
        if (this.socket.id in this.server.availSockets) {
            if (name in this.server.availSockets[this.socket.id]) {
                return this.server.availSockets[this.socket.id][name];
            } else {
                this.logger.error("Socket " + name + " not found!");
                return null;
            }
        } else {
            this.logger.error("Socket ID " + this.socket.id + " not available!");
            return null;
        }
    }

    /**
     * Send a toast to the client
     * @param {string} message The message to send
     * @param {string} title The title of the toast
     * @param {string} variant The variant of the toast
     */
    sendToast(message, title, variant = "success") {
        this.socket.emit("toast", {
            message: message,
            title: title,
            variant: variant,
        });
    }

    /**
     * Add username as creator_name of an database entry with column creator
     *
     * @param data
     */
    async updateCreatorName(data) {
        try {
            const socket = this.getSocket("UserSocket");
            if (socket) {
                // Check if server side pagination is used
                if (data && "count" in data) {
                    data.rows = await socket.updateCreatorName(data.rows);
                    return new Promise((resolve) => resolve(data));
                }
                return socket.updateCreatorName(data);
            } else {
                this.logger.error("UserSocket not found!");
                return data;
            }
        } catch (err) {
            this.logger.error(err);
        }
    }

    /**
     * Gets and caches user roles.
     *
     * Note: This method has side effects as it fills the `this.userRoles` cache
     * to avoid frequent database queries.
     * This can be problematic if user roles change during the login session,
     * as the changes won't be automatically reflected in the cache.
     *
     * @returns {Promise<number[]>} An array of user role IDs.
     */
    async getUserRoles() {
        try {
            if (!this.userRoles.length || !this.lastRolesUpdate || this.user.rolesUpdatedAt > this.lastRolesUpdate) {
                const userRoles = await this.models["user_role_matching"].findAll({
                    where: {userId: this.userId},
                    raw: true,
                });
                this.userRoles = userRoles.map((role) => role.userRoleId);
                this.lastRolesUpdate = new Date();
            }
            return this.userRoles;
        } catch (error) {
            this.logger.error(error);
            return [];
        }
    }

    /**
     * Checks and caches whether the user is an admin.
     *
     * Note: This method has side effects as it caches the admin status in `this.isUserAdmin`
     * and calls `this.getUserRoles()`, which has its own caching behavior.
     * This can be problematic if the user's admin status changes
     * during their session, as the cached value won't automatically update.
     *
     * @returns {Promise<boolean>} True if the user is an admin.
     */
    async isAdmin() {
        try {
            if (this.isUserAdmin === null) {
                const roleIds = await this.getUserRoles();
                // Get the admin role Id
                const adminRole = await this.models["user_role"].findOne({
                    where: {name: "admin"},
                    attributes: ["id"],
                    raw: true
                })
                this.isUserAdmin = roleIds.includes(adminRole.id);
            }
            return this.isUserAdmin;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    /**
     * Check if the user has this right
     * @param {string} right The name of the right to check
     * @returns {Promise<boolean>} If the user has access with this right
     */
    async hasAccess(right) {
        // admin has full rights, so return true directly
        if (await this.isAdmin()) return true;
        const roleIds = await this.getUserRoles();
        const hasRight = await Promise.all(
            roleIds.map(async (roleId) => {
                const matchedRoles = await this.models["role_right_matching"].findAll({
                    where: {userRoleId: roleId},
                    raw: true,
                });
                return matchedRoles.some((matchedRole) => matchedRole.userRightName === right);
            })
        ).then((results) => results.some((r) => Boolean(r)));

        return hasRight;
    }

    /**
     * Check if the user has access
     * @param {number} userId The userId to check
     * @return {Promise<boolean>} If the user has access
     */
    async checkUserAccess(userId) {
        if (await this.isAdmin()) {
            return true;
        }
        if (this.userId !== userId) {
            this.logger.warn(
                "User " +
                this.userId +
                " tried to access user " +
                userId +
                ". Prohibiting access."
            );
            return false;
        }
        return true;
    }

    /**
     * Check if the user has access to a document
     * @param {number} documentId The documentId to check
     * @return {boolean}
     */
    checkDocumentAccess(documentId) {
        if ("DocumentSocket" in this.server.sockets) {
            return this.getSocket("DocumentSocket").checkDocumentAccess(documentId);
        } else {
            return true;
        }
    }

    /**
     * Emit to the client and add the creator_name to the data where userId exists
     * @param {string} event The event to emit
     * @param {dict|[dict]} data The data to send
     * @param {boolean} updateCreatorName If the creator_name should be updated
     * @return {void}
     */
    async emit(event, data, updateCreatorName = true) {
        if (updateCreatorName) {
            data = await this.updateCreatorName(data);
        }
        this.socket.emit(event, data);
    }

    /**
     * Emit to all clients on document and update the creator_name
     * @param {string} documentId The documentId to emit to
     * @param {string} event The event to emit
     * @param {dict|[dict]} data The data to send
     * @param {boolean} updateCreatorName If the creator_name should be updated
     * @return {void}
     */
    async emitDoc(documentId, event, data, updateCreatorName = true) {
        if (updateCreatorName) {
            data = await this.updateCreatorName(data);
        }
        this.io.to("doc:" + documentId).emit(event, data);
    }

    /**
     * Emit to all clients on document and update the creator_name
     * @param {string} room Emit to room if available
     * @param event
     * @param data
     * @param includeSender also send data to original sender
     * @param updateCreatorName
     * @return {Promise<void>}
     */
    async emitRoom(
        room,
        event,
        data,
        includeSender = true,
        updateCreatorName = true
    ) {
        if (updateCreatorName) {
            data = await this.updateCreatorName(data);
        }
        this.io.to(room).emit(event, data);
        if (includeSender) {
            this.socket.emit(event, data);
        }
    }

    async sendTable(tableName, filter = []) {

        // check if it is an autoTable or not
        if (!this.models[tableName] || !this.models[tableName].autoTable) {
            this.logger.error("Table " + tableName + " is not an autoTable");
            return;
        }

        let allFilter = {deleted: false};
        if (filter.length > 0) {
            allFilter[Op.or] = filter;
        }
        const defaultExcludes = ["deleted", "deletedAt", "updatedAt", "rolesUpdatedAt", "initialPassword", "passwordHash", "salt"];
        const allAttributes = {
            exclude: defaultExcludes,
        };

        if (await this.isAdmin() || this.models[tableName].publicTable) { // is allowed to see everything
            // no adaption of the filter or attributes needed
        } else if (this.models[tableName].autoTable && 'userId' in this.models[tableName].getAttributes()) {
            // is allowed to see only his data and possible if there is a public attribute
            const userFilter = {};
            if ("public" in this.models[tableName].getAttributes()) {
                userFilter[Op.or] = [{userId: this.userId}, {public: true}];
            } else {
                userFilter['userId'] = this.userId;
            }
            allFilter = {[Op.and]: [allFilter, userFilter]}
        } else {
            const accessRights = this.server.db.models[tableName]['accessMap'].filter(async a => await this.hasAccess(a.right));
            if (accessRights.length > 0) {
                const attributes = [...new Set(accessRights.flatMap(a => a.columns))];
                allAttributes['include'] = attributes;
            } else {
                this.logger.warn("User with id " + this.userId + " requested table " + tableName + " without access rights");
                return;
            }
        }

        const data = await this.models[tableName].findAll({
            where: allFilter,
            attributes: allAttributes,
            raw: true,
        });

        this.emit(tableName + "Refresh", data, true);

        // send additional data if needed
        if (this.models[tableName].autoTable.foreignTables && this.models[tableName].autoTable.foreignTables.length > 0) {
            await Promise.all(this.models[tableName].autoTable.foreignTables.map(async (fTable) => {
                const fdata = await this.models[fTable.table].findAll({
                    where: {[fTable.by]: {[Op.in]: data.map(d => d.id)}, deleted: false},
                    attributes: {exclude: defaultExcludes},
                    raw: true,
                });
                this.emit(fTable.table + "Refresh", fdata, true);
            }))
        }

    }


    /**
     * Send auto table data to the clients
     * @param table
     * @param filter list of filter
     * @param include
     * @param userId
     * @param includeForeignData also includes data from foreign keys tables
     * @param includeFieldTables also includes data from field tables
     * @return {Promise<void>}
     */
    async sendTableData(
        table,
        filter = [],
        include = [],
        userId = null,
        includeForeignData = true,
        includeFieldTables = false,
    ) {
        try {

            const accessRights = this.server.db.models[table]['accessMap'].filter(async a => await this.hasAccess(a.right));

            if (!this.autoTables.includes(table) && accessRights.length === 0) {
                this.logger.error("No access rights for autotable: " + table);
                return;
            }

            let data = [];
            if (accessRights.length > 0 || await this.isAdmin()) {
                const attributes = [...new Set(accessRights.flatMap(a => a.columns))];
                data = await this.models[table].getAutoTable(filter, userId, attributes);
            } else {
                data = await this.models[table].getAutoTable(filter, this.userId);
            }

            if (includeForeignData) {
                const foreignKeys = await this.server.db.sequelize
                    .getQueryInterface()
                    .getForeignKeyReferencesForTable(table);

                // send all foreign keys of table that are in autoTables
                foreignKeys
                    .filter((fk) => this.autoTables.includes(fk.referencedTableName) && fk.referencedTableName !== table)
                    .map(async (fk) => {
                        const uniqueIds = data
                            .map((d) => d[fk.columnName])
                            .filter(
                                (value, index, array) => array.indexOf(value) === index
                            );
                        if (uniqueIds.length > 0) {
                            await this.sendTableData(
                                fk.referencedTableName,
                                [{key: "id", values: uniqueIds}],
                                [],
                                userId,
                                includeForeignData
                            );
                        }
                    });
            }
            if (includeFieldTables) {
                const fields = this.models[table].fields.filter(
                    (f) => f.type === "choice" || f.type === "table"
                );
                for (const field of fields) {
                    if ("table" in field.options) {
                        // TODO we already have the object, so we don't need to query the database again in sendTableData
                        const ids = (await Promise.all(data.map(async (d) => {
                                const tableData = await this.models[field.options.table].getAllByKey(
                                    field.options.id,
                                    d.id, true);
                                return tableData.map((td) => td.id);
                            }
                        ))).flat(1);

                        if (ids.length > 0) {
                            await this.sendTableData(
                                field.options.table,
                                [{key: "id", values: ids}],
                                [],
                                userId,
                                includeForeignData
                            );
                        }
                    }
                }
            }

            if (include.length > 0) {
                for (const inclusions of include) {
                    if (inclusions.type === "count") {
                        const count = await this.models[inclusions.table].findAll({
                            attributes: [inclusions.by, [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
                            where: {
                                [inclusions.by]: {
                                    [Op.in]: data.map((d) => d.id)
                                },
                            },
                            group: inclusions.by,
                            raw: true
                        });
                        // inject to data
                        data = data.map((d) => {
                            d[inclusions.as] = count.find((c) => c[inclusions.by] === d.id)?.count || 0;
                            return d;
                        });
                    } else {
                        await this.sendTableData(inclusions.table, [{
                            key: "id",
                            values: [...new Set(data.map((d) => d[inclusions.by]))]
                        }], [], userId, includeForeignData, includeFieldTables);
                    }
                }
            }

            this.emit(table + "Refresh", data, true);
        } catch (err) {
            this.logger.error(err);
        }
    }
}
;
