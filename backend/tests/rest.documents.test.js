const request = require('supertest');
const Server = require('../webserver/Server.js');

const PORT = 3121;
const SETTING = 'system.auth.apiTokens.enabled';

describe('REST documents', () => {
    let server;
    let cookie;
    let secret;
    let tokenId;
    let ownerId;

    beforeAll(async () => {
        server = new Server();
        server.start(PORT);
        await server.db.models['setting'].set(SETTING, 'true');

        const login = await request(server.http)
            .post('/auth/login')
            .send({
                username: process.env.ADMIN_EMAIL,
                password: process.env.ADMIN_PWD,
            });
        expect(login.statusCode).toBe(200);
        cookie = login.headers['set-cookie'];
        ownerId = login.body.user.id;

        const created = await request(server.http)
            .post('/auth/api-tokens')
            .set('Cookie', cookie)
            .send({name: 'documents tests'});
        expect(created.statusCode).toBe(201);
        secret = created.body.secret;
        tokenId = created.body.token.id;
    });

    afterAll(async () => {
        if (cookie && tokenId) {
            await request(server.http)
                .delete('/auth/api-tokens/' + tokenId)
                .set('Cookie', cookie);
        }
        server.stop();
    });

    async function bearerGet() {
        return request(server.http)
            .get('/rest/v1/documents')
            .set('Authorization', 'Bearer ' + secret);
    }

    async function bearerPost(body) {
        return request(server.http)
            .post('/rest/v1/documents')
            .set('Authorization', 'Bearer ' + secret)
            .send(body);
    }

    test('GET lists an array of the token owner documents', async () => {
        const res = await bearerGet();
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.documents)).toBe(true);
        for (const doc of res.body.documents) {
            expect(doc.userId).toBe(ownerId);
        }
    });

    test('POST creates a blank HTML document for the owner', async () => {
        const res = await bearerPost({name: 'REST blank html'});
        expect(res.statusCode).toBe(201);
        expect(res.body.document.name).toBe('REST blank html');
        expect(res.body.document.type).toBe(1);
        expect(res.body.document.userId).toBe(ownerId);
        expect(res.body.document.uploadedByUserId).toBeNull();
        await server.db.models['document'].deleteById(res.body.document.id);
    });

    test('POST ignores userId in the body', async () => {
        const res = await bearerPost({name: 'steal attempt', userId: 1});
        expect(res.statusCode).toBe(201);
        expect(res.body.document.userId).toBe(ownerId);
        expect(res.body.document.userId).not.toBe(1);
        await server.db.models['document'].deleteById(res.body.document.id);
    });

    test('POST requires a name', async () => {
        const res = await bearerPost({name: '  '});
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('errors.rest.documentNameRequired');
    });

    test('POST rejects a non-HTML type', async () => {
        const res = await bearerPost({name: 'pdf try', type: 0});
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('errors.rest.unsupportedDocumentType');
    });

    test('POST rejects a non-integer projectId', async () => {
        const res = await bearerPost({name: 'bad project', projectId: 'nope'});
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('errors.rest.invalidProjectId');
    });

    test('token without documents.view is 403', async () => {
        const scoped = await request(server.http)
            .post('/auth/api-tokens')
            .set('Cookie', cookie)
            .send({
                name: 'docs denied',
                rights: ['frontend.dashboard.api_tokens.view'],
            });
        expect(scoped.statusCode).toBe(201);
        try {
            const denied = await request(server.http)
                .get('/rest/v1/documents')
                .set('Authorization', 'Bearer ' + scoped.body.secret);
            expect(denied.statusCode).toBe(403);
            expect(denied.body.message).toBe('errors.rest.missingTokenRight');
        } finally {
            await request(server.http)
                .delete('/auth/api-tokens/' + scoped.body.token.id)
                .set('Cookie', cookie);
        }
    });

    test('empty rights list cannot call documents', async () => {
        const scoped = await request(server.http)
            .post('/auth/api-tokens')
            .set('Cookie', cookie)
            .send({
                name: 'no rights',
                rights: [],
            });
        expect(scoped.statusCode).toBe(201);
        try {
            const denied = await request(server.http)
                .post('/rest/v1/documents')
                .set('Authorization', 'Bearer ' + scoped.body.secret)
                .send({name: 'should fail'});
            expect(denied.statusCode).toBe(403);
            expect(denied.body.message).toBe('errors.rest.missingTokenRight');
        } finally {
            await request(server.http)
                .delete('/auth/api-tokens/' + scoped.body.token.id)
                .set('Cookie', cookie);
        }
    });
});
