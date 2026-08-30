const {Op, where, fn, col, cast} = require("sequelize");

const SKIP_SEARCH = new Set([
    "deleted",
    "deletedAt",
    "passwordHash",
    "salt",
    "initialPassword",
    "rolesUpdatedAt",
]);

const SKIP_TYPES = new Set(["BLOB", "JSONB", "JSON", "VIRTUAL", "GEOMETRY"]);

const MAX_SEARCH_LENGTH = 200;

function quoteIdent(name) {
    return `"${String(name).replace(/"/g, "\"\"")}"`;
}

function typeKey(attr) {
    return attr?.type?.key || attr?.type?.constructor?.key || "";
}

function includesCondition(expression, needle) {
    return where(fn("STRPOS", fn("LOWER", expression), needle), {[Op.gt]: 0});
}

/**
 * Build a Sequelize WHERE clause that matches frontend Table search:
 * case-insensitive substring across row fields (String(value).includes(needle)).
 *
 * Uses STRPOS(LOWER(...)) so %/_ are literals, same as JS includes.
 *
 * @param {Object} params
 * @param {import("sequelize").Model} params.model
 * @param {string} params.search
 * @param {string[]} params.allowedAttributeNames columns the viewer may see
 * @param {Array<Object>} [params.injects] queryTable injects (parent / count)
 * @param {string[]} [params.searchColumns] whitelist of searchable keys (visible table columns);
 *   when set, only these DB attributes / inject targets / computed keys are searched
 * @returns {Object|null} WHERE fragment or null if search is empty
 */
function buildQueryTableSearch({
    model,
    search,
    allowedAttributeNames,
    injects = [],
    searchColumns = null,
}) {
    const needle = String(search || "").trim().slice(0, MAX_SEARCH_LENGTH).toLowerCase();
    if (!needle) {
        return null;
    }

    const sequelize = model.sequelize;
    const tableName = model.tableName;
    const attributes = model.getAttributes();
    const allowed = new Set(allowedAttributeNames || Object.keys(attributes));
    const searchable = searchColumns ? new Set(searchColumns) : null;
    const conditions = [];

    const canSearch = (key) => !searchable || searchable.has(key);

    for (const [name, attr] of Object.entries(attributes)) {
        if (!canSearch(name) || SKIP_SEARCH.has(name) || !allowed.has(name)) {
            continue;
        }
        const tk = typeKey(attr);
        if (SKIP_TYPES.has(tk)) {
            continue;
        }
        // Skip booleans — Yes/No badge columns are not meaningful search targets.
        if (tk === "BOOLEAN") {
            continue;
        }
        if (tk === "STRING" || tk === "TEXT" || tk === "CITEXT" || tk === "CHAR") {
            conditions.push(includesCondition(col(`${tableName}.${name}`), needle));
        } else {
            conditions.push(includesCondition(cast(col(`${tableName}.${name}`), "TEXT"), needle));
        }
    }

    for (const injection of injects) {
        if (injection.type === "parent" && injection.fields?.length) {
            if (!injection.fields.some((f) => canSearch(f))) {
                continue;
            }
            const parentModel = sequelize.models[injection.table];
            if (!parentModel) {
                continue;
            }
            const parentTable = parentModel.tableName;
            const parentAttrs = parentModel.getAttributes();
            const fieldSql = injection.fields
                .filter((field) => canSearch(field) && parentAttrs[field] && !SKIP_SEARCH.has(field))
                .map((field) => (
                    `STRPOS(LOWER(CAST(${quoteIdent(parentTable)}.${quoteIdent(field)} AS TEXT)), ${sequelize.escape(needle)}) > 0`
                ));
            if (!fieldSql.length) {
                continue;
            }
            const deletedSql = "deleted" in parentAttrs
                ? ` AND ${quoteIdent(parentTable)}.deleted = false`
                : "";
            conditions.push({
                [injection.by]: {
                    [Op.in]: sequelize.literal(
                        `(SELECT ${quoteIdent(parentTable)}.id FROM ${quoteIdent(parentTable)}` +
                        ` WHERE (${fieldSql.join(" OR ")})${deletedSql})`
                    ),
                },
            });
        } else if (injection.type === "count") {
            if (injection.as && !canSearch(injection.as)) {
                continue;
            }
            const childModel = sequelize.models[injection.table];
            if (!childModel) {
                continue;
            }
            const childTable = childModel.tableName;
            const sourceKey = injection.on || "id";
            const deletedSql = "deleted" in childModel.getAttributes()
                ? ` AND ${quoteIdent(childTable)}.deleted = false`
                : "";
            conditions.push(includesCondition(
                sequelize.literal(
                    `(SELECT COUNT(*)::text FROM ${quoteIdent(childTable)}` +
                    ` WHERE ${quoteIdent(childTable)}.${quoteIdent(injection.by)}` +
                    ` = ${quoteIdent(tableName)}.${quoteIdent(sourceKey)}${deletedSql})`
                ),
                needle
            ));
        }
    }

    if (typeof model.getQueryTableSearchConditions === "function" && canSearch("state")) {
        const extra = model.getQueryTableSearchConditions(needle);
        if (Array.isArray(extra)) {
            conditions.push(...extra.filter(Boolean));
        } else if (extra) {
            conditions.push(extra);
        }
    }

    if (!conditions.length) {
        return null;
    }
    return {[Op.or]: conditions};
}

module.exports = {
    buildQueryTableSearch,
    MAX_SEARCH_LENGTH,
};
