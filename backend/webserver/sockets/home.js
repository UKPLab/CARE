const {Op, fn, col, literal} = require("sequelize");
const Socket = require("../Socket.js");
const TranslatableError = require("../../utils/TranslatableError");
const {positiveInt} = require("../../utils/helper/positiveInt.js");

const DAY_MS = 24 * 60 * 60 * 1000;
/** Home "closing soon" window, CLOSING_SOON_MS in frontend/src/components/dashboard/study/studyCardHelpers.js. */
const CLOSING_SOON_MS = 7 * DAY_MS;
/**
 * Dates sent for the activity graphs and the 7-day strip. HomeActivityGraph shows 12 weeks
 * starting on a Monday (at most 83 days back), so 13 weeks always cover it.
 */
const ACTIVITY_WINDOW_MS = 13 * 7 * DAY_MS;
/** Rows of the Home panels, same as the limits in frontend/src/components/dashboard/home/*.vue. */
const DEADLINES_LIMIT = 3;
const SESSIONS_LIMIT = 3;
const CONTINUE_LIMIT = 6;
const GUEST_STUDIES_LIMIT = 6;

// Seeded for the guest account in 20220706143939-basic-documents.js.
const SHOWCASE_DOCUMENT_HASH = "8852a746-360e-4c31-add2-4d1c75bfb96d";
const SHOWCASE_DOCUMENT_NAME = "Showcase Document";

// The session's study, as the dashboard had it from Vuex (deleted studies are not there).
const SESSION_STUDY = '"s"."id" = "study_session"."studyId" AND "s"."deleted" = false';
const sessionStudyField = (field) => `(SELECT "s"."${field}" FROM "study" AS "s" WHERE ${SESSION_STUDY})`;
/** Earlier of start + study.timeLimit minutes and study.end. LEAST skips NULLs. */
const SESSION_DEADLINE_SQL = '(SELECT LEAST('
    + 'CASE WHEN "s"."timeLimit" > 0 AND "study_session"."start" IS NOT NULL'
    + ' THEN "study_session"."start" + "s"."timeLimit" * INTERVAL \'1 minute\' END,'
    + ` "s"."end") FROM "study" AS "s" WHERE ${SESSION_STUDY})`;
/** Last use of a session, the Continue list order. */
const SESSION_USED_AT_SQL = 'COALESCE("study_session"."updatedAt", "study_session"."start", "study_session"."createdAt")';
/** Recency of a session, the order of the open sessions list. */
const SESSION_RECENT_SQL = 'COALESCE("study_session"."start", "study_session"."updatedAt")';

const SESSION_ATTRIBUTES = [
    "id", "hash", "studyId", "start", "createdAt", "updatedAt",
    [literal(sessionStudyField("name")), "studyName"],
];

/**
 * @param {*} value
 * @returns {number|null} epoch ms, or null for an empty or invalid date
 */
function toMs(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
}

/**
 * Model without the never-expiring query cache. Home reads depend on the current time (such a
 * WHERE never repeats, so the cache would only fill up) or on other tables through subqueries
 * (a write there does not clear this table's cache).
 * @param {Object} model
 * @returns {Object}
 */
function uncached(model) {
    return typeof model.noCache === "function" ? model.noCache() : model;
}

/**
 * Data of the dashboard Home page.
 *
 * Home used to subscribe the whole study table (and the viewer's documents, sessions,
 * assignments and submissions) into Vuex and count on the client. The counts, the short lists
 * and the activity dates are now computed here. Every read starts from the same row scope as
 * queryTable and the Vuex subscriptions (resolveQueryTableScope → getReadFilter), and narrows it
 * with the rules the Home panels applied on the client, so nobody sees more or less than before.
 *
 * @author Andrii Nikitin
 * @class HomeSocket
 */
class HomeSocket extends Socket {

    /**
     * Everything the Home page shows.
     *
     * Study parts are only computed with `frontend.dashboard.studies.view` and the assignment
     * tile only with `frontend.dashboard.submissions.view`, the rights that show these panels.
     * The shared guest account (`frontend.dashboard.home.guestView`, never an admin) gets the
     * guest page data only.
     *
     * @socketEvent homeSummaryGet
     * @param {Object} data
     * @param {number} data.projectId current project (setting `projects.default`)
     * @param {Object} options
     * @returns {Promise<Object>} `{guest, now, nextChangeAt, ...}`: guest → `showcaseDocument, studies`;
     *   otherwise → `documents, sessions, studies, submissions` (null when the panel is not shown)
     */
    async getHomeSummary(data, options) {
        const projectId = positiveInt(data?.projectId);
        const now = new Date();
        const since = new Date(now.getTime() - ACTIVITY_WINDOW_MS);
        const guest = !await this.isAdmin() && await this.hasAccess("frontend.dashboard.home.guestView");
        const canSeeStudies = await this.hasAccess("frontend.dashboard.studies.view");
        // No current project: the client filter `projectId === setting` matched nothing either.
        const studyScope = canSeeStudies && projectId
            ? await this.homeReadWhere("study", {projectId, template: {[Op.not]: true}})
            : null;

        if (guest) {
            const [showcaseDocument, studies, nextChangeAt] = await Promise.all([
                this.homeShowcaseDocument(),
                canSeeStudies ? this.homeGuestStudies(studyScope, now) : null,
                this.homeStudiesNextChange(studyScope, now),
            ]);
            return {guest: true, now: now.getTime(), nextChangeAt, showcaseDocument, studies};
        }

        const canSeeSubmissions = await this.hasAccess("frontend.dashboard.submissions.view");
        const [documents, sessions, studies, nextChangeAt, submissions] = await Promise.all([
            this.homeDocuments(projectId, since),
            this.homeSessions(since),
            canSeeStudies ? this.homeStudies(studyScope, now, since) : null,
            this.homeStudiesNextChange(studyScope, now),
            canSeeSubmissions ? this.homeSubmissions(since) : null,
        ]);
        return {guest: false, now: now.getTime(), nextChangeAt, documents, sessions, studies, submissions};
    }

    /**
     * Read scope of a table for this viewer (same rows as queryTable / a Vuex subscription),
     * narrowed by `extra`.
     * @param {string} table autoTable name
     * @param {Object} [extra] WHERE fragment ANDed to the scope
     * @returns {Promise<Object|null>} WHERE, or null when the viewer may not read the table
     *   (a subscription then sent no rows, it did not fail)
     */
    async homeReadWhere(table, extra = null) {
        try {
            const {where} = await this.resolveQueryTableScope({table});
            return extra ? {[Op.and]: [where, extra]} : where;
        } catch (err) {
            if (TranslatableError.is(err) && err.key === "errors.permission.noPermissionToAccesData") {
                return null;
            }
            throw err;
        }
    }

    /**
     * Created dates in the activity window.
     * @param {Object} model
     * @param {Object} where
     * @param {Date} since
     * @returns {Promise<number[]>}
     */
    async homeCreatedDates(model, where, since) {
        const rows = await uncached(model).findAll({
            where: {[Op.and]: [where, {createdAt: {[Op.gte]: since}}]},
            attributes: ["createdAt"],
            raw: true,
        });
        return rows.map((row) => toMs(row.createdAt)).filter((time) => time !== null);
    }

    /**
     * The viewer's own listed documents in the project (Document.ownListedFilter).
     * @param {number|null} projectId
     * @param {Date} since
     * @returns {Promise<{total: number, recent: Object[], createdDates: number[]}>}
     */
    async homeDocuments(projectId, since) {
        const empty = {total: 0, recent: [], createdDates: []};
        const Document = this.models["document"];
        const model = uncached(Document);
        const where = projectId
            ? await this.homeReadWhere("document", Document.ownListedFilter(this.userId, projectId))
            : null;
        if (!where) {
            return empty;
        }
        const [total, recent, createdDates] = await Promise.all([
            model.count({where}),
            // Continue list: most recently edited first.
            model.findAll({
                where,
                attributes: ["id", "name", "hash", "type", "createdAt", "updatedAt"],
                order: [["updatedAt", "DESC"], ["id", "DESC"]],
                limit: CONTINUE_LIMIT,
                raw: true,
            }),
            this.homeCreatedDates(model, where, since),
        ]);
        return {total, recent, createdDates};
    }

    /**
     * The viewer's own sessions, in every project as before.
     *
     * - `openTotal`, `oldestOpenAt`: the My Sessions tile.
     * - `upcoming`: open sessions with the soonest deadline (time limit or study end) first,
     *   sessions without one last in recency order, with the step progress.
     * - `recentByStudy`: one open session per study, the last used one, with the number of
     *   open sessions in that study; most recently used study first.
     * - `startedDates`, `finishedDates`: activity graph and 7-day strip.
     *
     * @param {Date} since
     * @returns {Promise<Object>}
     */
    async homeSessions(since) {
        const empty = {
            openTotal: 0, oldestOpenAt: null, upcoming: [], recentByStudy: [], startedDates: [], finishedDates: [],
        };
        // Uncached: the rows carry study fields (name, end, time limit, steps), and a study write
        // does not clear the session cache.
        const model = uncached(this.models["study_session"]);
        const where = await this.homeReadWhere("study_session", {userId: this.userId});
        if (!where) {
            return empty;
        }
        const openWhere = {[Op.and]: [where, {end: null}]};

        const [tile, upcomingRows, studyGroups, activityRows] = await Promise.all([
            model.findAll({
                where: openWhere,
                attributes: [
                    [fn("COUNT", col("id")), "total"],
                    [fn("MIN", literal('COALESCE("study_session"."start", "study_session"."createdAt")')), "oldest"],
                ],
                raw: true,
            }),
            model.findAll({
                where: openWhere,
                attributes: [
                    ...SESSION_ATTRIBUTES,
                    "studyStepIdMax",
                    [literal(sessionStudyField("end")), "studyEnd"],
                    [literal(sessionStudyField("timeLimit")), "studyTimeLimit"],
                    [literal('(SELECT COUNT(*) FROM "study_step" WHERE "study_step"."studyId" = "study_session"."studyId"'
                        + ' AND "study_step"."deleted" = false)'), "stepsTotal"],
                    [literal('(SELECT "study_step"."stepNumber" FROM "study_step"'
                        + ' WHERE "study_step"."id" = "study_session"."studyStepIdMax"'
                        + ' AND "study_step"."deleted" = false)'), "stepCurrent"],
                ],
                order: [
                    [literal(SESSION_DEADLINE_SQL), "ASC NULLS LAST"],
                    [literal(SESSION_RECENT_SQL), "DESC NULLS LAST"],
                    ["id", "DESC"],
                ],
                limit: SESSIONS_LIMIT,
                raw: true,
            }),
            model.findAll({
                where: openWhere,
                attributes: [
                    "studyId",
                    [fn("MAX", literal(SESSION_USED_AT_SQL)), "at"],
                    [fn("COUNT", col("id")), "count"],
                ],
                group: ["studyId"],
                order: [[fn("MAX", literal(SESSION_USED_AT_SQL)), "DESC NULLS LAST"]],
                limit: CONTINUE_LIMIT,
                raw: true,
            }),
            model.findAll({
                where: {
                    [Op.and]: [where, {
                        [Op.or]: [
                            {start: {[Op.gte]: since}},
                            {start: null, createdAt: {[Op.gte]: since}},
                            {end: {[Op.gte]: since}},
                        ],
                    }],
                },
                attributes: ["start", "createdAt", "end"],
                raw: true,
            }),
        ]);

        // The last used open session of each listed study. On a tie the most recent one wins,
        // as in the list the client used to walk.
        const studyIds = studyGroups.map((group) => group.studyId).filter((id) => id != null);
        const groupRows = studyIds.length === 0 ? [] : await model.findAll({
            where: {[Op.and]: [openWhere, {studyId: {[Op.in]: studyIds}}]},
            attributes: SESSION_ATTRIBUTES,
            order: [[literal(SESSION_RECENT_SQL), "DESC NULLS LAST"], ["id", "DESC"]],
            raw: true,
        });
        const lastUsed = new Map();
        for (const row of groupRows) {
            const at = toMs(row.updatedAt || row.start || row.createdAt);
            const current = lastUsed.get(row.studyId);
            if (!current || at > current.at) {
                lastUsed.set(row.studyId, {at, row});
            }
        }
        const recentByStudy = studyGroups
            .filter((group) => lastUsed.has(group.studyId))
            .map((group) => ({
                ...lastUsed.get(group.studyId).row,
                at: toMs(group.at),
                count: Number(group.count) || 0,
            }));

        const upcoming = upcomingRows.map(({studyEnd, studyTimeLimit, stepsTotal, stepCurrent, ...row}) => ({
            ...row,
            deadline: HomeSocket.sessionDeadline(row.start, studyTimeLimit, studyEnd),
            stepsTotal: Number(stepsTotal) || 0,
            stepCurrent: stepCurrent == null ? null : Number(stepCurrent),
        }));

        return {
            openTotal: Number(tile[0]?.total) || 0,
            oldestOpenAt: toMs(tile[0]?.oldest),
            upcoming,
            recentByStudy,
            startedDates: activityRows.map((row) => toMs(row.start || row.createdAt)).filter((time) => time !== null),
            finishedDates: activityRows.map((row) => toMs(row.end)).filter((time) => time !== null),
        };
    }

    /**
     * Earliest of the session's time limit and the study end (same choice as SESSION_DEADLINE_SQL;
     * on a tie the time limit is named).
     * @param {*} start session start
     * @param {number|null} timeLimit study time limit in minutes
     * @param {*} end study end
     * @returns {{at: number, kind: "timeLimit"|"study"}|null}
     */
    static sessionDeadline(start, timeLimit, end) {
        const candidates = [];
        const startMs = toMs(start);
        if (timeLimit > 0 && startMs !== null) {
            candidates.push({at: startMs + timeLimit * 60 * 1000, kind: "timeLimit"});
        }
        const endMs = toMs(end);
        if (endMs !== null) {
            candidates.push({at: endMs, kind: "study"});
        }
        if (candidates.length === 0) {
            return null;
        }
        return candidates.reduce((min, candidate) => (candidate.at < min.at ? candidate : min));
    }

    /**
     * Non-template studies of the current project the viewer can read.
     *
     * - `openTotal`, `closingSoon` (end within CLOSING_SOON_MS): the studies tile.
     * - `upcoming`, `withoutDeadline`: the Upcoming deadlines panel (open, end not passed, soonest first).
     * - `createdDates`, `closedDates`: activity graph; closed by hand → `closed`, ended by its
     *   deadline → `end` (studyState in studyCardHelpers.js).
     *
     * @param {Object|null} scope
     * @param {Date} now
     * @param {Date} since
     * @returns {Promise<Object>}
     */
    async homeStudies(scope, now, since) {
        const empty = {
            openTotal: 0, closingSoon: 0, withoutDeadline: 0, upcoming: [], createdDates: [], closedDates: [],
        };
        if (!scope) {
            return empty;
        }
        const Study = this.models["study"];
        const model = uncached(Study);
        const openWhere = {[Op.and]: [scope, Study.openFilter(now)]};
        const and = (...parts) => ({[Op.and]: [openWhere, ...parts]});
        const soon = new Date(now.getTime() + CLOSING_SOON_MS);

        const [openTotal, closingSoon, withoutDeadline, upcoming, createdDates, closedRows] = await Promise.all([
            model.count({where: openWhere}),
            model.count({where: and({end: {[Op.between]: [now, soon]}})}),
            model.count({where: and({end: null})}),
            model.findAll({
                where: and({end: {[Op.gte]: now}}),
                attributes: ["id", "name", "end", "hash"],
                order: [["end", "ASC"], ["id", "ASC"]],
                limit: DEADLINES_LIMIT,
                raw: true,
            }),
            this.homeCreatedDates(Study, scope, since),
            model.findAll({
                where: {
                    [Op.and]: [scope, {
                        [Op.or]: [
                            {closed: {[Op.gte]: since}},
                            {
                                closed: null,
                                multipleSubmit: {[Op.not]: true},
                                end: {[Op.gte]: since, [Op.lt]: now},
                            },
                        ],
                    }],
                },
                attributes: ["closed", "end"],
                raw: true,
            }),
        ]);
        return {
            openTotal,
            closingSoon,
            withoutDeadline,
            upcoming,
            createdDates,
            closedDates: closedRows
                .map((row) => toMs(row.closed != null ? row.closed : row.end))
                .filter((time) => time !== null),
        };
    }

    /**
     * Open studies for the guest page, soonest end first, studies without an end last.
     * @param {Object|null} scope
     * @param {Date} now
     * @returns {Promise<{open: Object[]}>}
     */
    async homeGuestStudies(scope, now) {
        if (!scope) {
            return {open: []};
        }
        const Study = this.models["study"];
        const open = await uncached(Study).findAll({
            where: {[Op.and]: [scope, Study.openFilter(now)]},
            attributes: ["id", "name", "end", "hash"],
            order: [["end", "ASC NULLS LAST"], ["id", "ASC"]],
            limit: GUEST_STUDIES_LIMIT,
            raw: true,
        });
        return {open};
    }

    /**
     * When the study numbers change only because time passes: the next study end (it leaves the
     * open / upcoming lists or turns "ended") or the next end entering the closing-soon window.
     * The client refetches once this moment has passed.
     * @param {Object|null} scope
     * @param {Date} now
     * @returns {Promise<number|null>} epoch ms
     */
    async homeStudiesNextChange(scope, now) {
        if (!scope) {
            return null;
        }
        const model = uncached(this.models["study"]);
        const nextEnd = async (after) => {
            const rows = await model.findAll({
                where: {[Op.and]: [scope, {closed: null}, {end: {[Op.gt]: after}}]},
                attributes: [[fn("MIN", col("end")), "value"]],
                raw: true,
            });
            return toMs(rows[0]?.value);
        };
        const [end, soonEnd] = await Promise.all([
            nextEnd(now),
            nextEnd(new Date(now.getTime() + CLOSING_SOON_MS)),
        ]);
        const candidates = [end, soonEnd === null ? null : soonEnd - CLOSING_SOON_MS]
            .filter((time) => time !== null);
        return candidates.length ? Math.min(...candidates) : null;
    }

    /**
     * Assignments the submissions tile counts (Assignment.listedFilter) and the uploads to them.
     * @param {Date} since
     * @returns {Promise<{assignmentsTotal: number, createdDates: number[], submittedDates: number[]}>}
     */
    async homeSubmissions(since) {
        const empty = {assignmentsTotal: 0, createdDates: [], submittedDates: []};
        const Assignment = this.models["assignment"];
        const where = await this.homeReadWhere("assignment", Assignment.listedFilter(this.userId));
        if (!where) {
            return empty;
        }
        const [listed, createdDates] = await Promise.all([
            uncached(Assignment).findAll({where, attributes: ["id"], raw: true}),
            this.homeCreatedDates(Assignment, where, since),
        ]);
        const assignmentIds = listed.map((row) => row.id);
        let submittedDates = [];
        if (assignmentIds.length > 0) {
            const submissionWhere = await this.homeReadWhere("submission", {assignmentId: {[Op.in]: assignmentIds}});
            if (submissionWhere) {
                submittedDates = await this.homeCreatedDates(this.models["submission"], submissionWhere, since);
            }
        }
        return {assignmentsTotal: assignmentIds.length, createdDates, submittedDates};
    }

    /**
     * The seeded showcase document (fixed hash), or a document with the same name if an
     * installation re-uploaded it, among the documents the viewer may read.
     * @returns {Promise<Object|null>}
     */
    async homeShowcaseDocument() {
        const model = uncached(this.models["document"]);
        const find = async (match) => {
            const where = await this.homeReadWhere("document", {parentDocumentId: null, ...match});
            if (!where) {
                return null;
            }
            const rows = await model.findAll({
                where,
                attributes: ["id", "name", "hash", "type"],
                order: [["id", "ASC"]],
                limit: 1,
                raw: true,
            });
            return rows[0] || null;
        };
        return await find({hash: SHOWCASE_DOCUMENT_HASH}) || await find({name: SHOWCASE_DOCUMENT_NAME});
    }

    init() {
        this.createSocket("homeSummaryGet", this.getHomeSummary, {}, false);
    }
}

module.exports = HomeSocket;
