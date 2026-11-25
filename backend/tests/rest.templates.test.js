const request = require('supertest');
const Server = require('../webserver/Server.js');
const {enableRestForTests, allTokenRights} = require('./utils.js');

const PORT = 3128;
const SETTING = 'system.auth.apiTokens.enabled';

describe('REST templates', () => {
    let server;
    let models;
    let cookie;
    let adminId;
    let full;
    const createdIds = [];

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
        const created = await request(server.http).post('/auth/api-tokens').set('Cookie', cookie).send({name: 'template tests', rights: await allTokenRights(server, cookie)});
        expect(created.statusCode).toBe(201);
        full = created.body;
    });

    afterAll(async () => {
        for (const id of createdIds) {
            await models['template'].deleteById(id).catch(() => {});
        }
        await request(server.http).delete('/auth/api-tokens/' + full.token.id).set('Cookie', cookie);
        server.stop();
    });

    function call(method, path, body, token = full) {
        const req = request(server.http)[method](path).set('Authorization', 'Bearer ' + token.secret);
        return body === undefined ? req : req.send(body);
    }

    const promptTemplate = (extra = {}) => ({
        name: 'REST prompt template',
        description: 'imported over REST',
        type: 8,
        defaultLanguage: 'en',
        template_content: [{language: 'en', content: {ops: [{insert: 'Summarise the text.\n'}]}}],
        ...extra,
    });

    test('import creates a private template owned by the token owner, then list and export return it', async () => {
        const imported = await call('post', '/rest/v1/templates/import', promptTemplate({public: true, userId: 999999, sourceId: 5}));
        expect(imported.statusCode).toBe(201);
        const template = imported.body.templates[0];
        createdIds.push(template.id);
        expect(template.userId).toBe(adminId);
        expect(template.public).toBe(false);
        expect(template.type).toBe(8);

        const listed = await call('get', '/rest/v1/templates');
        expect(listed.statusCode).toBe(200);
        expect(listed.body.templates.map((row) => row.id)).toContain(template.id);

        const exported = await call('get', '/rest/v1/templates/export?id=' + template.id);
        expect(exported.statusCode).toBe(200);
        expect(exported.body.templates).toHaveLength(1);
        expect(exported.body.templates[0].name).toBe('REST prompt template');
        expect(exported.body.templates[0].template_content[0].language).toBe('en');
        expect(exported.body.templates[0].template_content[0].content.ops[0].insert).toBe('Summarise the text.\n');
    });

    test('what export returns can be sent to import unchanged', async () => {
        const source = await call('post', '/rest/v1/templates/import', promptTemplate({name: 'REST round trip'}));
        createdIds.push(source.body.templates[0].id);
        const exported = await call('get', '/rest/v1/templates/export?id=' + source.body.templates[0].id);
        const imported = await call('post', '/rest/v1/templates/import', exported.body);
        expect(imported.statusCode).toBe(201);
        expect(imported.body.templates[0].name).toBe('REST round trip');
        createdIds.push(imported.body.templates[0].id);
    });

    test('import accepts an array and creates nothing when one item is invalid', async () => {
        const before = (await call('get', '/rest/v1/templates')).body.templates.length;
        const res = await call('post', '/rest/v1/templates/import', [
            promptTemplate({name: 'REST batch ok'}),
            promptTemplate({name: 'REST batch bad', template_content: [{language: '', content: {ops: []}}]}),
        ]);
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('errors.templates.languageRequired');
        expect((await call('get', '/rest/v1/templates')).body.templates.length).toBe(before);
    });

    test('email templates cannot be created over REST, even with an admin owner and every right', async () => {
        const res = await call('post', '/rest/v1/templates/import', promptTemplate({type: 1}));
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('errors.templates.adminOnlyEmailTemplateCreate');
    });

    test('bad import bodies and unknown export ids are rejected', async () => {
        for (const body of [[], [1], 'text']) {
            const res = await call('post', '/rest/v1/templates/import', body);
            expect({body, status: res.statusCode}).toEqual({body, status: 400});
        }
        const missingFields = await call('post', '/rest/v1/templates/import', {name: 'no type'});
        expect(missingFields.statusCode).toBe(400);
        expect((await call('get', '/rest/v1/templates/export?id=99999999')).statusCode).toBe(404);
        expect((await call('get', '/rest/v1/templates/export?id=abc')).statusCode).toBe(400);
    });

    test('a token without templates.view is 403', async () => {
        const scoped = (await request(server.http)
            .post('/auth/api-tokens').set('Cookie', cookie)
            .send({name: 'no templates', rights: ['frontend.dashboard.api_tokens.view']})).body;
        try {
            for (const [method, path] of [['get', '/rest/v1/templates'], ['get', '/rest/v1/templates/export'], ['post', '/rest/v1/templates/import']]) {
                const res = await call(method, path, method === 'post' ? promptTemplate() : undefined, scoped);
                expect({path, status: res.statusCode}).toEqual({path, status: 403});
            }
        } finally {
            await request(server.http).delete('/auth/api-tokens/' + scoped.token.id).set('Cookie', cookie);
        }
    });
});
