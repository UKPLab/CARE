const {Op, where, fn, col, literal} = require("sequelize");
const {SORT_ALIAS, nestedViewKey} = require("./queryTableJoinSort.js");

const OPERATORS = {
    "=": Op.eq,
    "!=": Op.ne,
    ">": Op.gt,
    ">=": Op.gte,
    "<": Op.lt,
    "<=": Op.lte,
};

const TRUTHY = new Set(["true", "yes", "1"]);
const FALSY = new Set(["false", "no", "0"]);
const IN_OPERATORS = new Set(["=", "!="]);

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
            return {[Op.gte]: start, [Op.lt]: end};
        case ">":
            return {[Op.gte]: end};
        case ">=":
            return {[Op.gte]: start};
        case "<":
            return {[Op.lt]: start};
        case "<=":
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

function cellTextSql(entry) {
    if (entry.viewField) {
        return `"${SORT_ALIAS}"."${entry.viewField}"`;
    }
    if (entry.sql) {
        return `(${entry.sql})`;
    }
    return `"${entry.table}"."${entry.field}"`;
}

/** Sorted text[] of cell tokens: `2,3` / `[1, 2]` / `2` / empty when missing. */
function cellTokenArraySql(entry) {
    const cell = cellTextSql(entry);
    return `(
        SELECT COALESCE(array_agg(DISTINCT btrim(tok) ORDER BY btrim(tok)), ARRAY[]::text[])
        FROM unnest(regexp_split_to_array(
            regexp_replace(COALESCE(btrim((${cell})::text), ''), '^\\[|\\]$', '', 'g'),
            ','
        )) AS tok
        WHERE btrim(tok) <> '' AND btrim(tok) !~* '^null$'
    )`;
}

function sqlTextArray(values) {
    if (!values.length) {
        return "ARRAY[]::text[]";
    }
    const inner = values
        .map((item) => `'${String(item).replace(/'/g, "''")}'`)
        .join(", ");
    return `ARRAY[${inner}]::text[]`;
}

function sortedTextTokens(values) {
    return [...new Set(values.map((item) => String(item)))].sort();
}

/**
 * Search-bar lists: `=` exact set, `~` has all, `%` has any, `!=` none of.
 * Mixed `[1,null]` is invalid on `=` / `~`.
 * @returns {Object|null}
 */
function tokenListCondition(entry, operator, values) {
    const hasEmpty = values.some((item) => item === "");
    const nonempty = values.filter((item) => item !== "");
    const tokens = cellTokenArraySql(entry);
    const missingSql = `cardinality(${tokens}) = 0`;
    const overlapSql = nonempty.length > 0
        ? `${tokens} && ${sqlTextArray(nonempty)}`
        : "FALSE";
    const containsAllSql = nonempty.length > 0
        ? `${tokens} @> ${sqlTextArray(sortedTextTokens(nonempty))}`
        : "FALSE";

    if (operator === "%") {
        const parts = [];
        if (nonempty.length) {
            parts.push(literal(overlapSql));
        }
        if (hasEmpty) {
            parts.push(literal(missingSql));
        }
        if (!parts.length) {
            return null;
        }
        return parts.length === 1 ? parts[0] : {[Op.or]: parts};
    }
    if (operator === "~") {
        if (hasEmpty && nonempty.length > 0) {
            return null;
        }
        if (hasEmpty) {
            return literal(missingSql);
        }
        return literal(containsAllSql);
    }
    if (operator === "!=") {
        const parts = [];
        if (nonempty.length) {
            parts.push(literal(`NOT (${overlapSql})`));
        }
        if (hasEmpty) {
            parts.push(literal(`NOT (${missingSql})`));
        }
        if (!parts.length) {
            return null;
        }
        return parts.length === 1 ? parts[0] : {[Op.and]: parts};
    }
    if (hasEmpty && nonempty.length > 0) {
        return null;
    }
    if (hasEmpty) {
        return literal(missingSql);
    }
    return literal(`${tokens} = ${sqlTextArray(sortedTextTokens(nonempty))}`);
}

/**
 * Bindable IN-list: numbers stay numbers, enums match the spec, everything else is trimmed text.
 * @param {Object} entry
 * @param {Array} value
 * @returns {Array}
 */
function normalizeInList(entry, value) {
    const isMissing = (item) => item === null || item === "";
    if (entry.type === "numeric") {
        return value
            .map((item) => {
                if (isMissing(item) || (typeof item === "string" && /^null$/i.test(item.trim()))) {
                    return "";
                }
                return typeof item === "number" ? item : Number(
                    /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(item).trim()) ? String(item).trim() : NaN,
                );
            })
            .filter((item) => item === "" || Number.isFinite(item));
    }
    if (entry.type === "boolean") {
        return value
            .map((item) => (isMissing(item) ? "" : toBoolean(item)))
            .filter((item) => item === "" || item !== null);
    }
    if (entry.type === "enum" && entry.values) {
        return value
            .map((item) => {
                if (isMissing(item) || (typeof item === "string" && /^null$/i.test(item.trim()))) {
                    return "";
                }
                return entry.values.find((allowed) => String(allowed).toLowerCase() === String(item).toLowerCase());
            })
            .filter((item) => item !== undefined);
    }
    return value.map((item) => {
        if (isMissing(item) || (typeof item === "string" && /^null$/i.test(item.trim()))) {
            return "";
        }
        return String(item).trim();
    });
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

    // Chip value is a list: `[1, 2]`, `[null]`, …
    if (Array.isArray(value)) {
        if (entry.type === "date") {
            const parts = value
                .map((item) => parseIsoDate(item))
                .filter(Boolean)
                .map((day) => applyOps(entry, dateRangeOps("=", day)))
                .filter(Boolean);
            if (parts.length === 0) {
                return null;
            }
            // `=` is one calendar day. Two days cannot both be "equal".
            return parts.length === 1 ? parts[0] : literal("FALSE");
        }
        const values = normalizeInList(entry, value);
        if (values.length === 0) {
            return null;
        }
        if (operator !== "~" && operator !== "%" && !IN_OPERATORS.has(operator)) {
            return null;
        }
        return tokenListCondition(entry, operator, values);
    }

    if (entry.type === "boolean") {
        const boolValue = toBoolean(value);
        if (boolValue === null) {
            return null;
        }
        return wrap({[operator === "!=" ? Op.ne : Op.eq]: boolValue});
    }

    if (entry.type === "numeric") {
        // Bind a finite decimal only — never interpolate the raw string into SQL.
        const number = typeof value === "number" ? value : Number(
            /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(value).trim()) ? String(value).trim() : NaN,
        );
        if (!Number.isFinite(number)) {
            return null;
        }
        if (operator === "~" || operator === "%") {
            return tokenListCondition(entry, operator, [number]);
        }
        const op = OPERATORS[operator];
        return op ? wrap({[op]: number}) : null;
    }

    if (entry.type === "date") {
        const day = parseIsoDate(value);
        if (!day) {
            return null;
        }
        const ops = dateRangeOps(operator, day);
        return ops ? applyOps(entry, ops) : null;
    }

    if (entry.type === "enum") {
        const text = String(value);
        let canonical = text;
        if (entry.values) {
            canonical = entry.values.find((item) => String(item).toLowerCase() === text.toLowerCase());
            if (canonical === undefined) {
                return null;
            }
        }
        return wrap({[operator === "!=" ? Op.ne : Op.eq]: canonical});
    }

    // text
    const text = String(value).trim();
    if (!text) {
        return null;
    }
    if (operator === "~") {
        return containsCondition(filterExpression(entry), text.toLowerCase());
    }
    if (operator === "%") {
        return tokenListCondition(entry, "%", [text]);
    }
    return wrap({[operator === "!=" ? Op.ne : Op.eq]: text});
}

/**
 * Search chips to a WHERE. Skip keys not in the spec or hidden from this viewer.
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

        const operator = requested.operator;
        const value = requested.value;
        if (spec.operators) {
            if (!spec.operators.includes(operator)) {
                continue;
            }
        } else if (!(operator in OPERATORS) && operator !== "~" && operator !== "%") {
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
