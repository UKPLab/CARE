const request = require('supertest');
const Server = require('../webserver/Server.js');
const {addResearcherUser, enableRestForTests, allTokenRights} = require('./utils.js');
const {listAttachableRights} = require('../webserver/utils/apiTokenAuth');
const {GENERAL_SETTING, HEAVY_SETTING, FAILED_AUTH_SETTING} = require('../webserver/middleware/restRateLimit');

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
        await enableRestForTests(server.db.models);
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

    // A token with every right its owner may attach, unless the test lists rights itself.
    async function mint(cookie, body) {
        const withRights = body.rights ? body : {...body, rights: await allTokenRights(server, cookie)};
        const res = await request(server.http)
            .post('/auth/api-tokens')
            .set('Cookie', cookie)
            .send(withRights);
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
        test('a userId in the body is ignored: the token always belongs to the logged-in user', async () => {
            const {cookie, userId} = await adminSession();
            const created = await mint(cookie, {name: 'not for someone else', userId: 999999});
            expect(created.token.userId).toBe(userId);
            const row = await server.db.models['api_token'].getById(created.token.id);
            expect(row.userId).toBe(userId);
            await revoke(cookie, created.token.id);
        });

        test('GET rights lists attachable rights with descriptions and role presets within them', async () => {
            const {cookie} = await adminSession();
            const res = await request(server.http).get('/auth/api-tokens/rights').set('Cookie', cookie);
            expect(res.statusCode).toBe(200);
            const names = res.body.rights.map((right) => right.name);
            expect(names).toContain('frontend.dashboard.documents.view');
            expect(Object.keys(res.body.rights[0]).sort()).toEqual(['description', 'name']);
            expect(res.body.roles.some((role) => role.name === 'admin')).toBe(false);
            for (const role of res.body.roles) {
                expect(role.rights.every((name) => names.includes(name))).toBe(true);
            }
        });

        test('GET rights without a session is 401', async () => {
            const res = await request(server.http).get('/auth/api-tokens/rights');
            expect(res.statusCode).toBe(401);
        });

        test('list and create return the rights stored on the token', async () => {
            const {cookie} = await adminSession();
            const created = await request(server.http)
                .post('/auth/api-tokens')
                .set('Cookie', cookie)
                .send({name: 'rights echo', rights: ['frontend.dashboard.documents.view', 'frontend.dashboard.documents.view']});
            expect(created.statusCode).toBe(201);
            expect(created.body.token.rights).toEqual(['frontend.dashboard.documents.view']);
            const listed = await request(server.http).get('/auth/api-tokens').set('Cookie', cookie);
            const row = listed.body.tokens.find((token) => token.id === created.body.token.id);
            expect(row.rights).toEqual(['frontend.dashboard.documents.view']);
            await request(server.http).delete('/auth/api-tokens/' + created.body.token.id).set('Cookie', cookie);
        });

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
                .send({name: 'lab script', rights: await allTokenRights(server, cookie)});
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

    describe('expiry', () => {
        test('create rejects an expiry that is not a future date', async () => {
            const {cookie} = await adminSession();
            for (const expiresAt of ['nope', '2001-01-01T00:00:00.000Z', 5]) {
                const res = await request(server.http)
                    .post('/auth/api-tokens')
                    .set('Cookie', cookie)
                    .send({name: 'bad expiry', expiresAt});
                expect({expiresAt, status: res.statusCode, message: res.body.message})
                    .toEqual({expiresAt, status: 400, message: 'errors.rest.invalidTokenExpiry'});
            }
        });

        test('any future expiry is accepted, also more than a year ahead', async () => {
            const {cookie} = await adminSession();
            const twoYears = new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
            const created = await mint(cookie, {name: 'long expiry', expiresAt: twoYears});
            expect(created.token.expiresAt).toBe(twoYears);
            await revoke(cookie, created.token.id);
        });

        test('a token works before its expiry and is 401 after it', async () => {
            const {cookie} = await adminSession();
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
            const created = await mint(cookie, {name: 'expiring', expiresAt});
            expect(created.token.expiresAt).toBe(expiresAt);
            try {
                const before = await bearerGet('/rest/v1/me', created.secret);
                expect(before.statusCode).toBe(200);
                expect(before.body.token.expiresAt).toBe(expiresAt);

                await server.db.models['api_token'].update(
                    {expiresAt: new Date(Date.now() - 1000)},
                    {where: {id: created.token.id}}
                );
                const after = await bearerGet('/rest/v1/me', created.secret);
                expect(after.statusCode).toBe(401);
                expect(after.body.message).toBe('errors.rest.expiredBearer');
            } finally {
                await revoke(cookie, created.token.id);
            }
        });

        test('a token without an expiry has expiresAt null', async () => {
            const {cookie} = await adminSession();
            const created = await mint(cookie, {name: 'no expiry'});
            expect(created.token.expiresAt).toBeNull();
            await revoke(cookie, created.token.id);
        });
    });

    describe('revoke', () => {
        test('revoke then Bearer is invalid', async () => {
            const {cookie} = await adminSession();
            const created = await request(server.http)
                .post('/auth/api-tokens')
                .set('Cookie', cookie)
                .send({name: 'to revoke', rights: await allTokenRights(server, cookie)});
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
            // Guests do not hold the API tokens page right, so that check answers first.
            expect(created.body.message).toBe('errors.rest.apiTokensNoAccess');
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
                .send({name: 'admin owned', rights: await allTokenRights(server, cookie)});
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

        test('a token cannot be created without a rights list', async () => {
            for (const body of [{name: 'no rights'}, {name: 'empty rights', rights: []}, {name: 'bad rights', rights: [5]}]) {
                const res = await request(server.http)
                    .post('/auth/api-tokens')
                    .set('Cookie', researcherCookie)
                    .send(body);
                expect({body, status: res.statusCode, message: res.body.message})
                    .toEqual({body, status: 400, message: 'errors.rest.tokenRightsRequired'});
            }
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
            const created = await mint(researcherCookie, {name: 'stale right', rights: ['frontend.dashboard.api_tokens.view']});
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
                .send({name: 'admin list marker', rights: await allTokenRights(server, adminCookie)});
            expect(adminToken.statusCode).toBe(201);

            const researcherToken = await request(server.http)
                .post('/auth/api-tokens')
                .set('Cookie', researcherCookie)
                .send({name: 'researcher listed', rights: await allTokenRights(server, researcherCookie)});
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

    describe('owner deleted, form posts, and the token cap', () => {
        async function freshResearcher() {
            const researcher = await addResearcherUser(server.db.models);
            const session = await login(researcher.user.email, researcher.password);
            return {...researcher, cookie: session.cookie};
        }

        test('deleting a user revokes their tokens', async () => {
            const researcher = await freshResearcher();
            const created = await mint(researcher.cookie, {name: 'owner will be deleted'});
            expect((await bearerGet('/rest/v1/me', created.secret)).statusCode).toBe(200);
            await server.db.models['user'].updateById(researcher.user.id, {deleted: true});
            const row = await server.db.models['api_token'].findOne({where: {id: created.token.id}, raw: true});
            expect(row.deleted).toBe(true);
            const after = await bearerGet('/rest/v1/me', created.secret);
            expect(after.statusCode).toBe(401);
        });

        test('a token whose owner is deleted is 401 even if the token row was left', async () => {
            const researcher = await freshResearcher();
            const created = await mint(researcher.cookie, {name: 'owner deleted, row left'});
            // Without hooks, so the token row stays and only bearerAuth's owner check can stop it.
            await server.db.models['user'].update({deleted: true}, {where: {id: researcher.user.id}, hooks: false});
            const after = await bearerGet('/rest/v1/me', created.secret);
            expect(after.statusCode).toBe(401);
            expect(after.body.message).toBe('errors.rest.tokenOwnerDeleted');
        });

        test('a token stops working when its owner loses the role that held the right', async () => {
            const researcher = await freshResearcher();
            const created = await mint(researcher.cookie, {name: 'role removed', rights: ['frontend.dashboard.documents.view']});
            expect((await bearerGet('/rest/v1/documents', created.secret)).statusCode).toBe(200);
            const matching = server.db.models['user_role_matching'];
            const roleIds = await matching.getUserRolesById(researcher.user.id);
            await matching.deleteUserRoles(researcher.user.id, roleIds);
            const after = await bearerGet('/rest/v1/documents', created.secret);
            expect(after.statusCode).toBe(403);
            expect(after.body.message).toBe('errors.rest.missingTokenRight');
            await server.db.models['user'].deleteById(researcher.user.id);
        });

        test('a user without the API tokens right cannot list, see rights, create, or revoke tokens', async () => {
            const models = server.db.models;
            const researcher = await freshResearcher();
            const role = await models['user_role'].create({name: 'rest-no-tokens-' + Date.now(), deleted: false});
            const matching = models['user_role_matching'];
            await matching.deleteUserRoles(researcher.user.id, await matching.getUserRolesById(researcher.user.id));
            await matching.create({userId: researcher.user.id, userRoleId: role.id, deleted: false});
            try {
                const {cookie} = await login(researcher.user.email, researcher.password);
                const answers = [
                    await request(server.http).get('/auth/api-tokens').set('Cookie', cookie),
                    await request(server.http).get('/auth/api-tokens/rights').set('Cookie', cookie),
                    await request(server.http).post('/auth/api-tokens').set('Cookie', cookie)
                        .send({name: 'no right', rights: ['frontend.dashboard.documents.view']}),
                    await request(server.http).delete('/auth/api-tokens/1').set('Cookie', cookie),
                ];
                for (const res of answers) {
                    expect({status: res.statusCode, message: res.body.message})
                        .toEqual({status: 403, message: 'errors.rest.apiTokensNoAccess'});
                }
            } finally {
                await server.db.models['user'].deleteById(researcher.user.id);
                await matching.deleteUserRoles(researcher.user.id, [role.id]);
                await models['user_role'].destroy({where: {id: role.id}, force: true});
            }
        });

        test('create refuses a form post, so another site cannot create tokens', async () => {
            const {cookie} = await adminSession();
            const res = await request(server.http)
                .post('/auth/api-tokens')
                .set('Cookie', cookie)
                .type('form')
                .send('name=forged&rights[]=frontend.dashboard.documents.view');
            expect(res.statusCode).toBe(415);
            expect(res.body.message).toBe('errors.rest.jsonRequired');
        });

        test('a user may hold at most 25 unexpired tokens', async () => {
            const researcher = await freshResearcher();
            const rights = ['frontend.dashboard.documents.view'];
            const ids = [];
            for (let i = 0; i < 25; i++) {
                ids.push((await mint(researcher.cookie, {name: 'cap ' + i, rights})).token.id);
            }
            const over = await request(server.http).post('/auth/api-tokens').set('Cookie', researcher.cookie)
                .send({name: 'one too many', rights});
            expect(over.statusCode).toBe(400);
            expect(over.body.message).toBe('errors.rest.tooManyTokens');
            // An expired token does not count.
            await server.db.models['api_token'].update({expiresAt: new Date(Date.now() - 1000)}, {where: {id: ids[0]}});
            const again = await request(server.http).post('/auth/api-tokens').set('Cookie', researcher.cookie)
                .send({name: 'room again', rights});
            expect(again.statusCode).toBe(201);
            await server.db.models['user'].deleteById(researcher.user.id);
        });

        test('parallel creates cannot go over the 25-token limit together', async () => {
            const researcher = await freshResearcher();
            const rights = ['frontend.dashboard.documents.view'];
            for (let i = 0; i < 23; i++) {
                await mint(researcher.cookie, {name: 'cap ' + i, rights});
            }
            const results = await Promise.all([1, 2, 3, 4].map((i) => request(server.http)
                .post('/auth/api-tokens').set('Cookie', researcher.cookie).send({name: 'parallel ' + i, rights})));
            expect(results.map((res) => res.statusCode).sort()).toEqual([201, 201, 400, 400]);
            const active = await server.db.models['api_token'].count({where: {userId: researcher.user.id, deleted: false}});
            expect(active).toBe(25);
            await server.db.models['user'].deleteById(researcher.user.id);
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

                // Within a minute another request does not write it again; after a minute it does.
                const first = new Date(row.lastUsedAt).getTime();
                expect((await bearerGet('/rest/v1/documents', created.secret)).statusCode).toBe(200);
                await new Promise((resolve) => setTimeout(resolve, 200));
                row = await server.db.models['api_token'].findOne({where: {id: created.token.id}, raw: true});
                expect(new Date(row.lastUsedAt).getTime()).toBe(first);

                await server.db.models['api_token'].update({lastUsedAt: new Date(Date.now() - 61 * 1000)}, {where: {id: created.token.id}});
                expect((await bearerGet('/rest/v1/documents', created.secret)).statusCode).toBe(200);
                let updated = false;
                for (let attempt = 0; attempt < 20 && !updated; attempt++) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                    row = await server.db.models['api_token'].findOne({where: {id: created.token.id}, raw: true});
                    updated = Date.now() - new Date(row.lastUsedAt).getTime() < 10 * 1000;
                }
                expect(updated).toBe(true);
            } finally {
                await revoke(cookie, created.token.id);
            }
        });

        test('rate limit counts per user across tokens, answers 429 with text, and leaves other users alone', async () => {
            // Fresh users, so no earlier request in this suite counts against the budget.
            const one = await addResearcherUser(server.db.models);
            const two = await addResearcherUser(server.db.models);
            const oneSession = await login(one.user.email, one.password);
            const twoSession = await login(two.user.email, two.password);
            const first = await mint(oneSession.cookie, {name: 'rate a'});
            const second = await mint(oneSession.cookie, {name: 'rate b'});
            const theirs = await mint(twoSession.cookie, {name: 'rate other user'});
            await server.db.models['setting'].set(GENERAL_SETTING, '4');
            try {
                for (let count = 1; count <= 2; count++) {
                    expect((await bearerGet('/rest/v1/me', first.secret)).statusCode).toBe(200);
                    expect((await bearerGet('/rest/v1/me', second.secret)).statusCode).toBe(200);
                }
                const blocked = await bearerGet('/rest/v1/me', second.secret);
                expect(blocked.statusCode).toBe(429);
                expect(blocked.body.message).toBe('errors.rest.rateLimitExceeded');
                expect(blocked.body.error).toMatch(/too many requests/i);

                const other = await bearerGet('/rest/v1/me', theirs.secret);
                expect(other.statusCode).toBe(200);
                expect(other.headers['ratelimit']).toBeTruthy();
            } finally {
                await server.db.models['setting'].set(GENERAL_SETTING, '100000');
                await server.db.models['user'].deleteById(one.user.id);
                await server.db.models['user'].deleteById(two.user.id);
            }
        });

        test('uploads, bulk writes, and imports have their own smaller budget', async () => {
            const {cookie} = await adminSession();
            const created = await mint(cookie, {name: 'heavy'});
            await server.db.models['setting'].set(HEAVY_SETTING, '1');
            try {
                const importOne = () => request(server.http)
                    .post('/rest/v1/templates/import')
                    .set('Authorization', 'Bearer ' + created.secret)
                    .send({name: 'heavy limit', description: 'x', type: 8, template_content: []});
                const first = await importOne();
                expect(first.statusCode).toBe(201);
                await server.db.models['template'].deleteById(first.body.templates[0].id);
                expect((await importOne()).statusCode).toBe(429);
                expect((await bearerGet('/rest/v1/me', created.secret)).statusCode).toBe(200);
            } finally {
                await server.db.models['setting'].set(HEAVY_SETTING, '100000');
                await revoke(cookie, created.token.id);
            }
        });

        test('bad tokens are limited per IP before auth; working requests do not count', async () => {
            const {cookie} = await adminSession();
            const created = await mint(cookie, {name: 'ip limit'});
            // As behind nginx with TRUST_PROXY=1: the client address comes from X-Forwarded-For,
            // so this test has its own address that no earlier request counted against.
            server.app.set('trust proxy', 1);
            const from = (ip, secret) => request(server.http).get('/rest/v1/me')
                .set('X-Forwarded-For', ip).set('Authorization', 'Bearer ' + secret);
            await server.db.models['setting'].set(FAILED_AUTH_SETTING, '3');
            try {
                for (let i = 0; i < 5; i++) {
                    expect((await from('203.0.113.7', created.secret)).statusCode).toBe(200);
                }
                for (let i = 0; i < 3; i++) {
                    expect((await from('203.0.113.7', 'care_wrong_' + i)).statusCode).toBe(401);
                }
                const blocked = await from('203.0.113.7', 'care_wrong_again');
                expect(blocked.statusCode).toBe(429);
                expect(blocked.body.message).toBe('errors.rest.rateLimitExceeded');
                // The whole address waits for the rest of the minute, a valid token too.
                expect((await from('203.0.113.7', created.secret)).statusCode).toBe(429);
                // Another address is not affected.
                expect((await from('198.51.100.9', created.secret)).statusCode).toBe(200);
            } finally {
                await server.db.models['setting'].set(FAILED_AUTH_SETTING, '100000');
                server.app.set('trust proxy', false);
                await revoke(cookie, created.token.id);
            }
        });

        test('errors carry the English text next to the key', async () => {
            const res = await bearerGet('/rest/v1/me', 'care_wrong');
            expect(res.statusCode).toBe(401);
            expect(res.body.message).toBe('errors.rest.invalidBearer');
            expect(res.body.error).toBe('Invalid or revoked API token.');
        });

        test('broken JSON in a REST body is a JSON 400, not an HTML page', async () => {
            const {cookie} = await adminSession();
            const created = await mint(cookie, {name: 'bad json'});
            try {
                const res = await request(server.http)
                    .post('/rest/v1/documents')
                    .set('Authorization', 'Bearer ' + created.secret)
                    .set('Content-Type', 'application/json')
                    .send('{"name": ');
                expect(res.statusCode).toBe(400);
                expect(res.headers['content-type']).toMatch(/json/);
                expect(res.body.message).toBe('errors.rest.invalidJson');
            } finally {
                await revoke(cookie, created.token.id);
            }
        });
    });

    describe('setting off', () => {
        test('blocks cookie list, mint, revoke, and Bearer REST', async () => {
            const {cookie} = await adminSession();
            const created = await request(server.http)
                .post('/auth/api-tokens')
                .set('Cookie', cookie)
                .send({name: 'before disable', rights: await allTokenRights(server, cookie)});
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
