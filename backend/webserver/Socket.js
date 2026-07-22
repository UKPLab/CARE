const {inject} = require("../utils/generic");
const {Sequelize, Op} = require("sequelize");
const _ = require("lodash");
const {EWMAMonitor} = require("../utils/EWMAMonitor")
/**
 * Defines as new Socket class
 *
 * This class is used to create a new socket connection to the server.
 *
 * @author Dennis Zyska, Marina Sakharova
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
        this.logger.defaultMeta = {userId: this.userId};
        this.autoTables = Object.values(this.models)
            .filter((model) => model.autoTable)
            .map((model) => model.tableName);

        // user rights in form: userId: {isAdmin: false, rights: {right1: false, ..}, roles: [role1, ..], lastRolesUpdate: Date}
        this.userInfo = {};

        this.transactionMonitor = new EWMAMonitor(30, this.logger);
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
     * @param {string} eventName The name of the event
     * @param {Function} func  The function to execute (need parameter data and options)
     * @param {Object} options Additional options for the function
     * @param {boolean} useTransaction If the function should be executed in a transaction for db operations
     * @returns {void}
     */
    createSocket(eventName, func, options = {}, useTransaction = false) {
        this.socket.on(eventName, async (data, callback) => {
            let t;
            const perCallOptions = {...options};
            let finished = false;
            try {
                if (useTransaction) {
                    this.transactionMonitor.start(); //Start Transaction Time Tracking 
                    t = await this.server.db.sequelize.transaction();
                    perCallOptions.transaction = t;

                    t.afterCommit(() => {
                        this.broadcastTransactionChanges(t);
                    });
                }

                const result = await func.call(this, data, perCallOptions);
                if (t) {
                    await t.commit();
                    this.transactionMonitor.finish(eventName, true); //transaction successful 
                    finished = true;
                }
                if (callback) {
                    callback({success: true, data: result});
                }
            } catch (err) {
                if (t) {
                    try {
                        await t.rollback();
                    } catch (rollbackError) {
                        this.logger.error(`Rollback of Transaction in Event: ${eventName} failed`);
                        this.logger.error(rollbackError.message);
                    }
                    this.transactionMonitor.finish(eventName, false); //transaction failed 
                    finished = true; 
                }

                console.log(err);
                this.logger.error(err.message);

                if (callback) {
                    const response = {success: false, message: err.message};
                    if (err.code) {
                        response.code = err.code;
                    }
                    callback(response);
                }
            }
            finally {
                if (t && !finished){
                    try {
                        await t.rollback();
                    } catch(err){
                        this.logger.error(`Transaction rollback in finally has failed for event: ${eventName}`);
                    }
                }
            }
        });
    }

    /**
     * Iterates over a list of items, executing an action for each one inside its own Sequelize
     * transaction. After each item, emits a `progressUpdate` event to the client if a
     * `progressId` was provided. Failures are caught per-item — a rollback is performed and
     * the item is skipped, so a single failure never aborts the remaining work.
     *
     * The `action` callback receives the current item and its open transaction. It is
     * responsible for all database work; committing and rolling back are handled by this
     * method. `transaction.afterCommit` hooks may be registered inside `action` and will be
     * called normally after a successful commit.
     *
     * @template T
     * @param {T[]} items         The list of items to process.
     * @param {string|null} progressId  Client-side progress token. When set, a `progressUpdate`
     *                                  event `{ id, current, total }` is emitted to the socket
     *                                  after every item (success or failure).
     * @param {function(item: T, transaction: import("sequelize").Transaction): Promise<void>} action
     *   Async callback invoked for each item. Receives the item and its transaction.
     *   Must **not** commit or roll back the transaction itself.
     * @returns {Promise<number>} The number of items that were processed successfully.
     */
    async runBulkWithProgress(items, progressId, action) {
        let count = 0;
        const total = items.length;

        for (let i = 0; i < total; i++) {
            const item = items[i];
            const transaction = await this.server.db.sequelize.transaction();
            try {
                await action(item, transaction);
                await transaction.commit();
                count++;
            } catch (e) {
                this.logger.error(e);
                await transaction.rollback();
            }

            if (progressId) {
                this.socket.emit("progressUpdate", { id: progressId, current: i + 1, total });
            }
        }

        return count;
    }

    /**
     * Broadcasts all autoTable changes collected on a transaction after commit.
     * @param {import("sequelize").Transaction} transaction
     */
    async broadcastTransactionChanges(transaction) {
        try {
            const defaultExcludes = ["deletedAt", "passwordHash", "salt"];
            if (transaction && transaction.changes) {
                const changesMap = transaction.changes.reduce((acc, entry) => {
                    if (entry.constructor.autoTable) {
                        const tableName = entry.constructor.tableName;
                        const entryData = _.omit(entry.dataValues, defaultExcludes);
                        if (!acc.has(tableName)) {
                            acc.set(tableName, []);
                        }
                        acc.get(tableName).push(entryData);
                    }
                    return acc;
                }, new Map());

                for (const [table, changes] of changesMap) {
                    this.broadcastTable(table, changes);
                }
            }
        } catch (e) {
            this.logger.error("Error in afterCommit sending data to client: " + e);
        }
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
     * Checks and caches whether the user is an admin.
     * Note: This method has side effects as it caches the admin status in `this.userInfo[userId].isUserAdmin`.
     * This can be problematic if the user's admin status changes
     * during their session, as the cached value won't automatically update.
     * @param {number} userId The id of the user to check admin privileges for
     * @param {Date} rolesUpdatedAt Date of the last role update of the user
     * @returns {Promise<boolean>} True if the user is an admin.
     */
    async isAdmin(userId = this.userId, rolesUpdatedAt = this.rolesUpdatedAt) {
        // admin has full rights, so return true directly
        if (!this.userInfo[userId] || rolesUpdatedAt > this.userInfo[userId].lastRolesUpdate) {
            await this.updateUserInfo(userId);
        }
        return this.userInfo[userId].isAdmin;
    }

    /**
     * Adds access information about the user userId in this.userInfo.
     * @param {number} userId The id of the user to update access for
     * @returns {void}
     */
    async updateUserInfo(userId) {
        const userAccess = {};
        const roleIds = await this.models["user_role_matching"].getUserRolesById(userId);
        userAccess.roles = roleIds;
        userAccess.isAdmin = await this.models["user_role_matching"].isAdminInUserRoles(roleIds);
        userAccess.rights = {};
        userAccess.lastRolesUpdate = new Date();
        this.userInfo[userId] = userAccess;
    }

    /**
     * Check if the user has this right
     * @param {string} right The name of the right to check
     * @param {number} userId The id of the user to check access for
     * @param {Date} rolesUpdatedAt Date of the last role update of the user
     * @returns {Promise<boolean>} True if the user has the right
     */
    async hasAccess(right, userId = this.userId, rolesUpdatedAt = this.rolesUpdatedAt) {
        // admin has full rights, so return true directly
        if (!this.userInfo[userId] || rolesUpdatedAt > this.userInfo[userId].lastRolesUpdate) {
            await this.updateUserInfo(userId);
        }
        const userInfo = this.userInfo[userId];

        if (userInfo.isAdmin) {
            return true;
        } else if (userInfo.rights[right]) {
            return userInfo.rights[right];
        } else {
            const hasAccess = await this.models["user_role_matching"].hasAccessByUserRoles(userInfo.roles, right);
            this.userInfo[userId].rights[right] = hasAccess;
            return hasAccess;
        }
    }

    /**
     * Check if the user has access
     * @param {number} userId The userId to check
     * @return {Promise<boolean>} True if the user has access
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
     * @return {Promise<boolean>} True if the user has document access
     */
    async checkDocumentAccess(documentId) {
        if ("DocumentSocket" in this.server.sockets) {
            return await this.getSocket("DocumentSocket").checkDocumentAccess(documentId);
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

    /**
     * Filters the access map to get rules relevant for the provided user.
     * @param {Object} accessMap The access map to filter
     * @param {number} userId User ID to check the rights for
     * @param {Date} rolesUpdatedAt Date of the last role update of the user
     * @returns {Object} filtered access map
     */
    async filterAccessMap(accessMap, userId, rolesUpdatedAt) {
        return await Promise.all(
            accessMap.map(async a => {
                let hasAccess = false;
                let limitation = undefined;
                if (a.right) {
                    hasAccess = await this.hasAccess(a.right, userId, rolesUpdatedAt);
                } else if (a.table) {
                    const count = await this.models[a.table].findAll({
                        attributes: [a.by, [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
                        where: {
                            ["userId"]: userId
                        },
                        group: a.by,
                        raw: true
                    }); // # [ { studyId: 29, count: '1' }, { studyId: 51, count: '1' } ]
                    hasAccess = count.some(c => c.count > 0);
                    limitation = count.map(c => c[a.by]);
                }
                return {
                    access: a,
                    hasAccess: hasAccess,
                    limitation: limitation
                }
            })
        );
    }

    /**
     * Creates database filters according to limitations in the accessMap.
     * @param {string} tableName The name of the table to create limitations for
     * @param {Object} allFilter Starting filters
     * @param {Object} accessMap AccessMap with limitations
     * @param {Array<Object>} accessRights Access rights for the user
     * @param {number} userId Id of user to check limitations for
     * @returns {Object} array of limitation filters
     */
    handleLimitations(tableName, allFilter, accessRights, accessMap, userId) {


        let filteredAccessMap = accessMap
            .flatMap(a => {
                const idField = a.access.target || 'id'; // Use 'target' if available, fallback to 'id'
                return a.limitation
                    ? {[idField]: {[Op.in]: [...new Set(a.limitation)]}}
                    : null;
            })
            .filter(Boolean);


        if (this.models[tableName].autoTable && 'userId' in this.models[tableName].getAttributes()) {
            // Ensure we always include the 'userId' condition
            filteredAccessMap = filteredAccessMap.concat([{userId: userId}]);
        }

        const limitedFilter = {
            [Op.and]: [
                allFilter,
                {
                    [Op.or]: filteredAccessMap
                }
            ]
        };

        const columns = [...new Set(
            accessRights
                .filter(a => a.columns)
                .flatMap(a => a.columns)
        )];

        return {filter: limitedFilter, columns};
    }

    /**
     * Modifies allFilter and allAttributes according to user rights in the table.
     * @param {number} userId User ID to check the rights for
     * @param {Object} allFilter Starting filters
     * @param {Object} allAttributes Starting attributes
     * @param {string} tableName The table to check the rights for
     * @param {Date} rolesUpdatedAt Date of the last role update of the user
     * @returns {Object} modified filters and attributes + whether access is allowed
     */
    async getFiltersAndAttributes(userId, allFilter, allAttributes, tableName, rolesUpdatedAt) {
        const accessMap = this.server.db.models[tableName]['accessMap'] || [];
        const filteredAccessMap = await this.filterAccessMap(accessMap, userId, rolesUpdatedAt);
        const relevantAccessMap = filteredAccessMap.filter(item => item.hasAccess);
        const accessRights = relevantAccessMap.map(item => item.access);
        const model = this.models[tableName];
        const hasModelUserFilter = typeof model.getUserFilter === "function";
        const isAdmin = await this.isAdmin(userId, rolesUpdatedAt);
        const isPublicOrAdmin = isAdmin || model.publicTable;
        const hasAccessRules = accessMap.length > 0;
        const hasUserIdAttribute = model.autoTable && 'userId' in model.getAttributes();

        // Early denial: not public/admin, has access rules, no matching rights, no user-filter, and no ownership fallback
        if (!isPublicOrAdmin && hasAccessRules && accessRights.length === 0 && !hasModelUserFilter && !hasUserIdAttribute) {
            this.logger.warn("User with id " + userId + " requested table " + tableName + " without access rights");
            return {filter: allFilter, attributes: allAttributes, accessAllowed: false};
        }

        // Collect row-visibility conditions from user filter and access-map limitations.
        // All conditions are combined with OR so the user sees the union of what each grants.
        // fullRowAccess=true means no row restriction is applied (admin, public table, or unlimited right).
        const rowVisibilityConditions = [];
        let fullRowAccess = isPublicOrAdmin;

        if (!fullRowAccess) {
            // --- Ownership: user always sees their own rows when table has userId ---
            if (hasUserIdAttribute) {
                rowVisibilityConditions.push({userId});
            }

            // --- Public rows: always visible regardless of ownership or access rights ---
            if ('public' in model.getAttributes()) {
                rowVisibilityConditions.push({public: true});
            }

            // --- User-level row filter ---
            if (hasModelUserFilter) {
                const userFilter = await model.getUserFilter(userId);
                if (Reflect.ownKeys(userFilter).length > 0) {
                    rowVisibilityConditions.push(userFilter);
                } else {
                    // getUserFilter returns {} → grants full row access (e.g. for admins)
                    fullRowAccess = true;
                }
            } else if (!hasUserIdAttribute && accessRights.length === 0) {
                this.logger.warn("User with id " + userId + " requested table " + tableName + " without access rights");
                return {filter: allFilter, attributes: allAttributes, accessAllowed: false};
            }

            // --- Access-map limitations (ORed with user filter conditions) ---
            if (!fullRowAccess && accessRights.length > 0) {
                const limitedAccessMap = relevantAccessMap.filter(item => item.limitation);
                const hasUnlimitedRights = accessRights.length > limitedAccessMap.length;

                if (hasUnlimitedRights) {
                    // At least one right has no limitation → unlimited row access for that right
                    fullRowAccess = true;
                } else if (limitedAccessMap.length > 0) {
                    // All rights carry limitations → add each as an additional OR condition
                    limitedAccessMap.forEach(a => {
                        const idField = a.access.target || 'id';
                        rowVisibilityConditions.push({[idField]: {[Op.in]: [...new Set(a.limitation)]}});
                    });
                }
            }
        }

        // --- Column restrictions from access rights (applied regardless of row logic) ---
        if (accessRights.length > 0) {
            allAttributes['include'] = [...new Set(
                accessRights
                    .filter(a => a.columns)
                    .flatMap(a => a.columns)
            )];
        }

        // Apply row-visibility: baseFilter AND (condition1 OR condition2 OR ...)
        // Skipped entirely when fullRowAccess is true (no row restriction needed).
        if (!fullRowAccess && rowVisibilityConditions.length > 0) {
            allFilter = {
                [Op.and]: [
                    allFilter,
                    rowVisibilityConditions.length === 1
                        ? rowVisibilityConditions[0]
                        : {[Op.or]: rowVisibilityConditions},
                ],
            };
        }
        return {filter: allFilter, attributes: allAttributes, accessAllowed: true};
    }

    /**
     * Handles injections of type count by executing COUNT queries and attaching the result to the data
     * @param {Object} injects Instructions on what to inject
     * @param {Object} data Data to query and extend
     * @returns {Object} data with attached COUNT results
     */
    async handleInjections(injects, data) {
        for (const injection of injects) {
            if (injection.type === "count") {
                const count = await this.models[injection.table].findAll({
                    attributes: [injection.by, [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
                    where: {
                        [injection.by]: {
                            [Op.in]: data.map((d) => d.id)
                        },
                    },
                    group: injection.by,
                    raw: true
                });
                // inject in data
                data = data.map((d) => {
                    d[injection.as] = Number(count.find((c) => c[injection.by] === d.id)?.count) || 0;
                    return d;
                });
            }
        }
        return data;
    }

    /**
     * Recursively send related (foreign + parent) table data for an autoTable.
     *
     * @param {string} tableName Name of the starting table
     * @param {Object[]} data Rows from that table
     * @param {string[]} excludedAttributes Attributes to be excluded and not sent
     * @param {Set<string>} visited Internal set of already processed tables (to avoid cycles)
     * @return {Promise<void>}
     */
    async sendRelatedTablesRecursive(
        tableName,
        data,
        excludedAttributes,
        visited = new Set()
    ) {

        if (visited.has(tableName)) {  // avoid infinite loops
            return;
        }
        visited.add(tableName);

        const {autoTable} = this.models[tableName];
        const tasks = [];

        // --- FOREIGN TABLES (children) ---
        if (autoTable.foreignTables && autoTable.foreignTables.length > 0) {
            const sourceIds = [...new Set(data.map(d => d.id).filter(Boolean))];

            for (const fTable of autoTable.foreignTables) {
                if (!this.models[fTable.table]) continue;
                if (sourceIds.length === 0) continue;

                const fdata = await this.models[fTable.table].getAll({
                    where: {[fTable.by]: {[Op.in]: sourceIds}, deleted: false},
                    attributes: {exclude: excludedAttributes},
                });

                this.emit(fTable.table + "Refresh", fdata, true);

                // recurse into foreign table’s related tables
                if (fdata.length > 0) {
                    tasks.push(
                        this.sendRelatedTablesRecursive(
                            fTable.table,
                            fdata,
                            excludedAttributes,
                            visited
                        )
                    );
                }
            }
        }

        // --- PARENT TABLES (parents) ---
        if (autoTable.parentTables && autoTable.parentTables.length > 0) {
            for (const pTable of autoTable.parentTables) {
                if (!this.models[pTable.table]) continue;

                const parentIds = [
                    ...new Set(
                        data
                            .map(d => d[pTable.by])
                            .filter(id => id !== null && id !== undefined)
                    ),
                ];
                if (parentIds.length === 0) continue;

                const pdata = await this.models[pTable.table].getAll({
                    where: {id: {[Op.in]: parentIds}, deleted: false},
                    attributes: {exclude: excludedAttributes},
                });

                this.emit(pTable.table + "Refresh", pdata, true);

                // recurse into parent table’s related tables
                if (pdata.length > 0) {
                    tasks.push(
                        this.sendRelatedTablesRecursive(
                            pTable.table,
                            pdata,
                            excludedAttributes,
                            visited
                        )
                    );
                }
            }
        }

        await Promise.all(tasks);
    }

    /**
     * Send table data to subscribed users
     * @param {string} tableName The name of table to send
     * @param {Array<Object>} filter Optional filters
     * @param {Array<Object>} injects Optional injects
     * @return {Promise<void>}
     */
    async sendTable(tableName, filter = [], injects = []) {

        // check if it is an autoTable or not
        if (!this.models[tableName] || !this.models[tableName].autoTable) {
            this.logger.error("Table " + tableName + " is not an autoTable");
            return;
        }

        let allFilter = {deleted: false};
        if (filter.length > 0) {
            allFilter[Op.or] = filter;
        }
        const defaultExcludes = ["deleted", "deletedAt", "rolesUpdatedAt", "initialPassword", "passwordHash", "salt"];
        let allAttributes = {
            exclude: defaultExcludes,
        };
        const filtersAndAttributes = await this.getFiltersAndAttributes(this.userId, allFilter, allAttributes, tableName, this.rolesUpdatedAt)
        if (!filtersAndAttributes.accessAllowed) {
            return;
        }

        allFilter = filtersAndAttributes.filter;
        allAttributes = filtersAndAttributes.attributes;
        let data = await this.models[tableName].getAll({
            where: allFilter,
            attributes: allAttributes,
        });

        // handle injects
        if (injects && injects.length > 0) {
            data = await this.handleInjections(injects, data);
        }

        // send additional data if needed
        await this.sendRelatedTablesRecursive(tableName, data, defaultExcludes);

        this.emit(tableName + "Refresh", data, true);
        return data;

    }

    /**
     * Retrieves foreign keys of table and sends data of foreign tables to the user
     * @param {String} table Table to find foreign keys for
     * @param {Object} data data to find IDs of relevant entries in
     * @param {number} userId User to send the data to
     * @param {boolean} includeForeignData True if foreign data should also be sent
     * @param {boolean} includeFieldTables True if field tables should also be sent
     * @return {void}
     */
    async sendForeignKeys(table, data, userId, includeForeignData = true, includeFieldTables = false) {
        const foreignKeys = await this.server.db.sequelize
            .getQueryInterface()
            .getForeignKeyReferencesForTable(table);
        foreignKeys
            .filter((fk) => this.autoTables.includes(fk.referencedTableName) && fk.referencedTableName !== table)
            .map(async (fk) => {
                const uniqueIds = data.map((d) => d[fk.columnName])
                    .filter(
                        (value, index, array) => array.indexOf(value) === index
                    );
                if (uniqueIds.length > 0) {
                    await this.sendTableData(
                        fk.referencedTableName,
                        [{key: "id", values: uniqueIds}],
                        [],
                        userId,
                        includeForeignData,
                        includeFieldTables
                    );
                }
            });
    }

    /**
     * Adds inclusions to the data and sends it to the user
     * @param {Array<Object>} include array of inclusions
     * @param {Object} data data to enrich with inclusions and send to user
     * @param {number} userId Id of the user to send the inclusions to
     * @param {boolean} includeForeignData True if foreign data should also be sent
     * @param {boolean} includeFieldTables True if field tables should also be sent
     * @returns {Object} enriched data object
     */
    async sendInclusions(include, data, userId, includeForeignData = true, includeFieldTables = false) {
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
        return data;
    }

    /**
     * Computes ids of entries in field table used in provided table and sends entries to user
     * @param {string} table table with table fields
     * @param {Object} data data to find field tables
     * @param {number} userId Id of the user to send the inclusions to
     * @param {boolean} includeForeignData True if foreign data should also be sent
     * @param {boolean} includeFieldTables True if field tables should also be sent
     * @return {void}
     */
    async sendFieldTables(table, data, userId, includeForeignData = true, includeFieldTables = false) {
        const fields = this.models[table].fields.filter(
            (f) => f.type === "choice" || f.type === "table"
        );
        for (const field of fields) {
            if ("table" in field.options) {
                // TODO we already have the object, so we don't need to query the database again in sendTableData
                const ids = (await Promise.all(data.map(async (d) => {
                        const tableData = await this.models[field.options.table].getAllByKey(
                            field.options.id,
                            d.id, {}, true);
                        return tableData.map((td) => td.id);
                    }
                ))).flat(1);

                if (ids.length > 0) {
                    await this.sendTableData(
                        field.options.table,
                        [{key: "id", values: ids}],
                        [],
                        userId,
                        includeForeignData,
                        includeFieldTables
                    );
                }
            }
        }
    }

    /**
     * Send auto table data to the clients
     * @param {string} table table to send data from
     * @param {Array<Object>} filter list of filter
     * @param {Object} include additional data to include
     * @param {number} userId user to send data to
     * @param {boolean} includeForeignData also includes data from foreign keys tables
     * @param {boolean} includeFieldTables also includes data from field tables
     * @return {Promise<void>}
     */
    async sendTableData(
        table,
        filter = [],
        include = [],
        userId = this.userId,
        includeForeignData = true,
        includeFieldTables = false,
    ) {
        try {
            const accessMap = this.server.db.models[table]['accessMap'];
            const accessChecks = await Promise.all(
                accessMap.map(a => this.hasAccess(a.right, userId))
            );
            const accessRights = accessMap.filter((a, idx) => accessChecks[idx]);
            if (!this.autoTables.includes(table) && accessRights.length === 0) {
                this.logger.error("No access rights for autotable: " + table);
                return;
            }

            let data = [];
            if (accessRights.length > 0 || await this.isAdmin(userId)) {
                const attributes = [...new Set(accessRights.flatMap(a => a.columns))];
                data = await this.models[table].getAutoTable(filter, userId, attributes);
            } else {
                data = await this.models[table].getAutoTable(filter, userId);
            }

            if (includeForeignData) {
                // send all foreign keys of table that are in autoTables
                this.sendForeignKeys(table, data, userId);
            }
            if (includeFieldTables) {
                this.sendFieldTables(table, data, userId, includeForeignData);
            }
            if (include.length > 0) {
                data = this.sendInclusions(include, data, userId, includeForeignData, includeFieldTables);
            }

            this.emit(table + "Refresh", data, true);
        } catch (err) {
            this.logger.error(err);
        }
    }

    /**
     * Checks for a database entry whether it matches all filters
     * @param {Object} entry the value to filter
     * @param {Object} filter Sequelize-like filters to use
     * @returns {boolean} true if all filters match
     */
    matchesFilter(entry, filter) {
        if (!filter) {
            return true;
        }
        if (filter[Op.and]) {
            return filter[Op.and].every(subfilter => this.matchesFilter(entry, subfilter));
        }
        if (filter[Op.or]) {
            return filter[Op.or].some(subfilter => this.matchesFilter(entry, subfilter));
        }
        return Object.entries(filter).every(([key, val]) => {
            if (val && typeof val === "object" && Op.in in val) {
                return Array.isArray(val[Op.in]) && val[Op.in].includes(entry[key]);
            }
            if (val && typeof val === "object" && Op.ne in val) {
                return entry[key] !== val[Op.ne];
            }
            return entry[key] === val;
        });
    }

    /**
     * Broadcasts data to all clients that have permissions to see it
     * @param {string} tableName The name of table
     * @param {object} data The data to broadcast
     * @returns {Promise<void>}
     */
    async broadcastTable(tableName, data) {
        const sockets = await this.io.fetchSockets();
        if (!sockets) return;
        for (const socket of sockets) {
            if (!(tableName in socket.appDataSubscriptions.tables)) {
                continue;
            }
            const userId = socket.user.id;
            const rolesUpdatedAt = socket.user.rolesUpdatedAt;
            // if the changes come from same user, just send
            if (socket.user.id === this.userId) {
                this.io.to(socket.id).emit(tableName + "Refresh", data);
                continue
            }
            const model = this.models[tableName];
            const hasModelUserFilter = typeof model.getUserFilter === "function";
            const hasBroadcastExpander = typeof model.expandBroadcastFilter === "function";
            const isAdmin = await this.isAdmin(userId, rolesUpdatedAt);
            const isPublicTable = model.publicTable;
            
            // if socket is admin or table is public, also just send (unless model requires per-user filtering/expansion)
            if (!hasModelUserFilter && !hasBroadcastExpander && (isAdmin || isPublicTable)) {
                this.io.to(socket.id).emit(tableName + "Refresh", data);
                continue
            }
            let allFilter = {};
            let allAttributes = {};
            const filtersAndAttributes = await this.getFiltersAndAttributes(userId, allFilter, allAttributes, tableName, rolesUpdatedAt)
            if (!filtersAndAttributes.accessAllowed) {
                continue;
            }
            allFilter = filtersAndAttributes.filter;
            // Allow models to expand the broadcast filter (e.g. templates: source templates of user's copies)
            if (hasBroadcastExpander) {
                allFilter = await model.expandBroadcastFilter(allFilter, userId, isAdmin);
            }
            const filteredData = data.filter(entry => this.matchesFilter(entry, allFilter));
            this.io.to(socket.id).emit(tableName + "Refresh", filteredData);
        }
        ;
    }

    /**
     * Builds a snapshot of all active sessions.
     * @param {string|null} excludeSocketId Exclude this socket (used on disconnect, before Server.js removes it)
     * @returns {Promise<object>}
     */
    async buildStats(excludeSocketId = null) {
        const activeSockets = Object.entries(this.server.availSockets)
            .filter(([sid]) => sid !== excludeSocketId);

        const sessionCountByUser = {};
        for (const [, socketMap] of activeSockets) {
            const uid = socketMap["UserSocket"]?.userId;
            if (uid != null) sessionCountByUser[uid] = (sessionCountByUser[uid] || 0) + 1;
        }

        const sessions = (
            await Promise.all(
                activeSockets.map(async ([sid, socketMap]) => {
                    const inst = socketMap["UserSocket"];
                    if (!inst?.socket.connectedAt) return null;
                    return {
                        socketId: sid,
                        userId: inst.userId,
                        userName: await inst.resolveUserName(inst.userId),
                        connectedAt: inst.socket.connectedAt,
                        browser: inst.socket.browser,
                    };
                })
            )
        ).filter(Boolean);

        const seen = new Set();
        const connectedUsers = [];
        for (const [, socketMap] of activeSockets) {
            const inst = socketMap["UserSocket"];
            if (!inst?.socket.connectedAt || seen.has(inst.userId)) continue;
            seen.add(inst.userId);
            connectedUsers.push({
                userId: inst.userId,
                userName: await inst.resolveUserName(inst.userId),
                sessionCount: sessionCountByUser[inst.userId] || 0,
            });
        }

        return { activeSessions: activeSockets.length, activeUsers: seen.size, connectedUsers, sessions };
    }
}
;
