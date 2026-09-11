const {Op, where, fn, col, literal} = require("sequelize");
const {SORT_ALIAS, nestedViewKey} = require("./queryTableJoinSort.js");

const OPERATORS = {
    "=": Op.eq,
    "!=": Op.ne,
    ">": Op.gt,
    ">=": Op.gte,
    "<": Op.lt,
    "<=": Op.lte,
    eq: Op.eq,
    ne: Op.ne,
    gt: Op.gt,
    gte: Op.gte,
    lt: Op.lt,
    lte: Op.lte,
};

const TRUTHY = new Set(["true", "yes", "1"]);
const FALSY = new Set(["false", "no", "0"]);

/** Calendar day `YYYY-MM-DD`, or null when the text is not a real date. */
function parseIsoDate(value) {
    const text = String(value ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return null;
    }
    const year = Number(text.slice(0, 4));
    const month = Number(text.slice(5, 7));
    const day = Number(text.slice(8, 10));
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return null;
    }
    return text;
}

function toBoolean(value) {
    if (typeof value === "boolean") {
        return value;
    }
    const text = String(value).toLowerCase();
    if (TRUTHY.has(text)) {
        return true;
    }
    if (FALSY.has(text)) {
        return false;
    }
    return null;
}

/**
 * Case-insensitive substring match, same STRPOS form as queryTableSearch.
 * @param {Object} expression Sequelize column / literal
 * @param {string} needle already lowercased
 * @returns {Object}
 */
function containsCondition(expression, needle) {
    return where(fn("STRPOS", fn("LOWER", expression), needle), {[Op.gt]: 0});
}

/** Next calendar day after `YYYY-MM-DD`, still as `YYYY-MM-DD`. */
function nextIsoDate(day) {
    const year = Number(day.slice(0, 4));
    const month = Number(day.slice(5, 7));
    const date = Number(day.slice(8, 10));
    const next = new Date(Date.UTC(year, month - 1, date + 1));
    const yyyy = String(next.getUTCFullYear()).padStart(4, "0");
    const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(next.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * UTC half-open range for one calendar day so "=" is the whole day, not a timestamp instant.
 * @returns {Object|null} Sequelize operators for the timestamp column
 */
function dateRangeOps(operator, day) {
    const start = new Date(`${day}T00:00:00.000Z`);
    const end = new Date(`${nextIsoDate(day)}T00:00:00.000Z`);
    switch (operator) {
        case "=":
        case "eq":
            return {[Op.gte]: start, [Op.lt]: end};
        case ">":
        case "gt":
            return {[Op.gte]: end};
        case ">=":
        case "gte":
            return {[Op.gte]: start};
        case "<":
        case "lt":
            return {[Op.lt]: start};
        case "<=":
        case "lte":
            return {[Op.lt]: end};
        default:
            return null;
    }
}

function applyOps(entry, ops) {
    if (entry.viewField || entry.sql) {
        return where(filterExpression(entry), ops);
    }
    return wrapCondition(entry, ops);
}

function wrapCondition(entry, condition) {
    if (entry.viewField) {
        return {[nestedViewKey(entry.viewField)]: condition};
    }
    if (entry.sql) {
        return where(literal(entry.sql), condition);
    }
    return {[entry.field]: condition};
}

function filterExpression(entry) {
    if (entry.viewField) {
        return col(`${SORT_ALIAS}.${entry.viewField}`);
    }
    if (entry.sql) {
        return literal(entry.sql);
    }
    return col(`${entry.table}.${entry.field}`);
}

/**
 * Resolve one requested filter into a WHERE fragment, or null if it does not fit the spec.
 *
 * @param {Object} params
 * @param {Object} params.entry spec entry for this key
 * @param {string} params.operator
 * @param {*} params.value
 * @returns {Object|null}
 */
function buildCondition({entry, operator, value}) {
    const wrap = (condition) => wrapCondition(entry, condition);

    if (entry.type === "exists") {
        const wanted = toBoolean(value);
        if (wanted === null) {
            return null;
        }
        const present = operator === "!=" ? !wanted : wanted;
        return wrap(present ? {[Op.ne]: null} : {[Op.is]: null});
    }

    if (entry.type === "boolean") {
        const boolValue = toBoolean(value);
        if (boolValue === null) {
            return null;
        }
        return wrap({[operator === "!=" ? Op.ne : Op.eq]: boolValue});
    }

    if (Array.isArray(value)) {
        // Checkbox funnel form: any of the selected values.
        const values = entry.values ? value.filter((item) => entry.values.includes(item)) : value;
        if (values.length === 0) {
            return null;
        }
        return wrap({[operator === "!=" ? Op.notIn : Op.in]: values});
    }

    if (entry.type === "numeric") {
        // Bind a finite decimal only — never interpolate the raw string into SQL.
        const number = typeof value === "number" ? value : Number(
            /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(value).trim()) ? String(value).trim() : NaN,
        );
        if (!Number.isFinite(number)) {
            return null;
        }
        const op = OPERATORS[operator];
        return op ? wrap({[op]: number}) : null;
    }

    if (entry.type === "date") {
        // No "!=" — excluding a single day is not offered; use before/after instead.
        if (operator === "!=" || operator === "ne") {
            return null;
        }
        const day = parseIsoDate(value);
        if (!day) {
            return null;
        }
        const ops = dateRangeOps(operator, day);
        return ops ? applyOps(entry, ops) : null;
    }

    if (entry.type === "enum") {
        const text = String(value);
        if (entry.values && !entry.values.includes(text)) {
            return null;
        }
        return wrap({[operator === "!=" ? Op.ne : Op.eq]: text});
    }

    // text
    const text = String(value).trim();
    if (!text) {
        return null;
    }
    if (operator === "~") {
        return containsCondition(filterExpression(entry), text.toLowerCase());
    }
    return wrap({[operator === "!=" ? Op.ne : Op.eq]: text});
}

/**
 * Build a WHERE clause from the search bar's filter tokens.
 *
 * The client sends `{ key: {operator, value} }` (or `{ key: [values] }` for checkbox filters), but
 * the keys it may use come from the model's own `getQueryTableFilterColumns` spec — a request for
 * anything outside that spec, or outside the viewer's readable attributes, is dropped. Values reach
 * SQL only through Sequelize operators, never through string interpolation.
 *
 * @param {Object} params
 * @param {import("sequelize").Model} params.model
 * @param {Object} params.columnFilters requested filters, keyed by spec key
 * @param {Object} params.filterSpec model spec: `{ key: {type, field, sql, viewField, values, operators} }`
 * @param {string[]} params.allowedAttributeNames columns the viewer may see
 * @returns {Object|null} WHERE fragment, or null when nothing valid was requested
 */
function buildQueryTableColumnFilters({model, columnFilters, filterSpec, allowedAttributeNames}) {
    if (!filterSpec || !columnFilters || typeof columnFilters !== "object") {
        return null;
    }

    const attributes = model.getAttributes();
    const allowed = new Set(allowedAttributeNames || Object.keys(attributes));
    const conditions = [];

    for (const [key, requested] of Object.entries(columnFilters)) {
        const spec = filterSpec[key];
        if (!spec || requested === null || requested === undefined) {
            continue;
        }

        const entry = {
            type: spec.type || "text",
            field: spec.field || key,
            sql: spec.sql || null,
            viewField: spec.viewField || null,
            values: spec.values || null,
            table: model.tableName,
        };
        // Sidecar-view and model-SQL keys are not study columns; anything else must be readable.
        if (!entry.sql && !entry.viewField && !(entry.field in attributes && allowed.has(entry.field))) {
            continue;
        }

        const isArray = Array.isArray(requested);
        const operator = isArray ? "=" : (requested.operator || "=");
        const value = isArray ? requested : requested.value;
        if (!isArray && (value === null || value === undefined || value === "")) {
            continue;
        }
        if (spec.operators && !spec.operators.includes(operator)) {
            continue;
        }
        if (!isArray && !(operator in OPERATORS) && operator !== "~") {
            continue;
        }

        const condition = buildCondition({entry, operator, value});
        if (condition) {
            conditions.push(condition);
        }
    }

    if (!conditions.length) {
        return null;
    }
    return {[Op.and]: conditions};
}

/**
 * True when a requested filter reads a sidecar-view column (needs INNER JOIN).
 * @param {Object|null} filterSpec
 * @param {Object|null} columnFilters
 * @returns {boolean}
 */
function columnFiltersNeedViewJoin(filterSpec, columnFilters) {
    if (!filterSpec || !columnFilters || typeof columnFilters !== "object") {
        return false;
    }
    return Object.keys(columnFilters).some((key) => !!(filterSpec[key] && filterSpec[key].viewField));
}

module.exports = {
    buildQueryTableColumnFilters,
    columnFiltersNeedViewJoin,
};
