/**
 * Form model of the Advanced Settings of criteria and rubrics: free key/value pairs. No key has a special
 * meaning or a predefined type.
 *
 * The form edits a list of rows (`{uid, key, value, raw}`) instead of an object, so duplicate and empty keys
 * can be shown inline while the user types. Values the user types are stored as strings. A stored value that is
 * not touched keeps its JSON type (number, boolean, string) when a new version is created from it: `raw` holds
 * the original value and is dropped as soon as the user edits that value.
 *
 * The limits repeat the ones of backend/utils/helper/assessmentVersions.js (`SETTINGS_LIMITS`, `UNSAFE_KEYS`);
 * the backend decides. Error values are keys relative to `assessmentManagement.errors`.
 * No `@/` imports (plain Node tests).
 *
 * @author Eyad Mohamed
 */

/** Same limits as the backend: entries, key length (after trimming), text value length. */
export const SETTINGS_LIMITS = Object.freeze({ maxEntries: 100, maxKeyLength: 255, maxValueLength: 10000 });

/** Keys that would reach the prototype of other objects; the backend refuses them too. */
export const UNSAFE_KEYS = Object.freeze(["__proto__", "constructor", "prototype"]);

let rowUid = 0;

/** @returns {{uid: number, key: string, value: string, raw: *}} a new empty row */
export function emptySettingsRow() {
  return { uid: ++rowUid, key: "", value: "", raw: undefined };
}

/**
 * Rows of a stored settings object, in the order of the object. Values are shown as text; the original value
 * is kept in `raw` so an untouched row keeps its type.
 *
 * @param {Object|null|undefined} settings - Stored settings
 * @returns {Array<{uid: number, key: string, value: string, raw: *}>}
 */
export function rowsFromSettings(settings) {
  return Object.entries(settings ?? {}).map(([key, raw]) => ({ uid: ++rowUid, key, value: String(raw), raw }));
}

/**
 * The settings object to send. Keys are trimmed. A value that was not edited keeps its stored type; a typed
 * value is sent as a string (also when it looks like a number or `true`).
 *
 * @param {Array<{key: string, value: string, raw: *}>} rows
 * @returns {Object<string, string|number|boolean>}
 */
export function settingsFromRows(rows) {
  const settings = {};
  for (const row of rows) {
    settings[String(row.key).trim()] = row.raw !== undefined ? row.raw : String(row.value);
  }
  return settings;
}

/**
 * Check every row: a key is required, at most 255 characters, not an unsafe name and unique (after trimming,
 * case-sensitive like the backend); a text value is at most 10 000 characters.
 *
 * @param {Array<{uid: number, key: string, value: string, raw: *}>} rows
 * @returns {{rows: Object<number, {key?: string, value?: string}>, general?: string}} errors by row uid; `general`
 *   when there are more rows than the backend accepts. Empty `rows` and no `general` when valid.
 */
export function validateSettingsRows(rows) {
  const byRow = {};
  const seen = new Map();
  for (const row of rows) {
    const key = String(row.key).trim();
    const errors = {};
    if (key === "") errors.key = "settingsKeyRequired";
    else if (key.length > SETTINGS_LIMITS.maxKeyLength) errors.key = "settingsKeyTooLong";
    else if (UNSAFE_KEYS.includes(key)) errors.key = "settingsKeyUnsafe";
    else if (seen.has(key)) {
      errors.key = "settingsKeyDuplicate";
      if (!byRow[seen.get(key)]?.key) byRow[seen.get(key)] = { ...byRow[seen.get(key)], key: "settingsKeyDuplicate" };
    } else seen.set(key, row.uid);
    if (row.raw === undefined && String(row.value).length > SETTINGS_LIMITS.maxValueLength) {
      errors.value = "settingsValueTooLong";
    }
    if (Object.keys(errors).length) byRow[row.uid] = { ...byRow[row.uid], ...errors };
  }
  const result = { rows: byRow };
  if (rows.length > SETTINGS_LIMITS.maxEntries) result.general = "settingsTooMany";
  return result;
}

/** @returns {boolean} true when the rows have no error */
export function settingsRowsValid(rows) {
  const { rows: byRow, general } = validateSettingsRows(rows);
  return !general && Object.keys(byRow).length === 0;
}
