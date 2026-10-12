const request = require('supertest');
const Server = require('../webserver/Server.js');
const {addResearcherUser} = require('./utils.js');
const {
    generateSecret,
    hashSecret,
    displayPrefixFromSecret,
} = require('../webserver/utils/apiTokenAuth');

const PORT = 3120;
const SETTING = 'system.auth.apiTokens.enabled';
const DOCUMENTS_VIEW = 'frontend.dashboard.documents.view';

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
        return {
            cookie: res.headers['set-cookie'],
            userId: res.body.user.id,
        };
    }

    async function adminSession() {
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
            const fallback = await request(server.http)
                .post('/auth/login')
                .send({username: 'guest', password: process.env.GUEST_PWD});
            if (fallback.statusCode !== 200) {
                return null;
            }
            return fallback.headers['set-cookie'];
        }
        return res.headers['set-cookie'];
    }

    describe('cookie without a session', () => {
        test('list is 401', async () => {
            const res = await request(server.http).get('/auth/api-tokens');
            expect(res.statusCode).toBe(401);
            expect(res.body.message).toBe('auth.api.authenticationRequired');
        });

        test('create is 401', async () => {
            const res = await request(server.http)
                .post('/auth/api-tokens')
                .send({name: 'no session'});
            expect(res.statusCode).toBe(401);
        });
    });

    describe('cookie create and list', () => {
        test('create requires a name', async () => {
            const {cookie} = await adminSession();
            const empty = await request(server.http)
                .post('/auth/api-tokens')
                .set('Cookie', cookie)
                .send({name: '   '});
            expect(empty.statusCode).toBe(400);
            expect(empty.body.message).toBe('errors.rest.tokenNameRequired');
        });

        test('create returns secret once and never keyHash', async () => {
            const {cookie, userId} = await adminSession();
            const created = await request(server.http)
                .post('/auth/api-tokens')
                .set('Cookie', cookie)
                .send({name: 'lab script'});
            expect(created.statusCode).toBe(201);
            expect(created.body.secret).toMatch(/^care_/);
            expect(created.body.token.prefix).toMatch(/^care_/);
            expect(created.body.token.userId).toBe(userId);
            expect(created.body.token).not.toHaveProperty('keyHash');
            expect(created.body.token.name).toBe('lab script');

            const listed = await request(server.http)
                .get('/auth/api-tokens')
                .set('Cookie', cookie);
            expect(listed.statusCode).toBe(200);
            const row = listed.body.tokens.find((item) => item.id === created.body.token.id);
            expect(row).toBeTruthy();
            expect(row.userId).toBe(userId);
            expect(row).not.toHaveProperty('keyHash');
            expect(row).not.toHaveProperty('secret');

            await request(server.http)
                .delete('/auth/api-tokens/' + created.body.token.id)
                .set('Cookie', cookie);
        });

        test('optional rights subset is stored and works for documents', async () => {
            const {cookie} = await adminSession();
            const created = await request(server.http)
                .post('/auth/api-tokens')
                .set('Cookie', cookie)
                .send({
                    name: 'docs only',
                    rights: [DOCUMENTS_VIEW],
                });
            expect(created.statusCode).toBe(201);
            try {
                const rows = await server.db.models['api_token_right'].findAll({
                    where: {apiTokenId: created.body.token.id, deleted: false},
                    raw: true,
                });
                expect(rows.map((row) => row.userRightName)).toEqual([DOCUMENTS_VIEW]);

                const docs = await request(server.http)
                    .get('/rest/v1/documents')
                    .set('Authorization', 'Bearer ' + created.body.secret);
                expect(docs.statusCode).toBe(200);
            } finally {
                await request(server.http)
                    .delete('/auth/api-tokens/' + created.body.token.id)
                    .set('Cookie', cookie);
            }
        });

        test('create rejects a right the owner cannot attach', async () => {
            const {cookie} = await adminSession();
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
    });

    describe('revoke', () => {
        test('revoke then Bearer is invalid', async () => {
            const {cookie} = await adminSession();
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
            const {cookie} = await adminSession();
            const res = await request(server.http)
                .delete('/auth/api-tokens/abc')
                .set('Cookie', cookie);
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('errors.rest.invalidTokenId');
        });

        test('revoke missing token is 404', async () => {
            const {cookie} = await adminSession();
            const res = await request(server.http)
                .delete('/auth/api-tokens/999999999')
                .set('Cookie', cookie);
            expect(res.statusCode).toBe(404);
            expect(res.body.message).toBe('errors.rest.tokenNotFound');
        });
    });

    describe('guest-only', () => {
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
                    userRightName: DOCUMENTS_VIEW,
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
    });

    describe('non-admin researcher', () => {
        let researcher;
        let researcherCookie;
        let researcherUserId;

        beforeAll(async () => {
            researcher = await addResearcherUser(server.db.models);
            const session = await login(researcher.user.email, researcher.password);
            researcherCookie = session.cookie;
            researcherUserId = session.userId;
        });

        afterAll(async () => {
            if (researcher && researcher.user.id) {
                await server.db.models['user'].deleteById(researcher.user.id);
            }
        });

        test('non-admin cannot revoke another user token', async () => {
            const {cookie} = await adminSession();
            const created = await request(server.http)
                .post('/auth/api-tokens')
                .set('Cookie', cookie)
                .send({name: 'admin owned'});
            expect(created.statusCode).toBe(201);

            const res = await request(server.http)
                .delete('/auth/api-tokens/' + created.body.token.id)
                .set('Cookie', researcherCookie);
            expect(res.statusCode).toBe(403);
            expect(res.body.message).toBe('errors.rest.cannotRevokeForeignToken');

            await request(server.http)
                .delete('/auth/api-tokens/' + created.body.token.id)
                .set('Cookie', cookie);
        });

        test('admin list includes another user token with userId', async () => {
            const {cookie: adminCookie, userId: adminId} = await adminSession();
            const adminToken = await request(server.http)
                .post('/auth/api-tokens')
                .set('Cookie', adminCookie)
                .send({name: 'admin list marker'});
            expect(adminToken.statusCode).toBe(201);

            const researcherToken = await request(server.http)
                .post('/auth/api-tokens')
                .set('Cookie', researcherCookie)
                .send({name: 'researcher listed'});
            expect(researcherToken.statusCode).toBe(201);

            try {
                const adminList = await request(server.http)
                    .get('/auth/api-tokens')
                    .set('Cookie', adminCookie);
                expect(adminList.statusCode).toBe(200);
                const other = adminList.body.tokens.find(
                    (item) => item.id === researcherToken.body.token.id
                );
                expect(other).toBeTruthy();
                expect(other.userId).toBe(researcherUserId);
                expect(other.userId).not.toBe(adminId);

                const ownList = await request(server.http)
                    .get('/auth/api-tokens')
                    .set('Cookie', researcherCookie);
                expect(ownList.statusCode).toBe(200);
                expect(ownList.body.tokens.some((item) => item.id === adminToken.body.token.id)).toBe(false);
                expect(ownList.body.tokens.every((item) => item.userId === researcherUserId)).toBe(true);
            } finally {
                await request(server.http)
                    .delete('/auth/api-tokens/' + researcherToken.body.token.id)
                    .set('Cookie', researcherCookie);
                await request(server.http)
                    .delete('/auth/api-tokens/' + adminToken.body.token.id)
                    .set('Cookie', adminCookie);
            }
        });
    });

    describe('Bearer gate', () => {
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
    });

    describe('setting off', () => {
        test('blocks cookie list, mint, revoke, and Bearer REST', async () => {
            const {cookie} = await adminSession();
            const created = await request(server.http)
                .post('/auth/api-tokens')
                .set('Cookie', cookie)
                .send({name: 'before disable'});
            expect(created.statusCode).toBe(201);

            await server.db.models['setting'].set(SETTING, 'false');
            try {
                const listed = await request(server.http)
                    .get('/auth/api-tokens')
                    .set('Cookie', cookie);
                expect(listed.statusCode).toBe(403);
                expect(listed.body.message).toBe('errors.rest.apiTokensDisabled');

                const mint = await request(server.http)
                    .post('/auth/api-tokens')
                    .set('Cookie', cookie)
                    .send({name: 'while off'});
                expect(mint.statusCode).toBe(403);
                expect(mint.body.message).toBe('errors.rest.apiTokensDisabled');

                const revoke = await request(server.http)
                    .delete('/auth/api-tokens/' + created.body.token.id)
                    .set('Cookie', cookie);
                expect(revoke.statusCode).toBe(403);
                expect(revoke.body.message).toBe('errors.rest.apiTokensDisabled');

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
});
