const Socket = require("../Socket.js");
const {relevantFields} = require("../auth/utils");
const database = require("../../db");
const {v4: uuidv4} = require("uuid");
const {mergeFilter} = require("../../utils/helper/data.js");
const {mergeInjects} = require("../../utils/helper/data");
const {generateError} = require("../../utils/helper/generic.js");
const {col} = require("sequelize");
const {makePaginateLazy} = require("sequelize-cursor-pagination");
const {paginateJoinSort, dashboardSortInclude, serializeCursor} = require("../../utils/helper/queryTableJoinSort.js");
const {ensureStudyDashboardSortFresh} = require("../../db/studyDashboardSortRefresh.js");
const TranslatableError = require("../../utils/TranslatableError");

// Upper bound for one queryTable page. The infinite-scroll window asks for its whole
// loaded size in one request, so this is above a page size but far below a full table.
const MAX_QUERY_TABLE_LIMIT = 200;

// Upper bound for a distinct-value dropdown. Above this a filter list is unusable anyway.
const MAX_DISTINCT_VALUES = 500;

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


        const writeContext = {...data.data, currentUserId: this.userId};

        if (("id" in data.data && data.data.id !== 0) &&
            ('deleted' in data.data || 'closed' in data.data || 'public' in data.data || 'end' in data.data || 'disable' in data.data || 'enabled' in data.data)) {
            newEntry = await this.models[data.table].updateById(
                data.data.id,
                data.data,
                {
                    context: writeContext,
                    transaction: transaction
                }
            );
            // if the entry is destroyed then it wont return an id
            return await this.resolveUpdateResult(data, transaction, writeContext, newEntry);
        }

        // check or set user information
        if ("userId" in data.data && !await this.checkUserAccess(data.data.userId)) {
            // Share tables store the recipient in userId. Parent ownership is
            // enforced in MetaModel.add / updateById via foreignOwner.
            if (!this.models[data.table].foreignOwner) {
                throw new TranslatableError("errors.permission.cannotUpdateOtherUserTable", {dataTable: data.table}, "ACCESS_DENIED");
            }
        }

        // check data exists for required fields
        for (let field of this.models[data.table].fields) {
            if (field.required) {
                if (
                    !(field.key in data.data) ||
                    data.data[field.key] === null ||
                    data.data[field.key] === ""
                ) {
                    throw new TranslatableError("errors.validation.requiredFieldMissing", {fieldKey: field.key}, "VALIDATION_ERROR");
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
            newEntry = await this.models[data.table].add(data.data, {
                context: writeContext,
                transaction: transaction
            });
        } else {
            newEntry = await this.models[data.table].updateById(
                data.data.id,
                data.data,
                {
                    context: writeContext,
                    transaction: transaction
                }
            );
        }

        if (!newEntry) {
            throw generateError("UPDATE_FAILED", "errors.database.failedToUpdateData");
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
        return await this.resolveUpdateResult(data, transaction, writeContext, newEntry);

    }

    /**
     * Default appDataUpdate result is the row id. A model may override via
     * `resolveAppDataResult`
     */
    async resolveUpdateResult(data, transaction, writeContext, newEntry) {
        const model = this.models[data.table];
        if (typeof model.resolveAppDataResult === "function") {
            const custom = await model.resolveAppDataResult({
                data: data.data,
                transaction,
                context: writeContext,
                entry: newEntry,
            });
            if (custom !== undefined) {
                return custom;
            }
        }
        return newEntry?.id;
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
            const sessionUser = this.socket.request.session?.passport?.user || {};
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
                loginMethod: sessionUser.loginMethod || null,
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
        const record = await this.models[data.table].getByHash(data.hash);
        let errorCode = "UNKNOWN";
        let errorMessage = "";

        if (!record) {
            // Record doesn't exist or was deleted
            throw generateError("NOT_FOUND", "errors.common.resourceNotFound");
        }

        // Now check permissions by attempting to send via filtered sendTable
        const result = await this.sendTable(data.table, mergeFilter([[{
            key: "hash",
            value: data.hash
        }]], this.models[data.table].getAttributes()));

        if (result.length === 0) {
            // Record exists but user doesn't have permission
            throw generateError("ACCESS_DENIED", "errors.common.accessDenied");
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
            throw generateError("VALIDATION_ERROR", "errors.validation.tableNameRequired");
        }

        // Client injects reach handleInjections. Parent fields are cut to the columns this viewer may read.
        data.inject = await this.sanitizeClientInjects(data.inject);

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
        if (this.socket.appDataSubscriptions["ids"][data]?.table) {
            const tableName = this.socket.appDataSubscriptions["ids"][data].table;
            delete this.socket.appDataSubscriptions["ids"][data];
            this.socket.appDataSubscriptions["tables"][tableName].delete(data);
        }
       
    }

    /**
     * Request-response page query for an autoTable.
     *
     * @socketEvent queryTable
     * @param {Object} data
     * @param {string} data.table autoTable name
     * @param {Array} [data.filter] same shape as subscribeAppData filter items
     * @param {Object} [data.query]
     * @param {number} [data.query.limit]
     * @param {Object} [data.query.sort] { column, direction }
     * @param {string} [data.query.search] case-insensitive substring across visible + injected columns
     * @param {Object} [data.query.columnFilters] search-bar filter tokens: { key: {operator, value} }
     * @param {string[]} [data.query.searchColumns] narrow free text to the columns this table shows
     *        (intersected with the model whitelist — a client cannot widen it)
     * @param {Object} [data.scope] consumer scope resolved by the model (getQueryTableScopeFilter),
     *        for rows a filter item cannot name (e.g. Publish Assessment's workflow-step selection)
     * @param {string} [data.query.after] endCursor of previous result → next page
     * @param {string} [data.query.before] startCursor of previous result → previous page
     * @param {boolean} [data.query.fromEnd] fetch the last page (no cursor needed)
     * @param {number} [data.query.offset] row index to start at; only for the infinite-scroll
     *        window (scrollbar jump / window refetch). Ignored when a cursor is given.
     * @returns {Promise<{items: Array, meta: Object}>} meta has total, pageSize, startCursor, endCursor, hasNext, hasPrev, offset
     */
    async queryTable(data) {
        const {table, query = {}, filter = [], scope: scopeParams = null} = data || {};

        // Row scope (ACL + client filter + search bar) is shared with query-scoped bulk actions.
        const scope = await this.resolveQueryTableScope({table, filter, query, scope: scopeParams});
        const {model, attributes, allAttributes, columnFilters, search} = scope;
        const allFilter = scope.where;

        // Rows per page (default 10). Clamped: "All" in the UI is a sliding window, never the whole table.
        const limit = Math.min(Number(query.limit) > 0 ? Number(query.limit) : 10, MAX_QUERY_TABLE_LIMIT);

        // Sort column (fallback to id). id is the tie-breaker so the cursor is stable;
        // same direction as sortColumn so btree can be scanned forward or backward without a mismatched ORDER BY.
        let sortColumn = query.sort?.column;
        let sortDirection = (query.sort?.direction || "ASC").toUpperCase();
        if (sortDirection !== "ASC" && sortDirection !== "DESC") {
            sortDirection = "ASC";
        }
        const derivedSortSpec = typeof model.getQueryTableSortColumns === "function"
            ? (model.getQueryTableSortColumns() || {})[sortColumn]
            : null;
        // Fallback to id unless the requested key is a derived sort column, or a model attribute the
        // viewer is actually allowed to read
        const canSortByColumn = !!sortColumn
            && (sortColumn in attributes)
            && scope.allowedAttributeNames.includes(sortColumn);
        if (!derivedSortSpec && !canSortByColumn) {
            sortColumn = "id";
        }

        const after = query.after || null;
        const before = query.before || null;
        const fromEnd = !!query.fromEnd;
        const backward = !!before || fromEnd;
        // Keyset cannot address "row N", which a virtualized scrollbar needs. Offset is therefore
        // allowed as an absolute seek, but only when no cursor was sent (page turns stay keyset).
        const requestedOffset = Number(query.offset);
        const offset = (!after && !before && !fromEnd && Number.isFinite(requestedOffset) && requestedOffset > 0)
            ? Math.floor(requestedOffset)
            : 0;

        let edges;
        let total;

        const needsViewJoin = Boolean(derivedSortSpec) || scope.needsViewJoin;

        const sortModel = needsViewJoin ? this.models["study_dashboard_sort"] : null;
        if (needsViewJoin) {
            if (!sortModel) {
                throw new Error("study_dashboard_sort is not available");
            }
            const usesStateView = derivedSortSpec?.field === "stateRank" || scope.usesStateView;
            await ensureStudyDashboardSortFresh(
                this.server.db.sequelize,
                usesStateView ? "stateRank" : "sessions"
            );
        }

        if (derivedSortSpec) {
            const joinPage = await paginateJoinSort({
                model,
                sortModel,
                where: allFilter,
                attributes: allAttributes,
                viewField: derivedSortSpec.field,
                sortDirection,
                after,
                before,
                fromEnd,
                offset,
                limit: limit + 1,
            });
            edges = joinPage.edges;
            total = joinPage.total;
        } else {
            // Order field list is identical on every request so cursors are interchangeable
            // between first / after / before / fromEnd. Cursor payload = [sortColumn, id].
            const forwardOrder = sortColumn === "id"
                ? [["id", sortDirection]]
                : [[sortColumn, sortDirection], ["id", sortDirection]];
            const reversedOrder = forwardOrder.map(([col, dir]) => [col, dir === "ASC" ? "DESC" : "ASC"]);

            const joinOptions = needsViewJoin
                ? {include: [dashboardSortInclude(sortModel)], subQuery: false}
                : {};

            if (offset > 0) {
                // Cursor payload here is built exactly like sequelize-cursor-pagination's
                // createCursor (the ordered field values), so the window can keep walking with
                // after/before from a seeked position.
                const [rows, rawTotal] = await Promise.all([
                    model.findAll({
                        where: allFilter,
                        attributes: allAttributes,
                        order: forwardOrder,
                        limit: limit + 1,
                        offset,
                        ...joinOptions,
                    }),
                    model.count({where: allFilter, ...joinOptions}),
                ]);
                edges = rows.map((node) => ({
                    node,
                    cursor: serializeCursor(forwardOrder.map(([field]) => node.get(field))),
                }));
                total = rawTotal;
            } else {
                // Same simple cache as getById/findAll: identical page query (same where/order/
                // cursor/limit) hits memory; any study write still clears the whole model cache.
                // omitPrimaryKeyFromOrder: we always pass an explicit, id-terminated order ourselves.
                const paginateLazy = makePaginateLazy(model, {omitPrimaryKeyFromOrder: true});
                const connection = paginateLazy({
                    where: allFilter,
                    attributes: allAttributes,
                    order: fromEnd ? reversedOrder : forwardOrder,
                    limit: limit + 1,
                    ...(after ? {after} : {}),
                    ...(before ? {before} : {}),
                    ...joinOptions,
                });

                const [rawEdges, rawTotal] = await Promise.all([
                    connection.getEdges(),
                    connection.getTotalCount(),
                ]);
                edges = fromEnd ? [...rawEdges].reverse() : rawEdges;
                total = rawTotal;
            }
        }
        const overflow = edges.length > limit;
        if (overflow) {
            edges = backward ? edges.slice(edges.length - limit) : edges.slice(0, limit);
        }

        let items = edges.map((edge) => {
            const node = edge.node;
            const row = (node && typeof node.get === "function") ? node.get({plain: true}) : node;
            if (row && row.dashboardSort) {
                delete row.dashboardSort;
            }
            return row;
        });
        items = await this.enrichQueryTableItems(table, items, this.userId, this.rolesUpdatedAt);
        const startCursor = edges.length ? edges[0].cursor : null;
        const endCursor = edges.length ? edges[edges.length - 1].cursor : null;

        // Whether there is a page before and after this one.
        let hasNext;
        let hasPrev;
        if (fromEnd) {
            hasNext = false;
            hasPrev = overflow;
        } else if (before) {
            hasNext = true;
            hasPrev = overflow;
        } else if (after) {
            hasPrev = true;
            hasNext = overflow;
        } else if (offset > 0) {
            hasPrev = true;
            hasNext = overflow;
        } else {
            hasPrev = false;
            hasNext = overflow;
        }

        return {
            items: items || [],
            meta: {
                total: total || 0,
                pageSize: limit,
                totalPages: limit ? Math.ceil((total || 0) / limit) : 1,
                startCursor,
                endCursor,
                hasNext,
                hasPrev,
                offset,
            },
        };
    }

    /**
     * Distinct values of one column within the same row scope as queryTable.
     *
     * Feeds dropdowns that used to read unique values from a full Vuex table dump (e.g. the
     * Manage Studies workflow filter). The column has to be offered by the model
     * (`getQueryTableDistinctColumns`) and readable by the viewer.
     *
     * @socketEvent queryTableDistinct
     * @param {Object} data
     * @param {string} data.table autoTable name
     * @param {string} data.column column to read distinct values from
     * @param {Array} [data.filter] same filter items as queryTable
     * @param {Object} [data.query] { search, columnFilters, searchColumns }
     * @param {Object} [data.scope] same consumer scope as queryTable
     * @returns {Promise<{values: Array}>} at most MAX_DISTINCT_VALUES values, nulls dropped
     */
    async queryTableDistinct(data) {
        const {table, column, query = {}, filter = [], scope: scopeParams = null} = data || {};
        if (!column || typeof column !== "string") {
            throw new TranslatableError("errors.queryTable.columnRequired");
        }

        const scope = await this.resolveQueryTableScope({table, filter, query, scope: scopeParams});
        const distinctColumns = typeof scope.model.getQueryTableDistinctColumns === "function"
            ? (await scope.model.getQueryTableDistinctColumns(scope.injectCtx)) || []
            : [];
        if (!distinctColumns.includes(column) || !scope.allowedAttributeNames.includes(column)) {
            throw new TranslatableError("errors.queryTable.columnNotDistinct", {column});
        }

        const findOptions = {
            where: scope.where,
            attributes: [[col(`${scope.model.tableName}.${column}`), "value"]],
            group: [col(`${scope.model.tableName}.${column}`)],
            order: [[col(`${scope.model.tableName}.${column}`), "ASC"]],
            limit: MAX_DISTINCT_VALUES,
            raw: true,
        };
        if (scope.needsViewJoin) {
            const sortModel = this.models["study_dashboard_sort"];
            if (!sortModel) {
                throw new Error("study_dashboard_sort is not available");
            }
            await ensureStudyDashboardSortFresh(
                this.server.db.sequelize,
                scope.usesStateView ? "stateRank" : "sessions"
            );
            findOptions.include = [dashboardSortInclude(sortModel)];
            findOptions.subQuery = false;
        }

        const rows = await scope.model.findAll(findOptions);
        return {values: rows.map((row) => row.value).filter((value) => value !== null && value !== undefined)};
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

        // Users with disableLanguageSelection cannot save app.locale as a user preference
        if (
            key === "app.locale"
            && !(await this.isAdmin())
            && await this.hasAccess("frontend.preferences.disableLanguageSelection")
        ) {
            throw new TranslatableError("errors.settings.cannotChangeLanguage");
        }

        // Admin can set settings for other users (single or bulk)
        if (Array.isArray(data.userIds) && data.userIds.length > 0 && await this.isAdmin()) {
            for (const uid of data.userIds) {
                // Admin may assign any key; skip allowUserOverride guard in user_setting hooks
                await this.models["user_setting"].set(key, value, uid, { bypassSystemSettingCheck: true });
            }
        } else if (data.userId && await this.isAdmin()) {
            // Admin may assign any key; skip allowUserOverride guard in user_setting hooks
            await this.models["user_setting"].set(key, value, data.userId, { bypassSystemSettingCheck: true });
        } else {
            // Default: set for current user and refresh their settings
            await this.models["user_setting"].set(key, value, this.userId);
            await this.sendSettings();
        }   
    }

    /**
     * One mounted BackendTable holds query mode for its table.
     * broadcastTable then emits Delta/Stale in addition to Refresh for Vuex subscribers.
     * @param {{table?: string}} data
     */
    acquireQueryTable(data) {
        const table = data?.table;
        if (typeof table !== "string" || !this.models[table]?.autoTable) {
            return;
        }
        if (!this.socket.currentQueries) {
            this.socket.currentQueries = {};
        }
        const current = this.socket.currentQueries[table];
        this.socket.currentQueries[table] = (typeof current === "number" ? current : 0) + 1;
    }

    /**
     * Drop one BackendTable hold. The table leaves query mode when the last hold is gone.
     * @param {{table?: string}} data
     */
    releaseQueryTable(data) {
        const table = data?.table;
        if (!this.socket.currentQueries || typeof table !== "string") {
            return;
        }
        const current = this.socket.currentQueries[table];
        if (typeof current !== "number" || current <= 1) {
            delete this.socket.currentQueries[table];
            return;
        }
        this.socket.currentQueries[table] = current - 1;
    }

    init() {

        this.createSocket("appDataUpdate", this.updateAppData, {}, true);
        this.createSocket("appData", this.sendData, {}, false);
        this.createSocket("appDataByHash", this.sendDataByHash, {}, false);

        this.createSocket("subscribeAppData", this.subscribeAppData, {}, false);
        this.createSocket("unsubscribeAppData", this.unsubscribeAppData, {}, false);
        this.createSocket("queryTable", this.queryTable, {}, false);
        this.createSocket("queryTableAcquire", this.acquireQueryTable, {}, false);
        this.createSocket("queryTableRelease", this.releaseQueryTable, {}, false);
        this.createSocket("queryTableDistinct", this.queryTableDistinct, {}, false);
        this.createSocket("appInit", this.sendInit, {}, false);
        this.createSocket("appSettingSet", this.sendOverallSetting, {}, false);
    }
};

module.exports = AppSocket;