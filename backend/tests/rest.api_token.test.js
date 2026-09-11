const request = require('supertest');
const Server = require('../webserver/Server.js');
const {
    generateSecret,
    hashSecret,
    displayPrefixFromSecret,
} = require('../webserver/utils/apiTokenAuth');

const PORT = 3120;
const SETTING = 'system.auth.apiTokens.enabled';

describe('REST API tokens', () => {
    let server;

    beforeAll(async () => {
        server = new Server();
        server.start(PORT);
        await server.db.models['setting'].set(SETTING, 'true');
    });

    afterAll(async () => {
        await server.db.models['setting'].set(SETTING, 'true');
        server.stop();
    });

    async function login(username, password) {
        const res = await request(server.http)
            .post('/auth/login')
            .send({username, password});
        expect(res.statusCode).toBe(200);
        return res.headers['set-cookie'];
    }

    async function adminCookie() {
        return login(process.env.ADMIN_EMAIL, process.env.ADMIN_PWD);
    }

    async function guestCookie() {
        if (!process.env.GUEST_PWD) {
            return null;
        }
        const username = process.env.GUEST_EMAIL || 'guest';
        const res = await request(server.http)
            .post('/auth/login')
            .send({username, password: process.env.GUEST_PWD});
        if (res.statusCode !== 200) {
            return login('guest', process.env.GUEST_PWD);
        }
        return res.headers['set-cookie'];
    }

    test('cookie list without session is 401', async () => {
        const res = await request(server.http).get('/auth/api-tokens');
        expect(res.statusCode).toBe(401);
        expect(res.body.message).toBe('auth.api.authenticationRequired');
    });

    test('cookie create without session is 401', async () => {
        const res = await request(server.http)
            .post('/auth/api-tokens')
            .send({name: 'no session'});
        expect(res.statusCode).toBe(401);
    });

    test('cookie create requires a name', async () => {
        const cookie = await adminCookie();
        const empty = await request(server.http)
            .post('/auth/api-tokens')
            .set('Cookie', cookie)
            .send({name: '   '});
        expect(empty.statusCode).toBe(400);
        expect(empty.body.message).toBe('errors.rest.tokenNameRequired');
    });

    test('cookie create returns secret once and never keyHash', async () => {
        const cookie = await adminCookie();
        const created = await request(server.http)
            .post('/auth/api-tokens')
            .set('Cookie', cookie)
            .send({name: 'lab script'});
        expect(created.statusCode).toBe(201);
        expect(created.body.secret).toMatch(/^care_/);
        expect(created.body.token.prefix).toMatch(/^care_/);
        expect(created.body.token).not.toHaveProperty('keyHash');
        expect(created.body.token.name).toBe('lab script');

        const listed = await request(server.http)
            .get('/auth/api-tokens')
            .set('Cookie', cookie);
        expect(listed.statusCode).toBe(200);
        const row = listed.body.tokens.find((item) => item.id === created.body.token.id);
        expect(row).toBeTruthy();
        expect(row).not.toHaveProperty('keyHash');
        expect(row).not.toHaveProperty('secret');

        await request(server.http)
            .delete('/auth/api-tokens/' + created.body.token.id)
            .set('Cookie', cookie);
    });

    test('cookie create rejects a right the owner cannot attach', async () => {
        const cookie = await adminCookie();
        const created = await request(server.http)
            .post('/auth/api-tokens')
            .set('Cookie', cookie)
            .send({
                name: 'bad right',
                rights: ['not.a.real.right'],
            });
        expect(created.statusCode).toBe(403);
        expect(created.body.message).toBe('errors.rest.cannotGrantMissingRight');
    });

    test('revoke then Bearer is invalid', async () => {
        const cookie = await adminCookie();
        const created = await request(server.http)
            .post('/auth/api-tokens')
            .set('Cookie', cookie)
            .send({name: 'to revoke'});
        expect(created.statusCode).toBe(201);

        const revoked = await request(server.http)
            .delete('/auth/api-tokens/' + created.body.token.id)
            .set('Cookie', cookie);
        expect(revoked.statusCode).toBe(200);
        expect(revoked.body.success).toBe(true);

        const after = await request(server.http)
            .get('/rest/v1/documents')
            .set('Authorization', 'Bearer ' + created.body.secret);
        expect(after.statusCode).toBe(401);
        expect(after.body.message).toBe('errors.rest.invalidBearer');
    });

    test('revoke rejects a non-integer id', async () => {
        const cookie = await adminCookie();
        const res = await request(server.http)
            .delete('/auth/api-tokens/abc')
            .set('Cookie', cookie);
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('errors.rest.invalidTokenId');
    });

    test('revoke missing token is 404', async () => {
        const cookie = await adminCookie();
        const res = await request(server.http)
            .delete('/auth/api-tokens/999999999')
            .set('Cookie', cookie);
        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe('errors.rest.tokenNotFound');
    });

    test('non-admin cannot revoke another user token', async () => {
        const cookie = await adminCookie();
        const created = await request(server.http)
            .post('/auth/api-tokens')
            .set('Cookie', cookie)
            .send({name: 'admin owned'});
        expect(created.statusCode).toBe(201);

        const guest = await guestCookie();
        if (!guest) {
            await request(server.http)
                .delete('/auth/api-tokens/' + created.body.token.id)
                .set('Cookie', cookie);
            return;
        }

        const res = await request(server.http)
            .delete('/auth/api-tokens/' + created.body.token.id)
            .set('Cookie', guest);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe('errors.rest.cannotRevokeForeignToken');

        await request(server.http)
            .delete('/auth/api-tokens/' + created.body.token.id)
            .set('Cookie', cookie);
    });

    test('guest-only user cannot mint a token', async () => {
        const cookie = await guestCookie();
        if (!cookie) {
            return;
        }
        const created = await request(server.http)
            .post('/auth/api-tokens')
            .set('Cookie', cookie)
            .send({name: 'guest token'});
        expect(created.statusCode).toBe(403);
        expect(created.body.message).toBe('errors.rest.guestCannotCreateToken');
    });

    test('Bearer rejects a token whose owner is guest-only', async () => {
        const email = process.env.GUEST_EMAIL;
        if (!email) {
            return;
        }
        const guest = await server.db.models['user'].findOne({
            where: {email},
            raw: true,
        });
        expect(guest).toBeTruthy();

        const secret = generateSecret();
        const token = await server.db.models['api_token'].add({
            userId: guest.id,
            name: 'leftover after demotion',
            keyHash: hashSecret(secret),
            prefix: displayPrefixFromSecret(secret),
        });
        try {
            await server.db.models['api_token_right'].add({
                apiTokenId: token.id,
                userRightName: 'frontend.dashboard.documents.view',
                deleted: false,
            });

            const res = await request(server.http)
                .get('/rest/v1/documents')
                .set('Authorization', 'Bearer ' + secret);
            expect(res.statusCode).toBe(403);
            expect(res.body.message).toBe('errors.rest.guestCannotUseToken');
        } finally {
            await server.db.models['api_token'].deleteById(token.id);
        }
    });

    test('REST without Bearer is 401', async () => {
        const res = await request(server.http).get('/rest/v1/documents');
        expect(res.statusCode).toBe(401);
        expect(res.body.message).toBe('errors.rest.missingBearer');
    });

    test('REST with empty Bearer is 401', async () => {
        const res = await request(server.http)
            .get('/rest/v1/documents')
            .set('Authorization', 'Bearer ');
        expect(res.statusCode).toBe(401);
        expect(res.body.message).toBe('errors.rest.missingBearer');
    });

    test('REST with a wrong secret is 401', async () => {
        const res = await request(server.http)
            .get('/rest/v1/documents')
            .set('Authorization', 'Bearer care_deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
        expect(res.statusCode).toBe(401);
        expect(res.body.message).toBe('errors.rest.invalidBearer');
    });

    test('setting off blocks cookie mint and Bearer REST', async () => {
        const cookie = await adminCookie();
        const created = await request(server.http)
            .post('/auth/api-tokens')
            .set('Cookie', cookie)
            .send({name: 'before disable'});
        expect(created.statusCode).toBe(201);

        await server.db.models['setting'].set(SETTING, 'false');
        try {
            const mint = await request(server.http)
                .post('/auth/api-tokens')
                .set('Cookie', cookie)
                .send({name: 'while off'});
            expect(mint.statusCode).toBe(403);
            expect(mint.body.message).toBe('errors.rest.apiTokensDisabled');

            const rest = await request(server.http)
                .get('/rest/v1/documents')
                .set('Authorization', 'Bearer ' + created.body.secret);
            expect(rest.statusCode).toBe(403);
            expect(rest.body.message).toBe('errors.rest.apiTokensDisabled');
        } finally {
            await server.db.models['setting'].set(SETTING, 'true');
            await request(server.http)
                .delete('/auth/api-tokens/' + created.body.token.id)
                .set('Cookie', cookie);
        }
    });
});
