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
 *    sessions: {label: "Sessions", type: "numeric"}}
 */

export const OPERATOR_LABELS = {
  "=": "=",
  "!=": "!=",
  "~": "contains",
  ">": ">",
  ">=": "\u2265",
  "<": "<",
  "<=": "\u2264",
};

/** Right-hand words in the operator dropdown (GitLab: symbol left, "is" / "is not" right). */
export const OPERATOR_HINTS = {
  "=": "is",
  "!=": "is not",
  "~": "contains",
  ">": "greater than",
  ">=": "greater or equal",
  "<": "less than",
  "<=": "less or equal",
};

// Types whose value is typed rather than picked from a list — the token stays incomplete until a
// value is entered, so `sessions:>=` never becomes a filter on its own.
const TYPED_VALUE_TYPES = new Set(["numeric", "text"]);

/** True when the value for this key has to be typed (no options to pick). */
export function needsTypedValue(schema, key) {
  return TYPED_VALUE_TYPES.has(schema[key]?.type);
}

const OPERATORS_BY_TYPE = {
  boolean: ["=", "!="],
  exists: ["=", "!="],
  enum: ["=", "!="],
  numeric: ["=", "!=", ">", ">=", "<", "<="],
  text: ["~", "="],
};

const TOKEN_PATTERN = /^([A-Za-z_][A-Za-z0-9_]*):(!=|>=|<=|~|=|>|<)?(.*)$/;

// One segment is either something ending in a quoted value (`state:="not started"`) or a bare word.
const SEGMENT_PATTERN = /[^\s"]*"[^"]*"|\S+/g;

const TRUTHY = ["yes", "true", "1"];
const FALSY = ["no", "false", "0"];

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

/** Values that can be picked from the dropdown; numeric and text keys are typed instead. */
export function optionsFor(schema, key) {
  const entry = schema[key];
  if (!entry) return [];
  if (entry.type === "boolean" || entry.type === "exists") {
    return [
      {value: true, label: "yes"},
      {value: false, label: "no"},
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

/**
 * Text from the bar → typed value for that key, or null when it does not fit.
 * @returns {*|null}
 */
export function coerceValue(schema, key, raw) {
  const entry = schema[key];
  if (!entry) return null;
  const value = String(raw ?? "").trim();
  if (!value) return null;

  if (entry.type === "boolean" || entry.type === "exists") {
    if (TRUTHY.includes(value.toLowerCase())) return true;
    if (FALSY.includes(value.toLowerCase())) return false;
    return null;
  }
  if (entry.type === "numeric") {
    // Digits only — no Number("0x10") / Number("1e2") / eval. Values go to SQL via Sequelize binds.
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  if (entry.type === "enum") {
    const options = optionsFor(schema, key);
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
export function displayValue(schema, token) {
  const entry = schema[token.key];
  if (entry && (entry.type === "boolean" || entry.type === "exists")) {
    return token.value ? "yes" : "no";
  }
  if (entry && entry.type === "enum") {
    const match = optionsFor(schema, token.key).find((option) => option.value === token.value);
    if (match) return match.label;
  }
  return String(token.value);
}

export function tokenLabel(schema, token) {
  const operator = OPERATOR_LABELS[token.operator] || token.operator;
  return `${keyLabel(schema, token.key)} ${operator} ${displayValue(schema, token)}`;
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
export function parseToken(schema, segment) {
  const match = TOKEN_PATTERN.exec(segment);
  if (!match) return null;
  const [, key, operator, rawValue] = match;
  if (!schema[key]) return null;
  const value = coerceValue(schema, key, unquote(rawValue));
  if (value === null) return null;
  const resolved = operator || defaultOperator(schema, key);
  if (!operatorsFor(schema, key).includes(resolved)) return null;
  return {key, operator: resolved, value};
}

/**
 * Split text into tokens and leftover free-text words (quoted values stay in one piece).
 * @returns {{tokens: Array<Object>, text: string[]}}
 */
export function parseQuery(schema, text) {
  const segments = String(text || "").match(SEGMENT_PATTERN) || [];
  const tokens = [];
  const rest = [];
  segments.forEach((segment) => {
    const token = parseToken(schema, segment);
    if (token) {
      tokens.push(token);
    } else {
      rest.push(segment);
    }
  });
  return {tokens, text: rest};
}
