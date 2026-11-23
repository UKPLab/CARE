/**
 * Per-user settings of the date/time picker: the quick-time buttons (and their order) and the
 * chosen time zone. Saved as one row in the `user_environment` table (key {@link ENV_KEY}, no
 * document/session/step). The state is shared by all pickers on the page, so a change in one
 * picker shows up in the others right away; the pickers keep it in sync with the table.
 */
import {reactive} from "vue";
import {isValidTimeZone} from "@/basic/form/timeZone";

export const ENV_TABLE = "user_environment";
export const ENV_KEY = "datetimePicker";
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DEFAULT_TIME_PRESETS = Object.freeze(["00:00", "09:00", "12:00", "14:00", "23:59"]);
export const MAX_TIME_PRESETS = 5;

/** @returns {string[]} Valid, unique "HH:MM" values in the given order, at most MAX_TIME_PRESETS. */
export function cleanPresets(list) {
  if (!Array.isArray(list)) return [...DEFAULT_TIME_PRESETS];
  return [...new Set(list.filter((value) => TIME_RE.test(value)))].slice(0, MAX_TIME_PRESETS);
}

function defaults() {
  // timeZone null = follow the device zone
  return {timePresets: [...DEFAULT_TIME_PRESETS], timeZone: null};
}

/** @param {string} value Saved JSON from user_environment.value */
function parse(value) {
  try {
    const saved = JSON.parse(value || "null");
    return {
      timePresets: Array.isArray(saved?.timePresets) ? cleanPresets(saved.timePresets) : [...DEFAULT_TIME_PRESETS],
      timeZone: isValidTimeZone(saved?.timeZone) ? saved.timeZone : null,
    };
  } catch (_error) {
    return defaults();
  }
}

function serialize() {
  return JSON.stringify({
    timePresets: datetimePrefs.timePresets,
    timeZone: datetimePrefs.timeZone,
  });
}

export const datetimePrefs = reactive(defaults());

let ownerId = null; // user the state belongs to
let rowId = null; // id of that user's row, once known
let creating = false; // a create is in flight; later saves wait for its id
let saveAfterCreate = false;

/**
 * Takes over the saved row from the store. Called by the pickers whenever the row changes.
 *
 * @param {Object|null} row The user's user_environment row with key ENV_KEY, or null if none yet
 * @param {number|null} userId Logged-in user
 */
export function syncFromRow(row, userId) {
  if (userId !== ownerId) {
    // Another user logged in: drop the previous user's state
    ownerId = userId;
    rowId = null;
    creating = false;
    saveAfterCreate = false;
    Object.assign(datetimePrefs, defaults());
  }
  if (!row) return;
  rowId = row.id;
  if (row.value !== serialize()) {
    Object.assign(datetimePrefs, parse(row.value));
  }
}

/**
 * Writes the current state to user_environment: updates the row, or creates it on first save.
 *
 * @param {Object} socket The app socket (`this.$socket`)
 */
function save(socket) {
  if (!socket) return;
  if (rowId) {
    socket.emit("appDataUpdate", {table: ENV_TABLE, data: {id: rowId, value: serialize()}});
    return;
  }
  if (creating) {
    saveAfterCreate = true;
    return;
  }
  creating = true;
  // userId is set by the backend
  socket.emit("appDataUpdate", {table: ENV_TABLE, data: {key: ENV_KEY, value: serialize()}}, (result) => {
    creating = false;
    if (result?.success && result.data) rowId = result.data;
    if (saveAfterCreate) {
      saveAfterCreate = false;
      save(socket);
    }
  });
}

/**
 * @param {string[]} list New quick times in display order.
 * @param {Object} socket The app socket (`this.$socket`)
 */
export function setTimePresets(list, socket) {
  datetimePrefs.timePresets = cleanPresets(list);
  save(socket);
}

/**
 * @param {string|null} zone IANA id, or null to follow the device zone.
 * @param {Object} socket The app socket (`this.$socket`)
 */
export function setPreferredTimeZone(zone, socket) {
  datetimePrefs.timeZone = isValidTimeZone(zone) ? zone : null;
  save(socket);
}
