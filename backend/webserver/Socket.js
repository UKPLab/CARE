const {inject} = require("../utils/helper/generic");
const i18n = require("../utils/i18n");
const TranslatableError = require("../utils/TranslatableError");
const {Sequelize, Op} = require("sequelize");
const _ = require("lodash");
const {EWMAMonitor} = require("../utils/EWMAMonitor")
const {mergeFilter} = require("../utils/helper/data.js");
const {buildQueryTableSearch, MAX_SEARCH_LENGTH, viewSearchFields} = require("../utils/helper/queryTableSearch.js");
const {buildQueryTableColumnFilters, columnFiltersNeedViewJoin} = require("../utils/helper/queryTableColumnFilters.js");
const {dashboardSortInclude} = require("../utils/helper/queryTableJoinSort.js");
const {ensureStudyDashboardSortFresh} = require("../db/studyDashboardSortRefresh.js");
const {SECRET_COLUMN_SET, hiddenColumns} = require("../utils/helper/sensitiveColumns.js");
const {positiveInt} = require("../utils/helper/positiveInt.js");

// Upper bound for a query-scoped bulk ("select all matching")
const MAX_BULK_SELECTION = 100000;

// Upper bound for an explicit id list sent by the client (one page / a few pages of picks).
const MAX_EXPLICIT_SELECTION = 10000;

// Rows a single broadcast may animate row by row in query-mode; above this the client refetches.
const MAX_DELTA_ROWS = 100;

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

        // user rights in form: userId: {isAdmin: false, rights: {right1: false, ..}, roles: [role1, ..], lastRolesUpdate: Date, rolesUpdatedAtMs}
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

                // i18n error hub: TranslatableError, generateError(code, key);
                // legacy: plain Error("errors.*") still resolved via hasKey(err.message)
                // Log the key; SQLTransport translates to English. Frontend gets key+params (resolveApiMessage).
                let key;
                let params = {};
                if (TranslatableError.is(err)) {
                    // TranslatableError / generateError: err.key + optional err.params (+ optional err.code)
                    key = err.key;
                    if (err.params) {
                        params = err.params;
                    }
                } else if (typeof err.message === "string" && i18n.hasKey(err.message)) {
                    // legacy plain Error("errors.namespace.key")
                    key = err.message;
                    if (err.params) {
                        params = err.params;
                    }
                }

                if (key) {
                    this.logger.error(key, { i18nParams: params });
                    if (callback) {
                        // key/params → localized UI; message (EN) → legacy fallback
                        const response = {
                            success: false,
                            key,
                            params,
                            message: i18n.translateMaybeKey(key, params),
                        };
                        if (err.code) {
                            response.code = err.code;
                        }
                        callback(response);
                    }
                } else {
                    // Not an i18n key (bug, DB failure, etc.): log full detail, generic message to user
                    this.logger.error({
                        message: err.message,
                        stack: err.stack,
                        name: err.name,
                    });
                    if (callback) {
                        const unexpectedKey = "errors.server.unexpectedError";
                        callback({
                            success: false,
                            key: unexpectedKey,
                            params: {},
                            message: i18n.translateMaybeKey(unexpectedKey),
                        });
                    }
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
        // A progress bar cannot show more than ~100 steps; a select-all over the whole table would
        // otherwise emit one event per row.
        const progressEvery = Math.max(1, Math.floor(total / 100));

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

            if (progressId && ((i + 1) % progressEvery === 0 || i + 1 === total)) {
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
            if (transaction && transaction.changes) {
                const changesMap = transaction.changes.reduce((acc, entry) => {
                    if (entry.constructor.autoTable) {
                        const tableName = entry.constructor.tableName;
                        const entryData = {...entry.dataValues};
                        const operation = entry._broadcastOp
                            || (entryData.deleted ? "delete" : "update");
                        if (!acc.has(tableName)) {
                            acc.set(tableName, new Map());
                        }
                        const byOp = acc.get(tableName);
                        if (!byOp.has(operation)) {
                            byOp.set(operation, []);
                        }
                        byOp.get(operation).push(entryData);
                    }
                    return acc;
                }, new Map());

                const companionBroadcasts = [];
                for (const [table, byOp] of changesMap) {
                    const model = this.models[table];
                    if (typeof model?.getCompanionBroadcasts === "function") {
                        for (const [operation, rows] of byOp) {
                            companionBroadcasts.push(...model.getCompanionBroadcasts(rows, operation));
                        }
                    }
                    // Mixed ops in one txn (e.g. study create+update): pass null so query-mode gets Stale.
                    // Same-op bulk (e.g. multi-delete): pass the operation so clients get per-row Deltas.
                    if (byOp.size > 1) {
                        const allRows = [...byOp.values()].flat();
                        this.broadcastTable(table, allRows, null);
                    } else {
                        for (const [operation, rows] of byOp) {
                            this.broadcastTable(table, rows, operation);
                        }
                    }
                }
                for (const {table, rows, operation} of companionBroadcasts) {
                    let payload = rows;
                    // Companion rows are often {id} stubs — load full rows so ACL filters work.
                    if (payload.length && payload.every((r) => r?.id != null && Object.keys(r).length === 1)) {
                        const ids = payload.map((r) => r.id);
                        payload = await this.models[table].getAll({
                            where: {id: {[Op.in]: ids}, deleted: false},
                        });
                    }
                    await this.broadcastTable(table, payload, operation);
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
     * Resolve the user's rolesUpdatedAt as a millisecond timestamp.
     * Prefers the DB value so mid-session role changes are visible; falls back to the hint.
     * Relies on User.cache being cleared when roles change.
     * @param {number} userId The user id
     * @param {Date} [rolesUpdatedAt] Date of the last role update of the user
     * @returns {Promise} Millisecond timestamp of user.rolesUpdatedAt, or null if unavailable
     */
    async getRolesUpdatedAtMs(userId, rolesUpdatedAt = null) {
        try {
            const user = await this.models["user"].findByPk(userId, {
                attributes: ["rolesUpdatedAt"],
                raw: true,
            });
            if (user?.rolesUpdatedAt) {
                return new Date(user.rolesUpdatedAt).getTime();
            }
        } catch (_err) {
            // fall through to hint
        }
        if (rolesUpdatedAt) {
            return new Date(rolesUpdatedAt).getTime();
        }
        return null;
    }

    /**
     * Checks and caches whether the user is an admin.
     * Reloads roles when DB user.rolesUpdatedAt differs from the cached timestamp so
     * mid-session role changes are enforced without reconnecting.
     * @param {number} userId The id of the user to check admin privileges for
     * @param {Date} rolesUpdatedAt Date of the last role update of the user
     * @returns {Promise<boolean>} True if the user is an admin.
     */
    async isAdmin(userId = this.userId, rolesUpdatedAt = this.rolesUpdatedAt) {
        const rolesUpdatedAtMs = await this.getRolesUpdatedAtMs(userId, rolesUpdatedAt);
        const cached = this.userInfo[userId];
        if (!cached || cached.rolesUpdatedAtMs !== rolesUpdatedAtMs) {
            await this.updateUserInfo(userId, rolesUpdatedAtMs);
        }
        return this.userInfo[userId].isAdmin;
    }

    /**
     * Adds access information about the user userId in this.userInfo.
     * @param {number} userId The id of the user to update access for
     * @param {number|null} [rolesUpdatedAtMs] Millisecond timestamp of user.rolesUpdatedAt when known
     * @returns {Promise<void>}
     */
    async updateUserInfo(userId, rolesUpdatedAtMs = null) {
        const userAccess = {};
        const roleIds = await this.models["user_role_matching"].getUserRolesById(userId);
        userAccess.roles = roleIds;
        userAccess.isAdmin = await this.models["user_role_matching"].isAdminInUserRoles(roleIds);
        userAccess.rights = {};
        userAccess.lastRolesUpdate = new Date();
        userAccess.rolesUpdatedAtMs = rolesUpdatedAtMs;
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
        // isAdmin refreshes the rights cache when rolesUpdatedAt changed
        if (await this.isAdmin(userId, rolesUpdatedAt)) {
            return true;
        }
        const userInfo = this.userInfo[userId];

        if (userInfo.rights[right] !== undefined) {
            return userInfo.rights[right];
        }
        const hasAccess = await this.models["user_role_matching"].hasAccessByUserRoles(userInfo.roles, right);
        this.userInfo[userId].rights[right] = hasAccess;
        return hasAccess;
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
            // --- User-level row filter (authoritative when present, e.g. template type rules) ---
            if (hasModelUserFilter) {
                const userFilter = await model.getUserFilter(userId, isAdmin);
                if (Reflect.ownKeys(userFilter).length > 0) {
                    rowVisibilityConditions.push(userFilter);
                } else {
                    // getUserFilter returns {} → grants full row access (e.g. for admins)
                    fullRowAccess = true;
                }
            } else {
                // --- Ownership: user always sees their own rows when table has userId ---
                if (hasUserIdAttribute) {
                    rowVisibilityConditions.push({userId});
                }

                // --- Public rows: always visible regardless of ownership or access rights ---
                if ('public' in model.getAttributes()) {
                    rowVisibilityConditions.push({public: true});
                } else if (!hasUserIdAttribute && accessRights.length === 0) {
                    this.logger.warn("User with id " + userId + " requested table " + tableName + " without access rights");
                    return {filter: allFilter, attributes: allAttributes, accessAllowed: false};
                }
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

        // --- Column restrictions from access rights (admins bypass, everyone else is restricted) ---
        if (!isAdmin && accessRights.length > 0) {
            const columns = [...new Set(accessRights.filter(a => a.columns).flatMap(a => a.columns))];
            if (columns.length > 0) {
                // Pass a plain array so Sequelize restricts to only these columns.
                // { exclude, include } is NOT the same — include there adds virtual attrs, not restricts.
                allAttributes = columns;
            }
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
     * Row scope of one queryTable request: ACL filter + client filter + search-bar tokens + free text.
     *
     * Everything that decides *which rows match* lives here, so a query-scoped bulk (select all
     * matching) resolves exactly the rows the same viewer can list — sorting and paging are the
     * caller's business.
     *
     * @param {Object} params
     * @param {string} params.table autoTable name
     * @param {Array} [params.filter] subscribeAppData-style filter items from the client
     * @param {Object} [params.query] { search, columnFilters, searchColumns }
     * @param {Object} [params.scope] consumer scope a filter item cannot express (e.g. Publish
     *   Assessment's configuration + workflow-step selection); the model reads it
     * @returns {Promise<Object>} model, attributes, where, allAttributes, allowedAttributeNames,
     *   injectCtx, filterSpec, columnFilters, search, searchColumns, needsViewJoin, usesStateView
     */
    async resolveQueryTableScope({table, filter = [], query = {}, scope = null}) {
        if (!table) {
            throw new TranslatableError("errors.validation.tableNameRequired");
        }
        if (!this.models[table] || !this.models[table].autoTable) {
            throw new Error(`${table} is not an autoTable`);
        }

        const model = this.models[table];
        const attributes = model.getAttributes();

        let allFilter = {deleted: false};
        const mergedClientFilter = mergeFilter([Array.isArray(filter) ? filter : []], attributes);
        if (mergedClientFilter.length > 0) {
            allFilter[Op.or] = mergedClientFilter;
        }

        const defaultExcludes = hiddenColumns();
        let allAttributes = {exclude: defaultExcludes};
        // Who may see which rows/columns: admin/fullAccess → all rows in scope; regular user → mainly own rows (userId).
        const filtersAndAttributes = await this.getFiltersAndAttributes(
            this.userId, allFilter, allAttributes, table, this.rolesUpdatedAt
        );
        if (!filtersAndAttributes.accessAllowed) {
            throw new TranslatableError("errors.permission.noPermissionToAccesData");
        }
        allFilter = filtersAndAttributes.filter;
        allAttributes = filtersAndAttributes.attributes;

        const allowedAttributeNames = Array.isArray(allAttributes)
            ? allAttributes
            : Object.keys(attributes).filter((name) => !(allAttributes.exclude || []).includes(name));
        const injectCtx = {
            userId: this.userId,
            rolesUpdatedAt: this.rolesUpdatedAt,
            hasAccess: (right) => this.hasAccess(right, this.userId, this.rolesUpdatedAt),
            isAdmin: () => this.isAdmin(this.userId, this.rolesUpdatedAt),
            // Nested scopes (e.g. reviewer "from previous sessions") re-resolve another table's
            // query-scoped selection without shipping id lists through the client.
            resolveQueryTableIds: (params) => this.resolveQueryTableIds(params),
        };

        // Rows a wizard step means but a filter item cannot name (join over other tables). The model
        // validates the request and owns the SQL; an unusable scope must throw there, not widen the list.
        if (scope && typeof model.getQueryTableScopeFilter === "function") {
            const scopeWhere = await model.getQueryTableScopeFilter(scope, injectCtx);
            if (scopeWhere) {
                allFilter = {[Op.and]: [allFilter, scopeWhere]};
            }
        }

        // Search-bar filter tokens
        const columnFilters = query.columnFilters && typeof query.columnFilters === "object"
            ? query.columnFilters
            : null;
        let filterSpec = null;
        if (columnFilters && Object.keys(columnFilters).length > 0) {
            filterSpec = typeof model.getQueryTableFilterColumns === "function"
                ? await model.getQueryTableFilterColumns(injectCtx)
                : null;
            const columnWhere = buildQueryTableColumnFilters({
                model,
                columnFilters,
                filterSpec,
                allowedAttributeNames,
            });
            if (columnWhere) {
                allFilter = {[Op.and]: [allFilter, columnWhere]};
            }
        }

        const search = typeof query.search === "string"
            ? query.search.trim().slice(0, MAX_SEARCH_LENGTH)
            : "";
        let searchColumns = null;
        if (search) {
            const injects = await this.resolveQueryTableInjects(model, this.userId, this.rolesUpdatedAt);
            searchColumns = typeof model.getQueryTableSearchColumns === "function"
                ? await model.getQueryTableSearchColumns(injectCtx)
                : null;
            searchColumns = this.narrowSearchColumns(searchColumns, query.searchColumns);
            const searchWhere = buildQueryTableSearch({
                model,
                search,
                allowedAttributeNames,
                injects,
                searchColumns,
            });
            if (searchWhere) {
                allFilter = {[Op.and]: [allFilter, searchWhere]};
            }
        }

        const viewFields = viewSearchFields(model);
        const searchNeedsView = !!(search && viewFields.some((spec) => !searchColumns || searchColumns.includes(spec.key)));
        const needsViewJoin = columnFiltersNeedViewJoin(filterSpec, columnFilters) || searchNeedsView;
        const usesStateView = !!(filterSpec && columnFilters && Object.keys(columnFilters).some(
            (key) => filterSpec[key]?.viewField === "state"
        )) || !!(search && viewFields.some((spec) => spec.field === "state"
            && (!searchColumns || searchColumns.includes(spec.key))));

        return {
            model,
            attributes,
            where: allFilter,
            allAttributes,
            allowedAttributeNames,
            injectCtx,
            filterSpec,
            columnFilters,
            search,
            searchColumns,
            needsViewJoin,
            usesStateView,
        };
    }

    /**
     * Narrow the model's searchable keys to the columns a consumer actually shows.
     *
     * The model list stays the outer bound (a client cannot widen it); a table that renders fewer
     * columns passes its own subset so free text never matches a field the user cannot see there.
     * @param {string[]|null} modelColumns
     * @param {*} requested client-sent allow-list
     * @returns {string[]|null}
     */
    narrowSearchColumns(modelColumns, requested) {
        if (!Array.isArray(modelColumns) || !Array.isArray(requested) || requested.length === 0) {
            return modelColumns;
        }
        const wanted = new Set(requested.filter((key) => typeof key === "string"));
        const narrowed = modelColumns.filter((key) => wanted.has(key));
        // An empty intersection means the request was nonsense; fall back to the model list instead
        // of searching nothing (which would silently match every row).
        return narrowed.length > 0 ? narrowed : modelColumns;
    }

    /**
     * Ids of every row a query matches — the server-side form of "select all matching".
     *
     * Never trusts the client's row list: `includeIds` is intersected with the same ACL scope the
     * list query uses, and `excludeIds` (rows the user unchecked after select-all) is subtracted.
     *
     * @param {Object} params
     * @param {string} params.table autoTable name
     * @param {Array} [params.filter] client filter items (same as queryTable)
     * @param {Object} [params.query] { search, columnFilters, searchColumns }
     * @param {Object} [params.scope] consumer scope
     * @param {Array<number>} [params.excludeIds] rows unchecked after select-all
     * @param {Array<number>} [params.includeIds] restrict to these ids (explicit selection)
     * @returns {Promise<number[]>}
     */
    async resolveQueryTableIds({table, filter = [], query = {}, scope: scopeParams = null, excludeIds = [], includeIds = null}) {
        const scope = await this.resolveQueryTableScope({table, filter, query, scope: scopeParams});
        const conditions = [scope.where];

        const excluded = this.sanitizeIds(excludeIds, MAX_BULK_SELECTION);
        if (excluded.length > 0) {
            conditions.push({id: {[Op.notIn]: excluded}});
        }
        if (includeIds !== null) {
            const included = this.sanitizeIds(includeIds, MAX_EXPLICIT_SELECTION);
            if (included.length === 0) {
                return [];
            }
            conditions.push({id: {[Op.in]: included}});
        }

        const findOptions = {
            where: conditions.length === 1 ? conditions[0] : {[Op.and]: conditions},
            attributes: ["id"],
            order: [["id", "ASC"]],
            raw: true,
            limit: MAX_BULK_SELECTION + 1,
        };
        const viewJoin = await this.applyViewJoin({
            needed: scope.needsViewJoin,
            usesStateView: scope.usesStateView,
        });
        if (viewJoin) {
            Object.assign(findOptions, viewJoin.join);
        }

        const rows = await scope.model.findAll(findOptions);
        if (rows.length > MAX_BULK_SELECTION) {
            throw new TranslatableError("errors.queryTable.selectionTooLarge", {limit: MAX_BULK_SELECTION});
        }
        return rows.map((row) => row.id);
    }

    /**
     * Refresh `study_dashboard_sort` and build the INNER JOIN when a query reads the view.
     *
     * @param {Object} params
     * @param {boolean} params.needed filter, search, or sort reads the view
     * @param {boolean} [params.usesStateView] refresh the state column, not only the session count
     * @returns {Promise<{sortModel: import("sequelize").Model, join: {include: Object[], subQuery: false}}|null>}
     */
    async applyViewJoin({needed = false, usesStateView = false} = {}) {
        if (!needed) {
            return null;
        }
        const sortModel = this.models["study_dashboard_sort"];
        if (!sortModel) {
            throw new Error("study_dashboard_sort is not available");
        }
        await ensureStudyDashboardSortFresh(
            this.server.db.sequelize,
            usesStateView ? "stateRank" : "sessions"
        );
        return {
            sortModel,
            join: {include: [dashboardSortInclude(sortModel)], subQuery: false},
        };
    }

    /**
     * Positive integer ids only; duplicates dropped.
     * @param {*} ids
     * @param {number} max
     * @returns {number[]}
     * @throws {TranslatableError} when the cleaned list is longer than max
     */
    sanitizeIds(ids, max) {
        if (!Array.isArray(ids)) {
            return [];
        }
        const clean = [...new Set(ids.map((id) => positiveInt(id)).filter(Boolean))];
        if (clean.length > max) {
            throw new TranslatableError("errors.queryTable.idListTooLarge", {limit: max});
        }
        return clean;
    }

    /**
     * Restrict client-supplied subscribeAppData injects to a safe whitelist.
     *
     * Injects flow into handleInjections. Two of its branches are dangerous with client input:
     * `sql` evaluates a client string as raw SQL (Sequelize.literal), and `parent`/`count` accept a
     * client-chosen table and column list. A subscribing client is therefore allowed only:
     *   - `count`: related-row counts against a real autoTable, plain string keys, no `where`.
     *   - `parent`: flatten a real autoTable's columns onto each row, but never sensitive/credential
     *     columns (passwordHash, apiKey, initialPassword, ...) and only with an explicit field list.
     * `sql` and any client-supplied `where` are dropped entirely. A `parent` field list is then
     * cut to the columns that table's accessMap grants this viewer, so firstName/lastName/email
     * on `user` stay behind userPrivateInfo the way a direct subscribe does.
     *
     * @param {*} injects client-sent inject list
     * @returns {Promise<Array<Object>>} sanitized injects (possibly empty)
     */
    async sanitizeClientInjects(injects) {
        if (!Array.isArray(injects)) {
            return [];
        }
        // Columns a client may never pull onto a row via a parent inject, regardless of table.
        const forbiddenInjectFields = new Set(hiddenColumns());
        const isAutoTable = (table) => typeof table === "string" && !!this.models[table]?.autoTable;

        return (await Promise.all(injects
            .map(async (inject) => {
                if (!inject || !isAutoTable(inject.table)) {
                    return null;
                }
                if (inject.type === "count" && typeof inject.by === "string" && typeof inject.as === "string") {
                    // No client `where`: a count is scoped to the visible rows' foreign keys only.
                    return {
                        type: "count",
                        table: inject.table,
                        by: inject.by,
                        as: inject.as,
                        on: typeof inject.on === "string" ? inject.on : "id",
                    };
                }
                if (inject.type === "parent" && typeof inject.by === "string") {
                    // Require an explicit field list (no "dump every column" fallback for clients)
                    // and strip anything sensitive, then anything this viewer may not read.
                    const requested = Array.isArray(inject.fields)
                        ? inject.fields.filter((f) => typeof f === "string" && !forbiddenInjectFields.has(f))
                        : [];
                    const fields = await this.allowedParentInjectFields(inject.table, requested);
                    if (fields.length === 0) {
                        return null;
                    }
                    return {
                        type: "parent",
                        table: inject.table,
                        by: inject.by,
                        fields,
                    };
                }
                // sql injects and anything else are not allowed from a client.
                return null;
            })))
            .filter(Boolean);
    }

    /**
     * Columns of a parent table this viewer may copy onto a subscribed row.
     * Tables with an accessMap of column lists (user: public vs private info) keep only the
     * columns of the rights the viewer holds. Admin keeps the requested list. A table with no
     * such column rules is unchanged.
     * @param {string} table parent table name
     * @param {Array<string>} fields requested column names
     * @returns {Promise<Array<string>>}
     */
    async allowedParentInjectFields(table, fields) {
        if (!fields.length) {
            return [];
        }
        const accessMap = this.models[table]?.accessMap || [];
        const columnRules = accessMap.filter((rule) => Array.isArray(rule.columns) && rule.right);
        if (columnRules.length === 0 || await this.isAdmin()) {
            return fields;
        }
        const allowed = new Set();
        for (const rule of columnRules) {
            if (await this.hasAccess(rule.right)) {
                rule.columns.forEach((column) => allowed.add(column));
            }
        }
        return fields.filter((field) => allowed.has(field));
    }

    /**
     * Resolve queryTable inject specs for a model and viewer.
     * Models may define static getQueryTableInjects(ctx).
     * @param {Object} model Sequelize model
     * @param {number} userId
     * @param {Date} rolesUpdatedAt
     * @returns {Promise<Array<Object>>}
     */
    async resolveQueryTableInjects(model, userId, rolesUpdatedAt) {
        if (typeof model.getQueryTableInjects !== "function") {
            return [];
        }
        return model.getQueryTableInjects({
            userId,
            rolesUpdatedAt,
            hasAccess: (right) => this.hasAccess(right, userId, rolesUpdatedAt),
        });
    }

    /**
     * Attach related-table fields to queryTable / query-mode delta rows.
     * @param {string} tableName autoTable name
     * @param {Object[]} items rows to enrich
     * @param {number} userId viewer
     * @param {Date} rolesUpdatedAt
     * @returns {Promise<Object[]>}
     */
    async enrichQueryTableItems(tableName, items, userId, rolesUpdatedAt) {
        if (!items?.length) {
            return items || [];
        }
        const model = this.models[tableName];
        const injects = await this.resolveQueryTableInjects(model, userId, rolesUpdatedAt);
        if (!injects.length) {
            return items;
        }
        return this.handleInjections(injects, items.map((row) => ({...row})));
    }

    /**
     * Handles injections for queryTable rows and legacy sendTable snapshots.
     * Supports count (related row counts), parent (flatten parent columns onto each row) and
     * sql (model-owned scalar expressions for values no single parent hop can reach).
     * @param {Object} injects Instructions on what to inject
     * @param {Object} data Data to query and extend
     * @returns {Object} data with attached COUNT / parent-field / expression results
     */
    async handleInjections(injects, data) {
        if (!data?.length) {
            return data || [];
        }
        for (const injection of injects) {
            if (injection.type === "count") {
                const sourceKey = injection.on || "id";
                const fkValues = [...new Set(data.map((d) => d[sourceKey]).filter((id) => id != null))];
                if (!fkValues.length) {
                    continue;
                }
                const injectModel = this.models[injection.table];
                const where = {
                    [injection.by]: {[Op.in]: fkValues},
                };
                if (injection.where) {
                    Object.assign(where, injection.where);
                } else if (injectModel && "deleted" in injectModel.getAttributes()) {
                    where.deleted = false;
                }
                const count = await injectModel.findAll({
                    attributes: [injection.by, [Sequelize.fn("COUNT", Sequelize.col("id")), "count"]],
                    where,
                    group: injection.by,
                    raw: true,
                });
                data = data.map((d) => {
                    d[injection.as] = Number(count.find((c) => c[injection.by] === d[sourceKey])?.count) || 0;
                    return d;
                });
            } else if (injection.type === "parent") {
                const parentIds = [...new Set(data.map((d) => d[injection.by]).filter((id) => id != null))];
                if (!parentIds.length) {
                    continue;
                }
                const parentModel = this.models[injection.table];
                const parentWhere = {id: {[Op.in]: parentIds}, deleted: false};
                // Always include id — Sequelize attributes arrays do not auto-add PK,
                // and without it byId lookup below fails (firstName/lastName never attached).
                const parentAttrs = injection.fields?.length
                    ? ["id", ...injection.fields.filter((f) => f !== "id")]
                    : {exclude: hiddenColumns()};
                const parents = await parentModel.findAll({
                    where: parentWhere,
                    attributes: parentAttrs,
                    raw: true,
                });
                const byId = Object.fromEntries(parents.map((p) => [p.id, p]));
                const fields = injection.fields || Object.keys(parents[0] || {}).filter((k) => k !== "id");
                data = data.map((d) => {
                    const parent = byId[d[injection.by]];
                    for (const field of fields) {
                        // Always set the key so FE visibleColumns (hasOwnProperty) keeps the column
                        d[field] = parent ? parent[field] : null;
                    }
                    return d;
                });
            } else if (injection.type === "sql") {
                // Values behind more than one hop (e.g. a session's study owner or submission).
                const fields = Object.entries(injection.fields || {});
                const sourceKey = injection.on || "id";
                const keys = [...new Set(data.map((d) => d[sourceKey]).filter((id) => id != null))];
                if (!fields.length || !keys.length) {
                    continue;
                }
                const sqlModel = this.models[injection.table];
                const rows = await sqlModel.findAll({
                    where: {[sourceKey]: {[Op.in]: keys}},
                    attributes: [sourceKey, ...fields.map(([alias, sql]) => [Sequelize.literal(sql), alias])],
                    raw: true,
                });
                const byKey = new Map(rows.map((row) => [row[sourceKey], row]));
                data = data.map((d) => {
                    const extra = byKey.get(d[sourceKey]);
                    for (const [alias] of fields) {
                        d[alias] = extra ? extra[alias] : null;
                    }
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
        const defaultExcludes = hiddenColumns();
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
                const attributes = [...new Set(accessRights.filter(a => a.columns).flatMap(a => a.columns))];
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
     * Model columns this viewer may receive. Null means every non-secret column (admin,
     * a table whose access map does not list columns, or a viewer with no column grant).
     * @param {string} tableName
     * @param {number} userId
     * @param {Date} rolesUpdatedAt
     * @returns {Promise<Set<string>|null>}
     */
    async broadcastColumnAllowList(tableName, userId, rolesUpdatedAt) {
        if (await this.isAdmin(userId, rolesUpdatedAt)) {
            return null;
        }
        const model = this.models[tableName];
        const accessMap = model?.accessMap || [];
        const listsColumns = accessMap.some((rule) => rule.columns);
        if (!listsColumns) {
            return null;
        }
        const filters = await this.getFiltersAndAttributes(
            userId, {}, {exclude: []}, tableName, rolesUpdatedAt
        );
        const listed = filters.attributes;
        if (!Array.isArray(listed)) {
            return null;
        }
        const names = new Set();
        for (const item of listed) {
            if (typeof item === "string") {
                names.add(item);
            } else if (item && typeof item === "object") {
                for (const key of Object.keys(item)) {
                    names.add(key);
                }
            }
        }
        return names;
    }

    /**
     * Drops secret columns from a live update. Keeps id and deleted.
     * When allowed is set, also keeps only those columns.
     * @param {Object[]} rows
     * @param {Set<string>|null} allowed null keeps every non-secret column
     * @returns {Object[]}
     */
    projectBroadcastRows(rows, allowed) {
        const secret = new Set([...SECRET_COLUMN_SET, "deletedAt"]);
        return (rows || []).map((row) => {
            if (!row || typeof row !== "object") {
                return row;
            }
            const projected = {};
            for (const [key, value] of Object.entries(row)) {
                if (secret.has(key)) {
                    continue;
                }
                if (key === "id" || key === "deleted") {
                    projected[key] = value;
                    continue;
                }
                if (allowed && !allowed.has(key)) {
                    continue;
                }
                projected[key] = value;
            }
            return projected;
        });
    }

    /**
     * Broadcasts data to all clients that have permissions to see it.
     * A Vuex subscription gets {table}Refresh.
     * A mounted BackendTable gets {table}Delta or {table}Stale.
     * @param {string} tableName The name of table
     * @param {object|Array} data The data to broadcast
     * @param {string|null} [operation] create|update|delete — null means bulk/unknown → Stale for query-mode
     * @returns {Promise<void>}
     */
    async broadcastTable(tableName, data, operation = null) {
        const sockets = await this.io.fetchSockets();
        if (!sockets) return;
        const rows = Array.isArray(data) ? data : [data];
        // Who committed: FE uses this on Delta/Stale (own tab applies now, others may banner).
        const originSocketId = this.socket?.id || null;
        // One allow-list per user for this broadcast. Several tabs share a userId.
        const columnAllowCache = new Map();

        for (const socket of sockets) {
            const queryHolds = socket.currentQueries?.[tableName];
            const isQueryMode = typeof queryHolds === "number" && queryHolds > 0;
            const hasSubscription = (socket.appDataSubscriptions?.tables?.[tableName]?.size || 0) > 0;
            if (!hasSubscription && !isQueryMode) {
                continue;
            }
            const userId = socket.user.id;
            const rolesUpdatedAt = socket.user.rolesUpdatedAt;
            if (!columnAllowCache.has(userId)) {
                columnAllowCache.set(
                    userId,
                    await this.broadcastColumnAllowList(tableName, userId, rolesUpdatedAt)
                );
            }
            const allowedColumns = columnAllowCache.get(userId);
            const project = (payloadRows) => this.projectBroadcastRows(payloadRows, allowedColumns);
            const emitRefresh = (payloadRows) => {
                const projected = project(payloadRows);
                if (!hasSubscription || projected.length === 0) {
                    return;
                }
                this.io.to(socket.id).emit(tableName + "Refresh", projected);
            };

            // Helper: send this socket either Stale (mixed ops) or one Delta per row.
            const emitQueryMode = async (filteredRows) => {
                // No operation (e.g. mixed delete+update in one txn) → Stale, not stacked Deltas.
                // Same for a bulk bigger than a page: one refetch beats thousands of row events.
                if (!operation || filteredRows.length > MAX_DELTA_ROWS) {
                    this.io.to(socket.id).emit(tableName + "Stale", {
                        originSocketId,
                    });
                    return;
                }
                const enrichedRows = await this.enrichQueryTableItems(
                    tableName, project(filteredRows), userId, rolesUpdatedAt
                );
                // One Delta per row so bulk same-op (multi-delete) can animate / bump
                // immediately for on-page and next-page rows without a Stale banner.
                for (const row of enrichedRows) {
                    this.io.to(socket.id).emit(tableName + "Delta", {
                        operation,
                        row,
                        originSocketId,
                    });
                }
            };

            // Same user (any tab): still respect query-mode vs legacy
            if (socket.user.id === this.userId) {
                emitRefresh(rows);
                if (isQueryMode) {
                    await emitQueryMode(rows);
                }
                continue;
            }
            const model = this.models[tableName];
            const hasModelUserFilter = typeof model.getUserFilter === "function";
            const hasBroadcastExpander = typeof model.expandBroadcastFilter === "function";
            const isAdmin = await this.isAdmin(userId, rolesUpdatedAt);
            const isPublicTable = model.publicTable;

            // if socket is admin or table is public, also just send (unless model requires per-user filtering/expansion)
            if (!hasModelUserFilter && !hasBroadcastExpander && (isAdmin || isPublicTable)) {
                emitRefresh(rows);
                if (isQueryMode) {
                    await emitQueryMode(rows);
                }
                continue;
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
            const visibleRows = rows.filter(entry => this.matchesFilter(entry, allFilter));
            if (operation === "delete") {
                // A delete must let a client drop a row it already holds, but a viewer who fails the
                // row filter must never receive that row's columns — and must not be enriched, since
                // enrichment re-attaches identity fields (names, usernames). Full row for rows the
                // viewer can see; a bare {id, deleted:true} for the rest so the client can still patch.
                const hiddenIdRows = rows
                    .filter(entry => !this.matchesFilter(entry, allFilter))
                    .map(entry => ({id: entry.id, deleted: true}));
                if (isQueryMode) {
                    if (visibleRows.length > 0) {
                        await emitQueryMode(visibleRows);
                    }
                    for (const row of hiddenIdRows) {
                        this.io.to(socket.id).emit(tableName + "Delta", {operation, row, originSocketId});
                    }
                }
                emitRefresh([...visibleRows, ...hiddenIdRows]);
                continue;
            }
            if (visibleRows.length === 0) {
                continue;
            }
            if (isQueryMode) {
                await emitQueryMode(visibleRows);
            }
            emitRefresh(visibleRows);
        }
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
