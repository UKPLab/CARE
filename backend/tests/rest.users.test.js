const request = require('supertest');
const Server = require('../webserver/Server.js');
const {addResearcherUser, enableRestForTests, allTokenRights} = require('./utils.js');

const PORT = 3124;
const SETTING = 'system.auth.apiTokens.enabled';

describe('REST users lookup', () => {
    let server;
    let models;
    let cookie;
    let secret;
    let tokenId;
    let alice;

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

        const created = await request(server.http)
            .post('/auth/api-tokens')
            .set('Cookie', cookie)
            .send({name: 'user lookup tests', rights: await allTokenRights(server, cookie)});
        expect(created.statusCode).toBe(201);
        secret = created.body.secret;
        tokenId = created.body.token.id;

        alice = (await addResearcherUser(models)).user;
    });

    afterAll(async () => {
        await models['user'].deleteById(alice.id);
        await request(server.http).delete('/auth/api-tokens/' + tokenId).set('Cookie', cookie);
        server.stop();
    });

    function lookup(query, bearer = secret) {
        return request(server.http)
            .get('/rest/v1/users')
            .query(query)
            .set('Authorization', 'Bearer ' + bearer);
    }

    test('a request without email or extId is 400, so there is no list-all', async () => {
        const res = await lookup({});
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('errors.rest.userLookupRequired');
    });

    test('a non-numeric extId is 400', async () => {
        const res = await lookup({extId: 'abc'});
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('errors.rest.invalidUserLookup');
    });

    test('more than 100 keys is 400', async () => {
        const emails = Array.from({length: 101}, (_, index) => `nobody${index}@example.test`).join(',');
        const res = await lookup({email: emails});
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('errors.rest.userLookupTooMany');
    });

    test('finds a user by email and returns only id, name, roles, and the email asked for', async () => {
        const res = await lookup({email: alice.email});
        expect(res.statusCode).toBe(200);
        expect(res.body.users).toHaveLength(1);
        const user = res.body.users[0];
        expect(Object.keys(user).sort()).toEqual(['email', 'firstName', 'id', 'lastName', 'roles']);
        expect(user.id).toBe(alice.id);
        expect(user.roles).toContain('user');
    });

    test('an unknown email returns an empty list', async () => {
        const res = await lookup({email: 'nobody.at.all@example.test'});
        expect(res.statusCode).toBe(200);
        expect(res.body.users).toEqual([]);
    });

    test('a token without a user-list right gets no users', async () => {
        const scoped = await request(server.http)
            .post('/auth/api-tokens')
            .set('Cookie', cookie)
            .send({name: 'no user rights', rights: ['frontend.dashboard.api_tokens.view']});
        expect(scoped.statusCode).toBe(201);
        try {
            const res = await lookup({email: alice.email}, scoped.body.secret);
            expect(res.statusCode).toBe(200);
            expect(res.body.users).toEqual([]);
        } finally {
            await request(server.http).delete('/auth/api-tokens/' + scoped.body.token.id).set('Cookie', cookie);
        }
    });
});
