/**
 * Per-user settings of the date/time picker: the quick-time buttons (and their order) and the
 * chosen time zone. Stored in localStorage for now; the state is shared by all pickers on the page,
 * so a change in one picker shows up in the others right away.
 */
import {reactive} from "vue";
import {isValidTimeZone} from "@/basic/form/timeZone";

const STORAGE_KEY = "care.datetimePicker";
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DEFAULT_TIME_PRESETS = Object.freeze(["00:00", "09:00", "12:00", "14:00", "23:59"]);
export const MAX_TIME_PRESETS = 5;

/** @returns {string[]} Valid, unique "HH:MM" values in the given order, at most MAX_TIME_PRESETS. */
export function cleanPresets(list) {
  if (!Array.isArray(list)) return [...DEFAULT_TIME_PRESETS];
  return [...new Set(list.filter((value) => TIME_RE.test(value)))].slice(0, MAX_TIME_PRESETS);
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return {
      timePresets: Array.isArray(saved?.timePresets) ? cleanPresets(saved.timePresets) : [...DEFAULT_TIME_PRESETS],
      // null = follow the device zone
      timeZone: isValidTimeZone(saved?.timeZone) ? saved.timeZone : null,
    };
  } catch {
    return {timePresets: [...DEFAULT_TIME_PRESETS], timeZone: null};
  }
}

export const datetimePrefs = reactive(load());

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      timePresets: datetimePrefs.timePresets,
      timeZone: datetimePrefs.timeZone,
    }));
  } catch {
    // Not persisted (private mode, quota); the choice still holds for this visit.
  }
}

/** @param {string[]} list New quick times in display order. */
export function setTimePresets(list) {
  datetimePrefs.timePresets = cleanPresets(list);
  persist();
}

/** @param {string|null} zone IANA id, or null to follow the device zone. */
export function setPreferredTimeZone(zone) {
  datetimePrefs.timeZone = isValidTimeZone(zone) ? zone : null;
  persist();
}
