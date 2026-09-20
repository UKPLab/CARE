/**
 * Filter tokens for the table search bar (basic/table/Search.vue).
 *
 * A token is `{key, operator, value}`. The same token can be produced by picking from the dropdown
 * or by typing / pasting `key:operator value`, and serializes back to that text so a whole query
 * can be copied and reused. Which keys exist and what they accept comes from the table's schema:
 *
 *   {state: {label: "Status", type: "enum", options: ["running", "closed"]},
 *    collab: {label: "Collaborative", type: "boolean"},
 *    workflow: {label: "Workflow", type: "exists", field: "workflowId"},
 *    sessions: {label: "Sessions", type: "numeric"},
 *    createdAt: {label: "Created", type: "date"}}
 */

export const OPERATOR_LABELS = {
  "=": "=",
  "!=": "!=",
  "~": "~",
  ">": ">",
  ">=": "\u2265",
  "<": "<",
  "<=": "\u2264",
};

/** Chip text for `~` (symbols stay as symbols). */
export const OPERATOR_LABEL_KEYS = {
  "~": "common.searchOp.contains",
};

/** Right-hand words in the operator dropdown (GitLab: symbol left, hint right). */
export const OPERATOR_HINTS = {
  "=": "common.searchOp.is",
  "!=": "common.searchOp.isNot",
  "~": "common.searchOp.contains",
  ">": "common.searchOp.greaterThan",
  ">=": "common.searchOp.greaterOrEqual",
  "<": "common.searchOp.lessThan",
  "<=": "common.searchOp.lessOrEqual",
};

/** Right-hand words in the operator dropdown for a calendar date. */
export const DATE_OPERATOR_HINTS = {
  "=": "common.searchOp.on",
  ">": "common.searchOp.after",
  ">=": "common.searchOp.onOrAfter",
  "<": "common.searchOp.before",
  "<=": "common.searchOp.onOrBefore",
};

// Types whose value is typed rather than picked from a list — the token stays incomplete until a
// value is entered, so `sessions:>=` never becomes a filter on its own.
const TYPED_VALUE_TYPES = new Set(["numeric", "text", "date"]);

/** True when the value for this key has to be typed (no options to pick). */
export function needsTypedValue(schema, key) {
  return TYPED_VALUE_TYPES.has(schema[key]?.type);
}

const OPERATORS_BY_TYPE = {
  boolean: ["=", "!="],
  exists: ["=", "!="],
  enum: ["=", "!="],
  numeric: ["=", "!=", ">", ">=", "<", "<="],
  date: ["=", ">", ">=", "<", "<="],
  text: ["~", "="],
};

const TOKEN_PATTERN = /^([A-Za-z_][A-Za-z0-9_]*):(!=|>=|<=|~|=|>|<)?(.*)$/;

// One segment is either something ending in a quoted value (`state:="not started"`) or a bare word.
const SEGMENT_PATTERN = /[^\s"]*"[^"]*"|\S+/g;

const TRUTHY = ["yes", "true", "1"];
const FALSY = ["no", "false", "0"];

function operatorDisplay(operator, t) {
  const key = OPERATOR_LABEL_KEYS[operator];
  if (key && typeof t === "function") return t(key);
  if (key) return "contains";
  return OPERATOR_LABELS[operator] || operator;
}

function yesNoLabels(t) {
  if (typeof t === "function") {
    return {yes: t("common.yes"), no: t("common.no")};
  }
  return {yes: "yes", no: "no"};
}

function matchesBoolWord(value, t) {
  const lower = value.toLowerCase();
  if (TRUTHY.includes(lower)) return true;
  if (FALSY.includes(lower)) return false;
  if (typeof t === "function") {
    if (lower === String(t("common.yes")).toLowerCase()) return true;
    if (lower === String(t("common.no")).toLowerCase()) return false;
  }
  return null;
}

/** Label to show for a key; falls back to the raw key. */
export function keyLabel(schema, key) {
  return schema[key]?.label || key;
}

export function operatorsFor(schema, key) {
  const entry = schema[key];
  if (!entry) return [];
  return entry.operators || OPERATORS_BY_TYPE[entry.type] || OPERATORS_BY_TYPE.text;
}

export function defaultOperator(schema, key) {
  return operatorsFor(schema, key)[0] || "=";
}

/** Values that can be picked from the dropdown; numeric, date, and text keys are typed instead. */
export function optionsFor(schema, key, t) {
  const entry = schema[key];
  if (!entry) return [];
  if (entry.type === "boolean" || entry.type === "exists") {
    const labels = yesNoLabels(t);
    return [
      {value: true, label: labels.yes},
      {value: false, label: labels.no},
    ];
  }
  if (entry.type === "enum") {
    return (entry.options || []).map((option) => (
      typeof option === "object"
        ? {value: option.value, label: option.label ?? String(option.value)}
        : {value: option, label: String(option)}
    ));
  }
  return [];
}

export function unquote(value) {
  const text = String(value ?? "").trim();
  if (text.length > 1 && text.startsWith("\"") && text.endsWith("\"")) {
    return text.slice(1, -1);
  }
  return text;
}

/** Calendar day `YYYY-MM-DD`, or null when the text is not a real date. */
export function parseIsoDate(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(5, 7));
  const day = Number(text.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return text;
}

/**
 * Text from the bar → typed value for that key, or null when it does not fit.
 * @returns {*|null}
 */
export function coerceValue(schema, key, raw, t) {
  const entry = schema[key];
  if (!entry) return null;
  const value = String(raw ?? "").trim();
  if (!value) return null;

  if (entry.type === "boolean" || entry.type === "exists") {
    return matchesBoolWord(value, t);
  }
  if (entry.type === "numeric") {
    // Digits only — no Number("0x10") / Number("1e2") / eval. Values go to SQL via Sequelize binds.
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  if (entry.type === "date") {
    return parseIsoDate(value);
  }
  if (entry.type === "enum") {
    const options = optionsFor(schema, key, t);
    if (options.length === 0) return value;
    const match = options.find((option) => (
      String(option.label).toLowerCase() === value.toLowerCase() ||
      String(option.value).toLowerCase() === value.toLowerCase()
    ));
    return match ? match.value : null;
  }
  return value;
}

/** Value as shown in a chip and written to the copyable query. */
export function displayValue(schema, token, t) {
  const entry = schema[token.key];
  if (entry && (entry.type === "boolean" || entry.type === "exists")) {
    const labels = yesNoLabels(t);
    return token.value ? labels.yes : labels.no;
  }
  if (entry && entry.type === "enum") {
    const match = optionsFor(schema, token.key, t).find((option) => option.value === token.value);
    if (match) return match.label;
  }
  return String(token.value);
}

export function tokenLabel(schema, token, t) {
  const operator = operatorDisplay(token.operator, t);
  return `${keyLabel(schema, token.key)} ${operator} ${displayValue(schema, token, t)}`;
}

/**
 * Token as text for the copyable query. Uses the stored value, not the display label, so a copied
 * query keeps meaning the same thing after labels change.
 */
export function serializeToken(schema, token) {
  const entry = schema[token.key];
  const value = entry && (entry.type === "boolean" || entry.type === "exists")
    ? (token.value ? "yes" : "no")
    : String(token.value);
  return `${token.key}:${token.operator}${/\s/.test(value) ? `"${value}"` : value}`;
}

/**
 * Parse a single `key:operator value` segment.
 * @returns {{key: string, operator: string, value: *}|null} null when it is plain search text
 */
export function parseToken(schema, segment, t) {
  const match = TOKEN_PATTERN.exec(segment);
  if (!match) return null;
  const [, key, operator, rawValue] = match;
  if (!schema[key]) return null;
  const value = coerceValue(schema, key, unquote(rawValue), t);
  if (value === null) return null;
  const resolved = operator || defaultOperator(schema, key);
  if (!operatorsFor(schema, key).includes(resolved)) return null;
  return {key, operator: resolved, value};
}

/**
 * Split text into tokens and leftover free-text words (quoted values stay in one piece).
 * @returns {{tokens: Array<Object>, text: string[]}}
 */
export function parseQuery(schema, text, t) {
  const segments = String(text || "").match(SEGMENT_PATTERN) || [];
  const tokens = [];
  const rest = [];
  segments.forEach((segment) => {
    const token = parseToken(schema, segment, t);
    if (token) {
      tokens.push(token);
    } else {
      rest.push(segment);
    }
  });
  return {tokens, text: rest};
}
