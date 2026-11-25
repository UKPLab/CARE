const request = require('supertest');
const Server = require('../webserver/Server.js');
const {addResearcherUser, enableRestForTests, allTokenRights} = require('./utils.js');

const PORT = 3126;
const SETTING = 'system.auth.apiTokens.enabled';

describe('REST study sessions', () => {
    let server;
    let models;
    let cookie;
    let adminId;
    let full;
    let other;
    let workflow;
    let step;
    let study;

    beforeAll(async () => {
        server = new Server();
        server.start(PORT);
        await server.devAdminReady;
        models = server.db.models;
        await enableRestForTests(server.db.models);

        const login = await request(server.http)
            .post('/auth/login')
            .send({username: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PWD});
        expect(login.statusCode).toBe(200);
        cookie = login.headers['set-cookie'];
        adminId = login.body.user.id;
        const created = await request(server.http).post('/auth/api-tokens').set('Cookie', cookie).send({name: 'session tests', rights: await allTokenRights(server, cookie)});
        expect(created.statusCode).toBe(201);
        full = created.body;

        other = (await addResearcherUser(models)).user;
        workflow = await models['workflow'].add({name: 'REST session workflow', description: 'for sessions'});
        step = await models['workflow_step'].add({
            name: 'only step',
            workflowId: workflow.id,
            stepType: 1,
            workflowStepPrevious: null,
            allowBackward: false,
            configuration: {},
        });
        study = await models['study'].add({
            name: 'REST session study',
            workflowId: workflow.id,
            userId: adminId,
            template: false,
            multipleSubmit: true,
            enableEmailNotifications: false,
        }, {context: {stepDocuments: []}});
    });

    afterAll(async () => {
        const sessions = await models['study_session'].getAllByKey('studyId', study.id);
        for (const session of sessions) {
            await models['study_session'].deleteById(session.id);
        }
        await models['study'].deleteById(study.id);
        await models['workflow_step'].deleteById(step.id);
        await models['workflow'].deleteById(workflow.id);
        await models['user'].deleteById(other.id);
        await request(server.http).delete('/auth/api-tokens/' + full.token.id).set('Cookie', cookie);
        server.stop();
    });

    function call(method, path, body, token = full) {
        const req = request(server.http)[method](path).set('Authorization', 'Bearer ' + token.secret);
        return body === undefined ? req : req.send(body);
    }

    test('start a new session, list it, start it again by hash, then finish it once', async () => {
        const started = await call('post', `/rest/v1/studies/${study.id}/sessions`);
        expect(started.statusCode).toBe(201);
        const session = started.body.session;
        expect(session.userId).toBe(adminId);
        expect(session.studyId).toBe(study.id);
        expect(session.start).toBeTruthy();

        const inStudy = await call('get', `/rest/v1/studies/${study.hash}/sessions`);
        expect(inStudy.statusCode).toBe(200);
        expect(inStudy.body.sessions.map((row) => row.id)).toContain(session.id);
        const mine = await call('get', '/rest/v1/sessions');
        expect(mine.body.sessions.map((row) => row.id)).toContain(session.id);

        const restarted = await call('post', `/rest/v1/sessions/${session.hash}/start`);
        expect(restarted.statusCode).toBe(200);

        const finished = await call('post', `/rest/v1/sessions/${session.id}/finish`);
        expect(finished.statusCode).toBe(200);
        expect(finished.body.session.end).toBeTruthy();
        const again = await call('post', `/rest/v1/sessions/${session.id}/finish`);
        expect(again.statusCode).toBe(400);
        expect(again.body.message).toBe('errors.studies.studySession.alreadyFinished');
    });

    test('GET one session by id or hash: own, or of a study the caller may see', async () => {
        const session = (await call('post', `/rest/v1/studies/${study.id}/sessions`)).body.session;
        const byId = await call('get', `/rest/v1/sessions/${session.id}`);
        expect(byId.statusCode).toBe(200);
        expect(byId.body.session.id).toBe(session.id);
        const byHash = await call('get', `/rest/v1/sessions/${session.hash}`);
        expect(byHash.body.session.id).toBe(session.id);
        expect((await call('get', '/rest/v1/sessions/99999999')).statusCode).toBe(404);

        // A narrow token of the study owner without studies.fullAccess still sees sessions of their own study.
        const theirs = await models['study_session'].add({studyId: study.id, userId: other.id});
        const narrow = (await request(server.http).post('/auth/api-tokens').set('Cookie', cookie)
            .send({name: 'session get narrow', rights: ['frontend.dashboard.my_sessions.view']})).body;
        try {
            const res = await call('get', `/rest/v1/sessions/${theirs.id}`, undefined, narrow);
            expect(res.statusCode).toBe(200);
        } finally {
            await request(server.http).delete('/auth/api-tokens/' + narrow.token.id).set('Cookie', cookie);
        }
    });

    test('another user session is listed for the study owner but cannot be started or finished', async () => {
        const theirs = await models['study_session'].add({studyId: study.id, userId: other.id});
        const listed = await call('get', `/rest/v1/studies/${study.id}/sessions`);
        expect(listed.body.sessions.map((row) => row.id)).toContain(theirs.id);
        for (const action of ['start', 'finish']) {
            const res = await call('post', `/rest/v1/sessions/${theirs.id}/${action}`);
            expect({action, status: res.statusCode, message: res.body.message})
                .toEqual({action, status: 403, message: 'errors.rest.sessionNoAccess'});
        }
    });

    test('copy gives another user a copy of a session', async () => {
        const source = (await call('post', `/rest/v1/studies/${study.id}/sessions`)).body.session;
        const res = await call('post', `/rest/v1/sessions/${source.id}/copy`, {userIds: [other.id]});
        expect(res.statusCode).toBe(201);
        expect(res.body.sessions.map((row) => row.userId)).toEqual([other.id]);
        expect(res.body.sessions[0].id).not.toBe(source.id);
    });

    test('copy validates its body and its targets', async () => {
        const source = (await call('post', `/rest/v1/studies/${study.id}/sessions`)).body.session;
        const bad = await call('post', `/rest/v1/sessions/${source.id}/copy`, {userIds: 'all'});
        expect(bad.statusCode).toBe(400);
        expect(bad.body.message).toBe('errors.rest.sessionUserIdsRequired');
        const unknownUser = await call('post', `/rest/v1/sessions/${source.id}/copy`, {userIds: [99999999]});
        expect(unknownUser.statusCode).toBe(404);
        expect(unknownUser.body.message).toBe('errors.rest.reviewerNotFound');
    });

    test('assessment returns the scores saved for each visible session', async () => {
        const graded = await models['study'].add({
            name: 'REST assessment study',
            workflowId: workflow.id,
            userId: adminId,
            template: false,
            enableEmailNotifications: false,
        }, {context: {stepDocuments: [{id: step.id, documentId: null, configuration: {configurationId: 4242}}]}});
        try {
            const session = (await call('post', `/rest/v1/studies/${graded.id}/sessions`)).body.session;
            const studyStep = (await models['study_step'].getAllByKey('studyId', graded.id))[0];
            const saved = await models['document_data'].add({
                userId: adminId,
                studySessionId: session.id,
                studyStepId: studyStep.id,
                key: 'assessment_result',
                value: [{name: 'clarity', score: 4}],
            });
            const res = await call('get', `/rest/v1/studies/${graded.id}/assessment?configurationId=4242`);
            expect(res.statusCode).toBe(200);
            expect(res.body.studyStepId).toBe(studyStep.id);
            expect(res.body.sessions).toHaveLength(1);
            expect(res.body.sessions[0].id).toBe(session.id);
            expect(res.body.sessions[0].scores).toEqual({clarity: 4});

            const other = await call('get', `/rest/v1/studies/${graded.id}/assessment?configurationId=1`);
            expect(other.statusCode).toBe(200);
            expect(other.body.studyStepId).toBeNull();
            expect(other.body.sessions[0].scores).toEqual({});

            const missing = await call('get', `/rest/v1/studies/${graded.id}/assessment`);
            expect(missing.statusCode).toBe(400);
            expect(missing.body.message).toBe('errors.rest.configurationIdRequired');
            await models['document_data'].deleteById(saved.id);
            await models['study_session'].deleteById(session.id);
        } finally {
            await models['study'].deleteById(graded.id);
        }
    });

    test('a token with only the manager overview right can read sessions but not start one', async () => {
        const overview = (await request(server.http).post('/auth/api-tokens').set('Cookie', cookie)
            .send({name: 'overview only', rights: ['frontend.dashboard.session_overview.view']})).body;
        try {
            const session = (await call('post', `/rest/v1/studies/${study.id}/sessions`)).body.session;
            expect((await call('get', `/rest/v1/sessions/${session.id}`, undefined, overview)).statusCode).toBe(200);
            expect((await call('get', `/rest/v1/studies/${study.id}/sessions`, undefined, overview)).statusCode).toBe(200);
            expect((await call('get', '/rest/v1/sessions', undefined, overview)).statusCode).toBe(200);
            const start = await call('post', `/rest/v1/studies/${study.id}/sessions`, undefined, overview);
            expect(start.statusCode).toBe(403);
            expect(start.body.message).toBe('errors.rest.missingTokenRight');
        } finally {
            await request(server.http).delete('/auth/api-tokens/' + overview.token.id).set('Cookie', cookie);
        }
    });

    test('the study creator can delete a session of their study', async () => {
        const theirs = await models['study_session'].add({studyId: study.id, userId: other.id});
        const res = await call('delete', `/rest/v1/sessions/${theirs.id}`);
        expect(res.statusCode).toBe(200);
        expect((await call('get', `/rest/v1/sessions/${theirs.id}`)).statusCode).toBe(404);
        expect((await call('delete', '/rest/v1/sessions/99999999')).statusCode).toBe(404);
    });

    test('a new session is refused in a closed study and past the session limits', async () => {
        const limited = await models['study'].add({
            name: 'REST limited study',
            workflowId: workflow.id,
            userId: adminId,
            template: false,
            limitSessionsPerUser: 1,
            enableEmailNotifications: false,
        }, {context: {stepDocuments: []}});
        try {
            expect((await call('post', `/rest/v1/studies/${limited.id}/sessions`)).statusCode).toBe(201);
            const second = await call('post', `/rest/v1/studies/${limited.id}/sessions`);
            expect(second.statusCode).toBe(400);
            expect(second.body.message).toBe('errors.studies.sessionLimitPerUserExceeded');

            // Closed with an end date still in the future: the model's own check would let this through.
            await models['study'].updateById(limited.id, {limitSessionsPerUser: null, closed: true, end: new Date(Date.now() + 86400000)});
            const closed = await call('post', `/rest/v1/studies/${limited.id}/sessions`);
            expect(closed.statusCode).toBe(400);
            expect(closed.body.message).toBe('errors.studies.studyClosed');
        } finally {
            for (const session of await models['study_session'].getAllByKey('studyId', limited.id)) {
                await models['study_session'].deleteById(session.id);
            }
            await models['study'].deleteById(limited.id);
        }
    });

    test('unknown study and session are 404', async () => {
        expect((await call('get', '/rest/v1/studies/99999999/sessions')).statusCode).toBe(404);
        expect((await call('post', '/rest/v1/studies/99999999/sessions')).statusCode).toBe(404);
        expect((await call('post', '/rest/v1/sessions/99999999/finish')).statusCode).toBe(404);
        expect((await call('post', '/rest/v1/sessions/99999999/copy', {userIds: [other.id]})).statusCode).toBe(404);
    });

    test('a token without the sessions right is 403, and copy needs the manage right', async () => {
        const mint = async (rights) => (await request(server.http)
            .post('/auth/api-tokens').set('Cookie', cookie).send({name: 'sessions scoped', rights})).body;
        const none = await mint(['frontend.dashboard.api_tokens.view']);
        const viewOnly = await mint(['frontend.dashboard.my_sessions.view']);
        try {
            const denied = await call('get', '/rest/v1/sessions', undefined, none);
            expect(denied.statusCode).toBe(403);
            expect(denied.body.message).toBe('errors.rest.missingTokenRight');
            const source = (await call('post', `/rest/v1/studies/${study.id}/sessions`, undefined, viewOnly)).body.session;
            const copy = await call('post', `/rest/v1/sessions/${source.id}/copy`, {userIds: [other.id]}, viewOnly);
            expect(copy.statusCode).toBe(403);
            expect(copy.body.message).toBe('errors.rest.missingTokenRight');
        } finally {
            for (const token of [none, viewOnly]) {
                await request(server.http).delete('/auth/api-tokens/' + token.token.id).set('Cookie', cookie);
            }
        }
    });
});
