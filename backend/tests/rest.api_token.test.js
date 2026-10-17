const request = require('supertest');
const Server = require('../webserver/Server.js');
const {addResearcherUser} = require('./utils.js');
const {listAttachableRights} = require('../webserver/utils/apiTokenAuth');
const {REST_RATE_LIMIT} = require('../webserver/middleware/restRateLimit');

const PORT = 3120;
const SETTING = 'system.auth.apiTokens.enabled';
const DOCUMENTS_VIEW = 'frontend.dashboard.documents.view';
const STUDIES_MANAGE = 'frontend.dashboard.studies.canManageStudies';

describe('REST API tokens', () => {
    let server;

    beforeAll(async () => {
        server = new Server();
        server.start(PORT);
        await server.devAdminReady;
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

    async function mint(cookie, body) {
        const res = await request(server.http)
            .post('/auth/api-tokens')
            .set('Cookie', cookie)
            .send(body);
        expect(res.statusCode).toBe(201);
        return res.body;
    }

    async function revoke(cookie, tokenId) {
        return request(server.http)
            .delete('/auth/api-tokens/' + tokenId)
            .set('Cookie', cookie);
    }

    function bearerGet(url, secret) {
        return request(server.http)
            .get(url)
            .set('Authorization', 'Bearer ' + secret);
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

    describe('owner demoted to guest-only', () => {
        let demoted;
        let demotedCookie;
        let leftover;

        beforeAll(async () => {
            const models = server.db.models;
            demoted = await addResearcherUser(models);
            demotedCookie = (await login(demoted.user.email, demoted.password)).cookie;
            leftover = await mint(demotedCookie, {name: 'before demotion', rights: [DOCUMENTS_VIEW]});

            const roleIds = await models['user_role_matching'].getUserRolesById(demoted.user.id);
            await models['user_role_matching'].deleteUserRoles(demoted.user.id, roleIds);
            const guestRole = await models['user_role'].findOne({where: {name: 'guest'}, raw: true});
            await models['user_role_matching'].create({userId: demoted.user.id, userRoleId: guestRole.id});
        });

        afterAll(async () => {
            if (leftover) {
                await server.db.models['api_token'].deleteById(leftover.token.id);
            }
            if (demoted) {
                await server.db.models['user'].deleteById(demoted.user.id);
            }
        });

        test('guest-only user cannot mint a token', async () => {
            const created = await request(server.http)
                .post('/auth/api-tokens')
                .set('Cookie', demotedCookie)
                .send({name: 'guest token'});
            expect(created.statusCode).toBe(403);
            expect(created.body.message).toBe('errors.rest.guestCannotCreateToken');
        });

        test('Bearer rejects a token whose owner is now guest-only', async () => {
            const res = await bearerGet('/rest/v1/documents', leftover.secret);
            expect(res.statusCode).toBe(403);
            expect(res.body.message).toBe('errors.rest.guestCannotUseToken');
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

        test('token without a rights list gets every right the owner has', async () => {
            const created = await mint(researcherCookie, {name: 'researcher default rights'});
            const rows = await server.db.models['api_token_right'].findAll({
                where: {apiTokenId: created.token.id, deleted: false},
                raw: true,
            });
            const ownerRights = await listAttachableRights(server.db.models, researcherUserId);
            expect(rows.map((row) => row.userRightName).sort()).toEqual([...ownerRights].sort());
            const revoked = await revoke(researcherCookie, created.token.id);
            expect(revoked.statusCode).toBe(200);
        });

        test('admin can revoke another user token', async () => {
            const created = await mint(researcherCookie, {name: 'revoked by admin'});
            const {cookie} = await adminSession();
            const revoked = await revoke(cookie, created.token.id);
            expect(revoked.statusCode).toBe(200);
            const after = await bearerGet('/rest/v1/documents', created.secret);
            expect(after.statusCode).toBe(401);
            expect(after.body.message).toBe('errors.rest.invalidBearer');
        });

        test('a stored right the owner does not have is refused', async () => {
            const ownerRights = await listAttachableRights(server.db.models, researcherUserId);
            expect(ownerRights).not.toContain(STUDIES_MANAGE);
            const created = await mint(researcherCookie, {name: 'stale right', rights: []});
            await server.db.models['api_token_right'].add({
                apiTokenId: created.token.id,
                userRightName: STUDIES_MANAGE,
                deleted: false,
            });
            try {
                const res = await request(server.http)
                    .post('/rest/v1/studies')
                    .set('Authorization', 'Bearer ' + created.secret)
                    .send({templateId: 1});
                expect(res.statusCode).toBe(403);
                expect(res.body.message).toBe('errors.rest.missingTokenRight');
            } finally {
                await revoke(researcherCookie, created.token.id);
            }
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

        test('REST with another auth scheme is 401', async () => {
            const res = await request(server.http)
                .get('/rest/v1/documents')
                .set('Authorization', 'Basic YWRtaW46YWRtaW4=');
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

        test('Bearer use sets lastUsedAt', async () => {
            const {cookie} = await adminSession();
            const created = await mint(cookie, {name: 'last used'});
            try {
                expect((await bearerGet('/rest/v1/documents', created.secret)).statusCode).toBe(200);
                let row;
                for (let attempt = 0; attempt < 20; attempt++) {
                    row = await server.db.models['api_token'].findOne({where: {id: created.token.id}, raw: true});
                    if (row.lastUsedAt) {
                        break;
                    }
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
                expect(row.lastUsedAt).toBeTruthy();
            } finally {
                await revoke(cookie, created.token.id);
            }
        });

        test('rate limit blocks a token after REST_RATE_LIMIT requests and leaves other tokens alone', async () => {
            const {cookie} = await adminSession();
            const first = await mint(cookie, {name: 'rate a'});
            const second = await mint(cookie, {name: 'rate b'});
            try {
                for (let count = 1; count <= REST_RATE_LIMIT; count++) {
                    const res = await bearerGet('/rest/v1/documents', first.secret);
                    expect({count, status: res.statusCode}).toEqual({count, status: 200});
                }
                const blocked = await bearerGet('/rest/v1/documents', first.secret);
                expect(blocked.statusCode).toBe(429);
                expect(blocked.body.message).toBe('errors.rest.rateLimitExceeded');

                const other = await bearerGet('/rest/v1/documents', second.secret);
                expect(other.statusCode).toBe(200);
                expect(Number(/r=(\d+)/.exec(other.headers['ratelimit'])[1])).toBe(REST_RATE_LIMIT - 1);
            } finally {
                await revoke(cookie, first.token.id);
                await revoke(cookie, second.token.id);
            }
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
