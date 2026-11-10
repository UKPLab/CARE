/**
 * Time zone helpers for the date/time picker, built only on Intl (no extra library).
 *
 * All conversions work with IANA zone ids ("Europe/Berlin") and handle summer/winter time:
 * offsets are always read for the exact moment, never assumed from "now".
 */

const pad = (n) => String(n).padStart(2, "0");
const DAY_MS = 86400000;

/** Common zones, used only if the browser cannot list all of them. */
const FALLBACK_ZONES = [
  "UTC",
  "Pacific/Honolulu", "America/Anchorage", "America/Los_Angeles", "America/Denver", "America/Chicago",
  "America/New_York", "America/Halifax", "America/Sao_Paulo", "Atlantic/Azores",
  "Europe/London", "Europe/Lisbon", "Europe/Berlin", "Europe/Paris", "Europe/Madrid", "Europe/Rome",
  "Europe/Amsterdam", "Europe/Zurich", "Europe/Vienna", "Europe/Warsaw", "Europe/Athens", "Europe/Helsinki",
  "Europe/Kyiv", "Europe/Istanbul", "Europe/Moscow", "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata",
  "Asia/Kathmandu", "Asia/Dhaka", "Asia/Bangkok", "Asia/Shanghai", "Asia/Singapore", "Asia/Tokyo",
  "Asia/Seoul", "Australia/Perth", "Australia/Adelaide", "Australia/Sydney", "Pacific/Auckland",
];

const partsFormatters = new Map();

/** @returns {Intl.DateTimeFormat} Cached formatter that gives the wall clock of a zone. */
function partsFormatter(zone) {
  let formatter = partsFormatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(zone, formatter);
  }
  return formatter;
}

/** Wall clock in `zone` at timestamp `ts`. */
function wallClock(zone, ts) {
  const parts = {};
  for (const {type, value} of partsFormatter(zone).formatToParts(new Date(ts))) parts[type] = value;
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    h: Number(parts.hour) % 24,
    mi: Number(parts.minute),
    s: Number(parts.second),
  };
}

/** @returns {string} The browser's zone id, "UTC" if unknown. */
export function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** @returns {boolean} Whether the browser knows this zone id. */
export function isValidTimeZone(zone) {
  if (typeof zone !== "string" || !zone) return false;
  try {
    partsFormatter(zone);
    return true;
  } catch {
    return false;
  }
}

/** @returns {string[]} All zone ids the browser supports, always including UTC and the device zone. */
export function listTimeZones() {
  let zones;
  try {
    zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : null;
  } catch {
    zones = null;
  }
  const all = new Set(zones && zones.length ? zones : FALLBACK_ZONES);
  all.add("UTC");
  all.add(deviceTimeZone());
  return [...all].filter(isValidTimeZone);
}

/** @returns {number} UTC offset of `zone` at `ts` in minutes (east of UTC is positive). */
export function offsetAt(zone, ts) {
  const w = wallClock(zone, ts);
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  return Math.round((asUtc - Math.floor(ts / 1000) * 1000) / 60000);
}

/** @returns {{ymd: string, hm: string}} Date "YYYY-MM-DD" and time "HH:MM" in `zone` at `ts`. */
export function zonedParts(zone, ts) {
  const w = wallClock(zone, ts);
  return {ymd: `${w.y}-${pad(w.m)}-${pad(w.d)}`, hm: `${pad(w.h)}:${pad(w.mi)}`};
}

/**
 * Timestamp of a wall-clock time in a zone, with the same rules as browsers use for local time:
 * - a time repeated by the autumn change resolves to the first (summer time) occurrence;
 * - a time skipped by the spring change is moved forward by the gap (02:30 -> 03:30).
 * @returns {number}
 */
export function zonedToUtc(zone, ymd, hm) {
  const [y, m, d] = ymd.split("-").map(Number);
  const [h, mi] = (hm || "00:00").split(":").map(Number);
  const local = Date.UTC(y, m - 1, d, h, mi);
  if (Number.isNaN(local)) return NaN;
  const before = offsetAt(zone, local - DAY_MS);
  const after = offsetAt(zone, local + DAY_MS);
  const candidates = [...new Set([local - before * 60000, local - after * 60000])]
    .filter((ts) => local - ts === offsetAt(zone, ts) * 60000)
    .sort((a, b) => a - b);
  return candidates.length ? candidates[0] : local - before * 60000;
}

/** @returns {string} The day before "YYYY-MM-DD". */
function previousYmd(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/** @returns {{before: number, after: number}} Offsets before the day starts and at its end. */
export function dayOffsets(zone, ymd) {
  return {
    before: offsetAt(zone, zonedToUtc(zone, previousYmd(ymd), "23:59")),
    after: offsetAt(zone, zonedToUtc(zone, ymd, "23:59")),
  };
}

/** @returns {{offset: number, observesDst: boolean, isDst: boolean}} Summer/winter time at `ts`. */
export function dstInfo(zone, ts) {
  const offset = offsetAt(zone, ts);
  const year = wallClock(zone, ts).y;
  const jan = offsetAt(zone, Date.UTC(year, 0, 1));
  const jul = offsetAt(zone, Date.UTC(year, 6, 1));
  const observesDst = jan !== jul;
  // Max of Jan/Jul works for both hemispheres
  return {offset, observesDst, isDst: observesDst && offset === Math.max(jan, jul)};
}

/** 60 -> "UTC+1", 330 -> "UTC+5:30", -180 -> "UTC−3", 0 -> "UTC" */
export function formatOffset(minutes) {
  if (!minutes) return "UTC";
  const abs = Math.abs(minutes);
  const rest = abs % 60;
  return `UTC${minutes < 0 ? "−" : "+"}${Math.floor(abs / 60)}${rest ? `:${pad(rest)}` : ""}`;
}

/**
 * Localized zone name at `ts`, e.g. "Central European Summer Time". Empty when the locale only
 * knows a "GMT+2"-style name, which would repeat the offset.
 * @returns {string}
 */
export function zoneName(zone, ts, locale, style = "long") {
  try {
    const name = new Intl.DateTimeFormat(locale, {timeZone: zone, timeZoneName: style})
      .formatToParts(new Date(ts))
      .find((part) => part.type === "timeZoneName")?.value || "";
    return /^(GMT|UTC)([+\-−]|$)/.test(name) ? "" : name;
  } catch {
    return "";
  }
}

/** "America/Argentina/Buenos_Aires" -> {city: "Buenos Aires", region: "America / Argentina"} */
export function splitZoneId(zone) {
  const parts = zone.split("/");
  const city = parts.pop().replace(/_/g, " ");
  return {city, region: parts.join(" / ").replace(/_/g, " ")};
}
