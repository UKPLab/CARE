const {Op, where, fn, col, literal} = require("sequelize");

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
    // Computed columns bring their own SQL (status CASE, session count); real columns filter by name.
    const target = entry.sql ? literal(entry.sql) : null;
    const wrap = (condition) => (target ? where(target, condition) : {[entry.field]: condition});

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
        const expression = target || col(`${entry.table}.${entry.field}`);
        return containsCondition(expression, text.toLowerCase());
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
 * @param {Object} params.filterSpec model spec: `{ key: {type, field, sql, values, operators} }`
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
            values: spec.values || null,
            table: model.tableName,
        };
        // Without model SQL the key must be a real column the viewer is allowed to read.
        if (!entry.sql && !(entry.field in attributes && allowed.has(entry.field))) {
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

module.exports = {
    buildQueryTableColumnFilters,
};
