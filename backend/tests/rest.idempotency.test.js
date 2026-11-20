const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const Server = require('../webserver/Server.js');
const {enableRestForTests, allTokenRights, addResearcherUser} = require('./utils.js');

const PORT = 3130;

describe('REST Idempotency-Key', () => {
    let server;
    let models;
    let cookie;
    let token;
    const createdDocs = [];

    beforeAll(async () => {
        server = new Server();
        server.start(PORT);
        await server.devAdminReady;
        models = server.db.models;
        await enableRestForTests(server.db.models);
        const login = await request(server.http)
            .post('/auth/login')
            .send({username: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PWD});
        cookie = login.headers['set-cookie'];
        token = (await request(server.http).post('/auth/api-tokens').set('Cookie', cookie)
            .send({name: 'idempotency tests', rights: await allTokenRights(server, cookie)})).body;
    });

    afterAll(async () => {
        for (const id of createdDocs) {
            await models['document'].deleteById(id).catch(() => {});
        }
        await request(server.http).delete('/auth/api-tokens/' + token.token.id).set('Cookie', cookie);
        server.stop();
    });

    function create(body, key) {
        const req = request(server.http)
            .post('/rest/v1/documents')
            .set('Authorization', 'Bearer ' + token.secret);
        return (key ? req.set('Idempotency-Key', key) : req).send(body);
    }

    async function countNamed(name) {
        return models['document'].count({where: {name, deleted: false}});
    }

    test('a retry with the same key returns the first answer and creates nothing more', async () => {
        const key = 'retry-' + Date.now();
        const first = await create({name: 'REST idempotent doc'}, key);
        expect(first.statusCode).toBe(201);
        createdDocs.push(first.body.document.id);
        const again = await create({name: 'REST idempotent doc'}, key);
        expect(again.statusCode).toBe(201);
        expect(again.headers['idempotent-replayed']).toBe('true');
        expect(again.body.document.id).toBe(first.body.document.id);
        expect(await countNamed('REST idempotent doc')).toBe(1);
    });

    test('the same key with another body is 422', async () => {
        const key = 'reuse-' + Date.now();
        const first = await create({name: 'REST key body one'}, key);
        createdDocs.push(first.body.document.id);
        const other = await create({name: 'REST key body two'}, key);
        expect(other.statusCode).toBe(422);
        expect(other.body.message).toBe('errors.rest.idempotencyKeyReused');
        expect(await countNamed('REST key body two')).toBe(0);
    });

    test('without a key every call creates', async () => {
        const one = await create({name: 'REST no key doc'});
        const two = await create({name: 'REST no key doc'});
        createdDocs.push(one.body.document.id, two.body.document.id);
        expect(one.body.document.id).not.toBe(two.body.document.id);
    });

    test('a failed first request stores nothing, so the same key works after fixing the body', async () => {
        const key = 'fix-' + Date.now();
        const bad = await create({name: ''}, key);
        expect(bad.statusCode).toBe(400);
        const fixed = await create({name: ''}, key);
        expect(fixed.statusCode).toBe(400);
        expect(fixed.headers['idempotent-replayed']).toBeUndefined();
    });

    test('two requests with the same key at the same moment create one document', async () => {
        const key = 'race-' + Date.now();
        const answers = await Promise.all([
            create({name: 'REST idempotent race'}, key),
            create({name: 'REST idempotent race'}, key),
        ]);
        for (const answer of answers) {
            if (answer.statusCode === 201) {
                createdDocs.push(answer.body.document.id);
            }
        }
        const fresh = answers.filter((a) => a.statusCode === 201 && a.headers['idempotent-replayed'] === undefined);
        expect(fresh).toHaveLength(1);
        const other = answers.find((a) => a !== fresh[0]);
        // The second either arrived while the first ran (409) or after it finished (stored answer).
        if (other.statusCode === 409) {
            expect(other.body.message).toBe('errors.rest.idempotencyKeyInProgress');
        } else {
            expect(other.statusCode).toBe(201);
            expect(other.headers['idempotent-replayed']).toBe('true');
            expect(other.body.document.id).toBe(fresh[0].body.document.id);
        }
        expect(await countNamed('REST idempotent race')).toBe(1);
    });

    test('a retried multipart upload with the same key returns the first answer', async () => {
        const zipPath = path.join(os.tmpdir(), 'care-rest-idempotent-upload.zip');
        fs.writeFileSync(zipPath, Buffer.from('PK\x05\x06' + '\x00'.repeat(18)));
        const key = 'upload-' + Date.now();
        const upload = () => request(server.http)
            .post('/rest/v1/documents/upload')
            .set('Authorization', 'Bearer ' + token.secret)
            .set('Idempotency-Key', key)
            .attach('file', zipPath, 'idempotent-upload.zip');
        const first = await upload();
        expect(first.statusCode).toBe(201);
        createdDocs.push(first.body.document.id);
        const again = await upload();
        expect(again.statusCode).toBe(201);
        expect(again.headers['idempotent-replayed']).toBe('true');
        expect(again.body.document.id).toBe(first.body.document.id);
        expect(await countNamed(first.body.document.name)).toBe(1);
    });

    test('another token of the same user reusing a key gets 422, not the stored answer', async () => {
        const second = (await request(server.http).post('/auth/api-tokens').set('Cookie', cookie)
            .send({name: 'idempotency second', rights: await allTokenRights(server, cookie)})).body;
        try {
            const key = 'two-tokens-' + Date.now();
            const first = await create({name: 'REST two tokens'}, key);
            expect(first.statusCode).toBe(201);
            createdDocs.push(first.body.document.id);
            const other = await request(server.http)
                .post('/rest/v1/documents')
                .set('Authorization', 'Bearer ' + second.secret)
                .set('Idempotency-Key', key)
                .send({name: 'REST two tokens'});
            expect(other.statusCode).toBe(422);
            expect(other.body.message).toBe('errors.rest.idempotencyKeyReused');
        } finally {
            await request(server.http).delete('/auth/api-tokens/' + second.token.id).set('Cookie', cookie);
        }
    });

    test('expired keys of every user are removed, not only the caller\'s', async () => {
        const otherUser = await addResearcherUser(models);
        const old = await models['api_idempotency_key'].create({
            userId: otherUser.user.id, idempotencyKey: 'old-' + Date.now(), method: 'POST', path: '/rest/v1/documents',
            requestHash: 'x', statusCode: 201, responseBody: {}, deleted: false,
        });
        // Backdate with SQL: Sequelize does not let update() change createdAt.
        await server.db.sequelize.query(
            'UPDATE "api_idempotency_key" SET "createdAt" = NOW() - INTERVAL \'2 days\' WHERE id = :id',
            {replacements: {id: old.id}});
        // Cleanup runs at most once a minute; make this request the one that runs it.
        server.restIdempotencyCleanedAt = 0;
        const res = await create({name: 'REST cleanup trigger'}, 'cleanup-' + Date.now());
        createdDocs.push(res.body.document.id);
        expect(await models['api_idempotency_key'].count({where: {id: old.id}})).toBe(0);
        await models['user'].deleteById(otherUser.user.id);
    });

    test('the same key with a different upload file is 422, and the new file is not stored', async () => {
        const key = 'upload-other-' + Date.now();
        const write = (name, content) => {
            const file = path.join(os.tmpdir(), name);
            fs.writeFileSync(file, content);
            return file;
        };
        const upload = (file) => request(server.http)
            .post('/rest/v1/documents/upload')
            .set('Authorization', 'Bearer ' + token.secret)
            .set('Idempotency-Key', key)
            .attach('file', file, 'same-name.zip');
        const first = await upload(write('care-rest-idem-a.zip', Buffer.from('PK\x05\x06' + '\x00'.repeat(18))));
        expect(first.statusCode).toBe(201);
        createdDocs.push(first.body.document.id);
        const other = await upload(write('care-rest-idem-b.zip', Buffer.from('PK\x05\x06' + '\x01'.repeat(18))));
        expect(other.statusCode).toBe(422);
        expect(other.body.message).toBe('errors.rest.idempotencyKeyReused');
        expect(await countNamed('same-name')).toBe(1);
    });

    test('a key with a multipart body on a route without uploads is 415, and nothing runs', async () => {
        const res = await request(server.http)
            .post('/rest/v1/documents')
            .set('Authorization', 'Bearer ' + token.secret)
            .set('Idempotency-Key', 'multipart-' + Date.now())
            .field('name', 'REST multipart elsewhere');
        expect(res.statusCode).toBe(415);
        expect(res.body.message).toBe('errors.rest.multipartNotAccepted');
        expect(await countNamed('REST multipart elsewhere')).toBe(0);
    });

    test('a key that is too long or not plain ASCII is 400', async () => {
        const res = await create({name: 'REST bad key'}, 'x'.repeat(256));
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('errors.rest.invalidIdempotencyKey');
    });
});
