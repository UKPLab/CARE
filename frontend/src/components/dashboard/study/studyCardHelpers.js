/**
 * What a study card shows, from a study row: status (tone, label, lock, pulse) and the
 * date line. Used by the Studies dashboard (StudyCardGrid.vue) and My Sessions
 * (StudySession.vue), so both read a study the same way. The card itself is StatusCard.vue.
 * Also the one client rule for "is this study open" (isStudyOpen / studyState) and the
 * day-based thresholds the dashboards share.
 *
 * Study states here: "pending" (not started yet), "running", "ended", "closed".
 *
 * @author Andrii Nikitin
 */
import { formatLocalizedDate, formatLocalizedDateTime, getTimeDiffString } from "@/assets/utils";

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Under this much time left, a close date or deadline counts as "soon" (amber). */
export const SOON_MS = 3 * DAY_MS;

/** Window of the Home "closing soon" study count. */
export const CLOSING_SOON_MS = 7 * DAY_MS;

const STATES = {
  pending: { tone: "warning", labelKey: "studies.status.notStarted" },
  running: { tone: "success", labelKey: "studies.status.running" },
  ended: { tone: "danger", labelKey: "studies.status.ended" },
  closed: { tone: "violet", labelKey: "studies.status.closed" },
};

/**
 * The Studies table names the first state "not started" (study model / enrichStudyRow).
 * @param {string} state
 * @returns {string} pending | running | ended | closed
 */
export function normalizeStudyState(state) {
  if (state === "not started") return "pending";
  return STATES[state] ? state : "closed";
}

/**
 * StatusCard props for the status of a study: bind with v-bind="studyCardStatus(...)".
 * @param {string} state study state, "not started" is accepted too
 * @param {Function} t vue-i18n translate
 * @returns {{tone: string, stateLabel: string, locked: boolean, live: boolean, dimmed: boolean}}
 */
export function studyCardStatus(state, t) {
  const key = normalizeStudyState(state);
  return {
    tone: STATES[key].tone,
    stateLabel: t(STATES[key].labelKey),
    locked: key === "closed",
    live: key === "running",
    dimmed: key === "ended",
  };
}

/** Date as the cards show it, e.g. "03 Nov 2026". */
export function formatStudyCardDate(value) {
  return formatLocalizedDate(value, { day: "2-digit", month: "short", year: "numeric" });
}

function toTime(value) {
  if (value === null || value === undefined || value === "") return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * Whether a study still takes sessions; same rule as the backend `mySessions` scope
 * (study model): not closed, and no end, an end not yet passed, or multiple submissions.
 * A missing `closed` counts as not closed and an unparseable end as no end.
 * @param {Object} study row with closed, end, multipleSubmit
 * @param {number} [now]
 * @returns {boolean}
 */
export function isStudyOpen(study, now = Date.now()) {
  if (!study || study.closed != null) return false;
  const end = toTime(study.end);
  return end === null || end >= now || !!study.multipleSubmit;
}

/**
 * Closed by hand wins over ended, so a study closed after its end reads "closed" everywhere.
 * @param {Object} study row with closed, end, multipleSubmit
 * @param {number} [now]
 * @returns {"closed"|"ended"|"open"}
 */
export function studyState(study, now = Date.now()) {
  if (study?.closed != null) return "closed";
  return isStudyOpen(study, now) ? "open" : "ended";
}

/**
 * Which buttons the viewer gets on one of their own sessions (My Sessions table and cards).
 * @param {Object} session study_session row
 * @param {Object} study row with resumable, createdByUserId, userId
 * @param {Object} options
 * @param {boolean} options.studyClosed the study no longer takes sessions (!isStudyOpen)
 * @param {boolean} options.showClosed closed-studies list: finished sessions can be inspected
 * @param {number} options.userId viewer
 * @returns {{resume: boolean, start: boolean, inspect: boolean, delete: boolean}}
 */
export function ownSessionActions(session, study, { studyClosed, showClosed, userId }) {
  const started = session.start !== undefined && session.start !== null;
  const finished = session.end !== undefined && session.end !== null;
  // A copied, unfinished session stays workable after its study closed.
  const reopened = studyClosed && !finished && session.parentStudySessionId != null;
  const workable = !studyClosed || reopened;
  return {
    resume: !!study.resumable && started && workable,
    start: !started && workable,
    inspect: showClosed && !reopened,
    delete: userId === study.createdByUserId && userId !== study.userId,
  };
}

/**
 * "in 3 days", "2 hours ago": a fixed label, fine for a list that is not re-rendered.
 * @param {string} [locale]
 * @returns {(time: number, now: number) => string}
 */
export function relativeTimeFormatter(locale) {
  let format = null;
  try {
    format = new Intl.RelativeTimeFormat(locale || undefined, { numeric: "auto" });
  } catch (_error) {
    format = null;
  }
  return (time, now) => {
    if (!format) return "";
    const diffMs = time - now;
    const minutes = Math.round(diffMs / 60000);
    const hours = Math.round(diffMs / 3600000);
    const days = Math.round(diffMs / DAY_MS);
    if (Math.abs(minutes) < 60) return format.format(minutes, "minute");
    if (Math.abs(hours) < 24) return format.format(hours, "hour");
    if (Math.abs(days) < 60) return format.format(days, "day");
    return format.format(Math.round(days / 30), "month");
  };
}

/**
 * "3 day(s) left": meant to be re-evaluated on a timer, so it counts down.
 * @param {Function} t vue-i18n translate
 * @returns {(time: number, now: number) => string}
 */
export function timeLeftFormatter(t) {
  return (time, now) => t("studies.dashboard.dueIn", { time: getTimeDiffString(now, time) });
}

/**
 * The date line of a study card (StatusCard `timeline` prop): when the study opens,
 * closes, ended or was closed.
 * @param {Object} study row with start, end, closed
 * @param {string} state study state, "not started" is accepted too
 * @param {Object} options
 * @param {Function} options.t vue-i18n translate
 * @param {(time: number, now: number) => string} options.relative label for the time to an
 *   upcoming date (relativeTimeFormatter or timeLeftFormatter)
 * @param {number} [options.now]
 * @returns {{icon: string, tone: string, label: string, relative: string, exact: string}|null}
 */
export function buildStudyTimeline(study, state, { t, relative, now = Date.now() }) {
  const key = normalizeStudyState(state);
  const start = toTime(study.start);
  const end = toTime(study.end);
  const entry = (icon, tone, labelKey, time, withRelative) => ({
    icon,
    tone,
    label: t(labelKey, { date: formatStudyCardDate(time) }),
    relative: withRelative && relative ? relative(time, now) : "",
    exact: formatLocalizedDateTime(time),
  });

  if (key === "pending") {
    return start ? entry("hourglass-split", "pending", "studies.cards.opensOn", start, true) : null;
  }
  if (key === "closed") {
    const closedAt = toTime(study.closed);
    return closedAt ? entry("lock", "muted", "studies.dashboard.closedOn", closedAt, false) : null;
  }
  if (key === "ended") {
    return end ? entry("calendar-check", "muted", "studies.cards.endedOn", end, false) : null;
  }
  // running
  if (!end) {
    return { icon: "infinity", tone: "muted", label: t("studies.cards.noEndDate"), relative: "", exact: "" };
  }
  if (end > now) {
    const soon = end - now <= SOON_MS;
    return entry(soon ? "alarm" : "calendar-event", soon ? "soon" : "running", "studies.cards.closesOn", end, true);
  }
  // Past the end but still running: multiple submissions keep existing sessions open.
  return entry("calendar-check", "muted", "studies.cards.noNewSessionsSince", end, false);
}
