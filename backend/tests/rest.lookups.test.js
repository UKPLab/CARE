const request = require('supertest');
const Server = require('../webserver/Server.js');
const {addResearcherUser, enableRestForTests, allTokenRights} = require('./utils.js');

const PORT = 3125;
const SETTING = 'system.auth.apiTokens.enabled';
const DOCUMENTS_VIEW = 'frontend.dashboard.documents.view';
const STUDIES_VIEW = 'frontend.dashboard.studies.view';

describe('REST lookups', () => {
    let server;
    let models;
    let cookie;
    let adminId;
    let full;
    let narrow;
    let other;
    let rows = {};

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

        const mint = async (body) => {
            const withRights = body.rights ? body : {...body, rights: await allTokenRights(server, cookie)};
            const res = await request(server.http).post('/auth/api-tokens').set('Cookie', cookie).send(withRights);
            expect(res.statusCode).toBe(201);
            return res.body;
        };
        full = await mint({name: 'lookup full'});
        narrow = await mint({name: 'lookup narrow', rights: [DOCUMENTS_VIEW, STUDIES_VIEW]});

        other = (await addResearcherUser(models)).user;
        rows.ownProject = await models['project'].add({name: 'lookup own project', userId: adminId, public: false});
        rows.otherPrivateProject = await models['project'].add({name: 'lookup other private', userId: other.id, public: false});
        rows.otherPublicProject = await models['project'].add({name: 'lookup other public', userId: other.id, public: true});
        rows.workflow = await models['workflow'].add({name: 'lookup workflow', description: 'for lookups'});
        rows.step = await models['workflow_step'].add({
            name: 'lookup step',
            workflowId: rows.workflow.id,
            stepType: 1,
            workflowStepPrevious: null,
            allowBackward: false,
            configuration: {},
        });
        rows.ownTagSet = await models['tag_set'].add({name: 'lookup own tags', userId: adminId, public: false});
        rows.tag = await models['tag'].add({name: 'lookup tag', colorCode: 'info', userId: adminId, tagSetId: rows.ownTagSet.id, public: false});
        rows.otherTagSet = await models['tag_set'].add({name: 'lookup other tags', userId: other.id, public: false});
        rows.ownTemplate = await models['study'].add({
            name: 'lookup own template', workflowId: rows.workflow.id, userId: adminId, template: true,
        }, {context: {stepDocuments: []}});
        rows.otherTemplate = await models['study'].add({
            name: 'lookup other template', workflowId: rows.workflow.id, userId: other.id, template: true,
        }, {context: {stepDocuments: []}});
    });

    afterAll(async () => {
        for (const [model, keys] of [
            ['study', ['ownTemplate', 'otherTemplate']],
            ['tag', ['tag']],
            ['tag_set', ['ownTagSet', 'otherTagSet']],
            ['workflow_step', ['step']],
            ['workflow', ['workflow']],
            ['project', ['ownProject', 'otherPrivateProject', 'otherPublicProject']],
        ]) {
            for (const key of keys) {
                if (rows[key]) {
                    await models[model].deleteById(rows[key].id);
                }
            }
        }
        await models['user'].deleteById(other.id);
        for (const token of [full, narrow]) {
            await request(server.http).delete('/auth/api-tokens/' + token.token.id).set('Cookie', cookie);
        }
        server.stop();
    });

    function get(path, token = narrow) {
        return request(server.http).get(path).set('Authorization', 'Bearer ' + token.secret);
    }

    test('REST calls create no login session row and set no session cookie', async () => {
        const countSessions = async () => Number((await server.db.sequelize.query(
            'SELECT COUNT(*) AS n FROM "Sessions"', {type: server.db.sequelize.QueryTypes.SELECT}))[0].n);
        const before = await countSessions();
        for (let i = 0; i < 3; i++) {
            const res = await get('/rest/v1/me');
            expect(res.statusCode).toBe(200);
            expect(res.headers['set-cookie']).toBeUndefined();
        }
        expect(await countSessions()).toBe(before);
    });

    test('an unknown REST path answers JSON 404 and creates no session row', async () => {
        const countSessions = async () => Number((await server.db.sequelize.query(
            'SELECT COUNT(*) AS n FROM "Sessions"', {type: server.db.sequelize.QueryTypes.SELECT}))[0].n);
        const before = await countSessions();
        const res = await get('/rest/v1/document/7');
        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe('errors.rest.routeNotFound');
        const wrongMethod = await request(server.http).put('/rest/v1/studies/7').set('Authorization', 'Bearer ' + narrow.secret);
        expect(wrongMethod.statusCode).toBe(404);
        expect(await countSessions()).toBe(before);
    });

    test('GET /me describes the token, its owner, and only the rights on the token', async () => {
        const res = await get('/rest/v1/me');
        expect(res.statusCode).toBe(200);
        expect(res.body.token.name).toBe('lookup narrow');
        expect(res.body.token.keyHash).toBeUndefined();
        expect(res.body.user.id).toBe(adminId);
        expect(res.body.user.roles).toContain('admin');
        expect(res.body.rights).toEqual([DOCUMENTS_VIEW, STUDIES_VIEW].sort());

        const wide = await get('/rest/v1/me', full);
        expect(wide.body.rights.length).toBeGreaterThan(2);
    });

    test('GET /me without a token is 401', async () => {
        const res = await request(server.http).get('/rest/v1/me');
        expect(res.statusCode).toBe(401);
    });

    test('GET /projects returns own and public projects, not another user private one', async () => {
        const res = await get('/rest/v1/projects');
        expect(res.statusCode).toBe(200);
        const ids = res.body.projects.map((project) => project.id);
        expect(ids).toContain(rows.ownProject.id);
        expect(ids).toContain(rows.otherPublicProject.id);
        expect(ids).not.toContain(rows.otherPrivateProject.id);
    });

    test('GET /workflows returns workflows with their steps', async () => {
        const res = await get('/rest/v1/workflows');
        expect(res.statusCode).toBe(200);
        const workflow = res.body.workflows.find((item) => item.id === rows.workflow.id);
        expect(workflow.steps.map((step) => step.id)).toEqual([rows.step.id]);
    });

    test('GET /tag-sets returns own tag sets with tags, not another user private one', async () => {
        const res = await get('/rest/v1/tag-sets');
        expect(res.statusCode).toBe(200);
        const own = res.body.tagSets.find((tagSet) => tagSet.id === rows.ownTagSet.id);
        expect(own.tags.map((tag) => tag.id)).toEqual([rows.tag.id]);
        expect(res.body.tagSets.some((tagSet) => tagSet.id === rows.otherTagSet.id)).toBe(false);
    });

    test('GET /study-templates lists own templates; other users need studies.fullAccess on the token', async () => {
        const res = await get('/rest/v1/study-templates');
        expect(res.statusCode).toBe(200);
        const ids = res.body.templates.map((template) => template.id);
        expect(ids).toContain(rows.ownTemplate.id);
        expect(ids).not.toContain(rows.otherTemplate.id);

        const wide = await get('/rest/v1/study-templates', full);
        expect(wide.body.templates.map((template) => template.id)).toContain(rows.otherTemplate.id);
    });

    test('GET /roles returns role ids and names', async () => {
        const res = await get('/rest/v1/roles');
        expect(res.statusCode).toBe(200);
        expect(res.body.roles.map((role) => role.name)).toContain('admin');
        expect(Object.keys(res.body.roles[0]).sort()).toEqual(['id', 'name']);
    });

    test('lookups need the matching view right on the token', async () => {
        const created = await request(server.http)
            .post('/auth/api-tokens')
            .set('Cookie', cookie)
            .send({name: 'lookup none', rights: ['frontend.dashboard.api_tokens.view']});
        try {
            for (const path of ['/rest/v1/projects', '/rest/v1/workflows', '/rest/v1/tag-sets', '/rest/v1/study-templates']) {
                const res = await get(path, created.body);
                expect({path, status: res.statusCode}).toEqual({path, status: 403});
            }
            const me = await get('/rest/v1/me', created.body);
            expect(me.statusCode).toBe(200);
        } finally {
            await request(server.http).delete('/auth/api-tokens/' + created.body.token.id).set('Cookie', cookie);
        }
    });
});
