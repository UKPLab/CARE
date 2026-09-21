/**
 * Filter tokens for the table search bar (basic/table/Search.vue).
 *
 * A token is `{key, operator, value}`. The same token can be produced by picking from the dropdown
 * or by typing / pasting `key:operator value`, and serializes back to that text so a whole query
 * can be copied and reused. Which keys exist and what they accept comes from the table's schema:
 *
 *   {state: {label: "Status", type: "enum", options: ["running", "closed"]},
 *    collab: {label: "Collaborative", type: "boolean"},
 *    sessions: {label: "Sessions", type: "numeric"},
 *    createdAt: {label: "Created", type: "date"}}
 *
 * Lists: `=` `[1,2]` exact set. `~` `[1,2]` has 1 and 2 (extras ok). `%` `[1,2]` has 1 or 2.
 * `!=` `[1,2,null]` none of. Mixed `[1,null]` is invalid on `=` / `~`.
 * 
 * @author Andrii Niktin
 */

export const OPERATOR_LABELS = {
  "=": "=",
  "!=": "!=",
  "~": "~",
  "%": "%",
  ">": ">",
  ">=": "\u2265",
  "<": "<",
  "<=": "\u2264",
};

/** Chip text for `~` and `%` */
export const OPERATOR_LABEL_KEYS = {
  "~": "common.searchOp.contains",
  "%": "common.searchOp.containsAny",
};

/** Right-hand words in the operator dropdown */
export const OPERATOR_HINTS = {
  "=": "common.searchOp.is",
  "!=": "common.searchOp.isNot",
  ...OPERATOR_LABEL_KEYS,
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
  enum: ["=", "!="],
  numeric: ["=", "!=", ">", ">=", "<", "<="],
  date: ["=", ">", ">=", "<", "<="],
  text: ["=", "!=", "~", "%"],
};

/** Dropdown order: `=` / `!=` first, comparisons, then `~` / `%`. */
const OPERATOR_ORDER = ["=", "!=", ">", ">=", "<", "<=", "~", "%"];

function orderedOperators(ops) {
  const rank = new Map(OPERATOR_ORDER.map((operator, index) => [operator, index]));
  return [...ops].sort((left, right) => (rank.get(left) ?? 99) - (rank.get(right) ?? 99));
}

// One chip as text: `key:operatorvalue`. Operator is optional (`state:running` → default `=`).
const TOKEN_OPERATORS = "(!=|>=|<=|~|%|=|>|<)";
const TOKEN_PATTERN = new RegExp(`^([A-Za-z_][A-Za-z0-9_]*):${TOKEN_OPERATORS}?(.*)$`);
/** Incomplete `key:operator` in the draft (`sessions:%`) — waiting for a value. */
export const PENDING_TOKEN_PATTERN = new RegExp(`^([A-Za-z_][A-Za-z0-9_]*):${TOKEN_OPERATORS}$`);

// One segment is either something ending in a quoted value (`state:="not started"`) or a bare word.
const SEGMENT_PATTERN = /[^\s"]*"[^"]*"|\S+/g;

const TRUTHY = ["yes", "true", "1"];
const FALSY = ["no", "false", "0"];

const LIST_OPERATORS = new Set(["=", "!=", "~", "%"]);

function isListOperator(operator) {
  return LIST_OPERATORS.has(operator);
}

/** null, empty string, or the word "null". */
function isMissingItem(item) {
  return item === null || item === "" || (typeof item === "string" && /^null$/i.test(item.trim()));
}

/**
 * Cell text → tokens. `2,3` / `[1, 2]` / `2` / empty (missing).
 * @param {*} value
 * @returns {string[]}
 */
export function parseCellTokens(value) {
  if (value === null || value === undefined) return [];
  const text = String(value).trim();
  if (isMissingItem(text)) return [];
  const inner = text.startsWith("[") && text.endsWith("]") ? text.slice(1, -1).trim() : text;
  if (!inner) return [];
  return inner.split(",").map((item) => item.trim()).filter((item) => !isMissingItem(item));
}

/** Which items are real values, and whether the list also asks for missing / no group. */
function queryListParts(value) {
  const items = Array.isArray(value) ? value : [value];
  const present = [];
  let missing = false;
  items.forEach((item) => {
    if (isMissingItem(item)) missing = true;
    else present.push(String(item).trim());
  });
  return {present, missing};
}

/** Same items, ignoring order and duplicates (`=`). */
function sameTokenSet(left, right) {
  const a = [...new Set(left.map(String))].sort();
  const b = [...new Set(right.map(String))].sort();
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/** At least one item in common (`%`, `!=`). */
function tokenSetsOverlap(left, right) {
  const set = new Set(left.map(String));
  return right.some((item) => set.has(String(item)));
}

/** Cell has every required item; extras are fine (`~`). */
function tokenSetContainsAll(cell, required) {
  const set = new Set(cell.map(String));
  return required.every((item) => set.has(String(item)));
}

/** `=` / `~` cannot mean both "has 1" and "is missing". */
function mixedMissingInvalid(operator, missing, hasPresent) {
  return (operator === "=" || operator === "~") && missing && hasPresent;
}

/**
 * List chip vs a cell: `=` exact set, `~` has all, `%` has any, `!=` none of.
 * Mixed `[1,null]` on `=` / `~` is invalid (returns false).
 * @returns {boolean}
 */
export function matchesTokenList(cellValue, operator, filterValue) {
  const cell = parseCellTokens(cellValue);
  const cellMissing = cell.length === 0;
  const {present, missing} = queryListParts(filterValue);
  if (operator === "=") {
    if (mixedMissingInvalid(operator, missing, present.length > 0)) return false;
    if (missing) return cellMissing;
    return !cellMissing && sameTokenSet(cell, present);
  }
  if (operator === "!=") {
    if (present.length > 0 && tokenSetsOverlap(cell, present)) return false;
    if (missing && cellMissing) return false;
    return true;
  }
  if (operator === "~") {
    if (mixedMissingInvalid(operator, missing, present.length > 0)) return false;
    if (missing) return cellMissing;
    return present.length > 0 && tokenSetContainsAll(cell, present);
  }
  if (operator === "%") {
    if (present.length > 0 && tokenSetsOverlap(cell, present)) return true;
    if (missing && cellMissing) return true;
    return false;
  }
  return false;
}

/**
 * Turn `[1, 2]` into a list of items. `[]` means missing / no group.
 * Empty slots (`[1,,2]` or a trailing comma) are rejected
 * @param {string} text
 * @returns {{items: Array}|{invalid: true}|null} null when the text is not a list
 */
export function parseBracketList(text) {
  const trimmed = String(text ?? "").trim();
  if (trimmed.length < 2 || trimmed[0] !== "[" || trimmed[trimmed.length - 1] !== "]") {
    return null;
  }
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) {
    return {items: [null]};
  }
  const parts = inner.split(",").map((item) => item.trim());
  if (parts.some((item) => item === "")) {
    return {invalid: true};
  }
  return {
    items: parts.map((item) => (isMissingItem(item) ? null : item)),
  };
}

function operatorDisplay(operator, t) {
  const key = OPERATOR_LABEL_KEYS[operator];
  if (key) return t(key);
  return OPERATOR_LABELS[operator] || operator;
}

function yesNoLabels(t) {
  return {yes: t("common.yes"), no: t("common.no")};
}

/** yes/true/1, no/false/0, or the current Yes/No translation. */
function matchesBoolWord(value, t) {
  const lower = value.toLowerCase();
  if (TRUTHY.includes(lower)) return true;
  if (FALSY.includes(lower)) return false;
  const labels = yesNoLabels(t);
  if (lower === String(labels.yes).toLowerCase()) return true;
  if (lower === String(labels.no).toLowerCase()) return false;
  return null;
}

/** Chip/dropdown name for a column. */
export function keyLabel(schema, key) {
  return schema[key]?.label || key;
}

/** Operators this column may use. */
export function operatorsFor(schema, key) {
  const entry = schema[key];
  if (!entry) return [];
  return orderedOperators(entry.operators || OPERATORS_BY_TYPE[entry.type] || OPERATORS_BY_TYPE.text);
}

/** Omitted operator (`state:running`). Text still defaults to contains. */
export function defaultOperator(schema, key) {
  const ops = operatorsFor(schema, key);
  if (schema[key]?.type === "text" && ops.includes("~")) return "~";
  return ops.includes("=") ? "=" : (ops[0] || "=");
}

/** Values that can be picked from the dropdown; numeric, date, and text keys are typed instead. */
export function optionsFor(schema, key, t) {
  const entry = schema[key];
  if (!entry) return [];
  if (entry.type === "boolean") {
    const labels = yesNoLabels(t);
    return [
      {value: true, label: labels.yes},
      {value: false, label: labels.no},
    ];
  }
  if (entry.type === "enum") {
    return (entry.options || entry.values || []).map((option) => (
      typeof option === "object"
        ? {value: option.value, label: option.label ?? String(option.value)}
        : {value: option, label: String(option)}
    ));
  }
  return [];
}

/** Strip wrapping quotes so `state:="not started"` keeps the space in the value. */
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
 * Parse a single value for this column (number, date, yes/no, …).
 * @returns {*|null} that value, or null if it does not fit.
 */
function coerceScalar(schema, key, raw, t) {
  const entry = schema[key];
  if (!entry) return null;
  const value = String(raw ?? "").trim();
  if (!value) return null;

  if (entry.type === "boolean") {
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

/**
 * Parse lists `[1, 2]` here; 
 * @returns {*|null} null when the text is not valid for this column.
 */
export function coerceValue(schema, key, raw, t, operator = "=") {
  const entry = schema[key];
  if (!entry) return null;
  const value = String(raw ?? "").trim();
  if (!value) return null;

  if (isListOperator(operator) && operatorsFor(schema, key).includes(operator)) {
    if (isMissingItem(value)) {
      return [null];
    }
    const parsed = parseBracketList(value);
    if (parsed?.invalid) {
      return null;
    }
    if (parsed?.items) {
      const coerced = parsed.items.map((item) => (
        item === null ? null : coerceScalar(schema, key, item, t)
      ));
      if (coerced.some((item, index) => item === null && parsed.items[index] !== null)) return null;
      const hasMissing = coerced.some((item) => item === null);
      const hasPresent = coerced.some((item) => item !== null);
      if (mixedMissingInvalid(operator, hasMissing, hasPresent)) return null;
      return coerced;
    }
  }
  return coerceScalar(schema, key, value, t);
}

/** Chip text for one value: Yes/No, the enum label, or the word null. */
function displayScalar(schema, key, value, t) {
  if (value === null) {
    return "null";
  }
  const entry = schema[key];
  if (entry && (entry.type === "boolean")) {
    const labels = yesNoLabels(t);
    return value ? labels.yes : labels.no;
  }
  if (entry && entry.type === "enum") {
    const match = optionsFor(schema, key, t).find((option) => option.value === value);
    if (match) return match.label;
  }
  return String(value);
}

/**
 * Value as shown on the chip. Lists keep the `[1, 2]` shape.
 * @returns {string}
 */
export function displayValue(schema, token, t) {
  if (Array.isArray(token.value)) {
    return `[${token.value.map((item) => displayScalar(schema, token.key, item, t)).join(", ")}]`;
  }
  return displayScalar(schema, token.key, token.value, t);
}

/**
 * Label drawn on the chip: column name, operator, and the display value.
 * @returns {string}
 */
export function tokenLabel(schema, token, t) {
  const operator = operatorDisplay(token.operator, t);
  return `${keyLabel(schema, token.key)} ${operator} ${displayValue(schema, token, t)}`;
}

/** Canonical text for one value in the copied query. Booleans stay yes/no, not Ja/Nein. */
function serializeScalar(schema, key, value) {
  if (value === null) {
    return "null";
  }
  const entry = schema[key];
  if (entry && (entry.type === "boolean")) {
    return value ? "yes" : "no";
  }
  return String(value);
}

/**
 * Token as text for the copyable query
 */
export function serializeToken(schema, token) {
  const value = Array.isArray(token.value)
    ? `[${token.value.map((item) => serializeScalar(schema, token.key, item)).join(",")}]`
    : serializeScalar(schema, token.key, token.value);
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
  const resolved = operator || defaultOperator(schema, key);
  if (!operatorsFor(schema, key).includes(resolved)) return null;
  const value = coerceValue(schema, key, unquote(rawValue), t, resolved);
  if (value === null) return null;
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
