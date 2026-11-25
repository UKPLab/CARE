'use strict';

const TranslatableError = require('../../../utils/TranslatableError');
const {requireTokenRight, requireAnyTokenRight} = require('../../middleware/bearerAuth');
const {loadByIdOrHash} = require('../../utils/restHelpers');
const {heavyRateLimit} = require('../../middleware/restRateLimit');
const {runWrite, runRead} = require('./routeHelpers');
const {studyAssessmentScores} = require('../../rest/assessments');
const {listStudySessions, getStudySession, startStudySession, finishStudySession, copyStudySession, deleteStudySession} = require('../../rest/sessions');
const {loadStudyByIdOrHash} = require('../../rest/studies');

// "My sessions" is the participant's own view. "Session overview" is the manager's view of a study.

const SESSIONS_VIEW = 'frontend.dashboard.my_sessions.view';
const SESSIONS_OVERVIEW = 'frontend.dashboard.session_overview.view';
const STUDIES_MANAGE = 'frontend.dashboard.studies.canManageStudies';

const NOT_FOUND = new Set(['errors.rest.sessionNotFound', 'errors.rest.studyNotFound', 'errors.rest.reviewerNotFound',
    'errors.studies.studyNotFound']);
const FORBIDDEN = new Set(['errors.rest.sessionNoAccess', 'errors.rest.studyNoAccess']);

const SESSION_ERRORS = {notFound: NOT_FOUND, forbidden: FORBIDDEN};

/**
 * REST study sessions: list, start, finish, and copy to other users.
 *
 * @param {Server} server main server instance
 */
function registerRestSessionRoutes(server) {
    const models = server.db.models;
    // Reads accept either right; what a caller sees still depends on ownership. Start and finish
    // act on the caller's own sessions, so they need the participant right.
    const needRead = requireAnyTokenRight(server, [SESSIONS_VIEW, SESSIONS_OVERVIEW]);
    const needView = requireTokenRight(server, SESSIONS_VIEW);
    const needManage = requireTokenRight(server, STUDIES_MANAGE);

    const read = (req, res, label, work) => runRead(server, req, res, {label, errors: SESSION_ERRORS}, work);
    const write = (req, res, status, label, work) => runWrite(server, req, res, {status, label, errors: SESSION_ERRORS}, work);

    /**
     * Load a study session by id or hash.
     *
     * @param {number|string} idOrHash the session id or hash from the path
     * @returns {Promise<Object>} the session
     * @throws {TranslatableError} errors.rest.sessionNotFound
     */
    async function sessionOrThrow(idOrHash) {
        const session = await loadByIdOrHash(models['study_session'], idOrHash);
        if (!session) {
            throw new TranslatableError('errors.rest.sessionNotFound');
        }
        return session;
    }

    /**
     * Load a study by id or hash.
     *
     * @param {number|string} idOrHash the study id or hash from the path
     * @returns {Promise<Object>} the study
     * @throws {TranslatableError} errors.rest.studyNotFound
     */
    async function studyOrThrow(idOrHash) {
        const study = await loadStudyByIdOrHash(models, idOrHash);
        if (!study) {
            throw new TranslatableError('errors.rest.studyNotFound');
        }
        return study;
    }

    server.app.get('/rest/v1/sessions', needRead, (req, res) => read(req, res, 'list sessions', async (options) =>
        ({sessions: await listStudySessions({userId: req.apiUserId}, options)})));

    server.app.get('/rest/v1/sessions/:idOrHash', needRead, (req, res) => runRead(server, req, res, {
        label: 'get session',
        notFound: 'errors.rest.sessionNotFound',
        errors: SESSION_ERRORS,
    }, async (options) => {
        const session = await getStudySession(
            {userId: req.apiUserId, session: await loadByIdOrHash(models['study_session'], req.params.idOrHash)},
            options
        );
        return session ? {session} : null;
    }));

    server.app.get('/rest/v1/studies/:idOrHash/sessions', needRead, (req, res) => read(req, res, 'list study sessions', async (options) => {
        const study = await studyOrThrow(req.params.idOrHash);
        return {sessions: await listStudySessions({userId: req.apiUserId, study}, options)};
    }));

    // Scores for the sessions the caller may see. Same visibility as the session list above.
    server.app.get('/rest/v1/studies/:idOrHash/assessment', needRead, (req, res) => read(req, res, 'study assessment', async (options) => {
        const configurationId = /^\d+$/.test(String(req.query.configurationId)) ? Number(req.query.configurationId) : 0;
        if (configurationId < 1) {
            throw new TranslatableError('errors.rest.configurationIdRequired');
        }
        const study = await studyOrThrow(req.params.idOrHash);
        const sessions = await listStudySessions({userId: req.apiUserId, study}, options);
        return studyAssessmentScores({study, sessions, configurationId}, options);
    }));

    server.app.post('/rest/v1/studies/:idOrHash/sessions', needView, (req, res) =>
        write(req, res, 201, 'start new session', async (options) => {
            const study = await studyOrThrow(req.params.idOrHash);
            return {session: await startStudySession({userId: req.apiUserId, study}, options)};
        }));

    server.app.post('/rest/v1/sessions/:idOrHash/start', needView, (req, res) =>
        write(req, res, 200, 'start session', async (options) => {
            const session = await sessionOrThrow(req.params.idOrHash);
            return {session: await startStudySession({userId: req.apiUserId, sessionId: session.id}, options)};
        }));

    server.app.post('/rest/v1/sessions/:idOrHash/finish', needView, (req, res) =>
        write(req, res, 200, 'finish session', async (options) => {
            const session = await sessionOrThrow(req.params.idOrHash);
            return {session: await finishStudySession({userId: req.apiUserId, sessionId: session.id}, options)};
        }));

    server.app.delete('/rest/v1/sessions/:idOrHash', needManage, (req, res) =>
        write(req, res, 200, 'delete session', async (options) => {
            const session = await sessionOrThrow(req.params.idOrHash);
            await deleteStudySession({userId: req.apiUserId, session}, options);
            return {success: true};
        }));

    server.app.post('/rest/v1/sessions/:idOrHash/copy', needManage, heavyRateLimit(server), (req, res) => {
        const userIds = req.body?.userIds;
        if (!Array.isArray(userIds) || userIds.length === 0 || userIds.some((id) => !Number.isInteger(id))) {
            return res.status(400).json({message: 'errors.rest.sessionUserIdsRequired'});
        }
        return write(req, res, 201, 'copy session', async (options) => {
            const session = await sessionOrThrow(req.params.idOrHash);
            return {sessions: await copyStudySession({userId: req.apiUserId, sessionId: session.id, userIds}, options)};
        });
    });
}

module.exports = {registerRestSessionRoutes};
