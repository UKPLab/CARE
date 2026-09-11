"use strict";

const {Op} = require("sequelize");

const SORT_ALIAS = "dashboardSort";

function nestedViewKey(field) {
    return `$${SORT_ALIAS}.${field}$`;
}

/**
 * INNER JOIN onto study_dashboard_sort. Empty attributes still join for WHERE.
 * @param {import("sequelize").Model} sortModel
 * @param {string[]} [attributes]
 * @returns {Object}
 */
function dashboardSortInclude(sortModel, attributes = []) {
    return {
        model: sortModel,
        as: SORT_ALIAS,
        required: true,
        attributes,
    };
}

function serializeCursor(payload) {
    return Buffer.from(JSON.stringify(payload)).toString("base64");
}

function parseCursor(cursor) {
    if (!cursor) {
        return null;
    }
    try {
        return JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    } catch (_err) {
        return null;
    }
}

function reverseDir(direction) {
    return direction === "DESC" ? "ASC" : "DESC";
}

/**
 * Keyset for JOIN sort, same shape as sequelize-cursor-pagination (value, id).
 * `direction` is the ORDER BY used for this fetch (already reversed when walking backward).
 */
function joinKeysetWhere(viewField, direction, cursorValues) {
    const currentOp = direction === "DESC" ? Op.lt : Op.gt;
    const nested = nestedViewKey(viewField);
    return {
        [Op.or]: [
            {[nested]: {[currentOp]: cursorValues[0]}},
            {[nested]: cursorValues[0], id: {[currentOp]: cursorValues[1]}},
        ],
    };
}

/**
 * Cursor-paginate study rows ordered by a column on study_dashboard_sort.
 *
 * @param {Object} params
 * @param {import("sequelize").Model} params.model study model
 * @param {import("sequelize").Model} params.sortModel study_dashboard_sort
 * @param {Object} params.where
 * @param {Object|Array} params.attributes
 * @param {string} params.viewField stateRank | sessions
 * @param {string} params.sortDirection ASC | DESC
 * @param {string|null} params.after
 * @param {string|null} params.before
 * @param {boolean} params.fromEnd
 * @param {number} params.limit fetch this many rows (caller adds +1 for overflow)
 * @returns {Promise<{edges: Array<{node: Object, cursor: string}>, total: number}>}
 */
async function paginateJoinSort({
    model,
    sortModel,
    where,
    attributes,
    viewField,
    sortDirection,
    after,
    before,
    fromEnd,
    limit,
}) {
    const displayDir = sortDirection === "DESC" ? "DESC" : "ASC";
    const travelBack = !!before || fromEnd;
    const fetchDir = travelBack ? reverseDir(displayDir) : displayDir;

    const include = [dashboardSortInclude(sortModel, [viewField])];

    const order = [
        [{model: sortModel, as: SORT_ALIAS}, viewField, fetchDir],
        ["id", fetchDir],
    ];

    let paginationWhere = where;
    const cursorToken = fromEnd ? null : (after || before || null);
    if (cursorToken) {
        const cursorValues = parseCursor(cursorToken);
        if (cursorValues && cursorValues.length >= 2) {
            paginationWhere = {
                [Op.and]: [where, joinKeysetWhere(viewField, fetchDir, cursorValues)],
            };
        }
    }

    const [rows, total] = await Promise.all([
        model.findAll({
            where: paginationWhere,
            attributes,
            include,
            order,
            limit,
            subQuery: false,
        }),
        model.count({
            where,
            include: [{model: sortModel, as: SORT_ALIAS, required: true}],
            distinct: true,
            col: "id",
        }),
    ]);

    if (travelBack) {
        rows.reverse();
    }

    const edges = rows.map((node) => {
        const sortVal = node[SORT_ALIAS] ? node[SORT_ALIAS][viewField] : null;
        return {
            node,
            cursor: serializeCursor([sortVal, node.get("id")]),
        };
    });

    return {edges, total};
}

module.exports = {
    paginateJoinSort,
    serializeCursor,
    parseCursor,
    joinKeysetWhere,
    dashboardSortInclude,
    nestedViewKey,
    SORT_ALIAS,
};
