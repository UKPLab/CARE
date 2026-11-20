const request = require('supertest');
const Server = require('../webserver/Server.js');
const {addResearcherUser, enableRestForTests, allTokenRights} = require('./utils.js');

const PORT = 3127;
const SETTING = 'system.auth.apiTokens.enabled';
const SUBMISSIONS_VIEW = 'frontend.dashboard.submissions.view';
const DOCUMENTS_VIEW = 'frontend.dashboard.documents.view';

describe('REST submissions and document notes', () => {
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
        full = await mint({name: 'submission full'});
        narrow = await mint({name: 'submission narrow', rights: [SUBMISSIONS_VIEW, DOCUMENTS_VIEW]});

        other = (await addResearcherUser(models)).user;
        rows.own = await models['submission'].add({name: 'own submission', userId: adminId, createdByUserId: adminId});
        rows.theirs = await models['submission'].add({name: 'their submission', userId: other.id, createdByUserId: other.id});
        rows.doc = await models['document'].add({name: 'notes document', type: 1, userId: adminId, public: true});
        rows.tagSet = await models['tag_set'].add({name: 'notes tags', userId: adminId, public: false});
        rows.tag = await models['tag'].add({name: 'note', colorCode: 'info', userId: adminId, tagSetId: rows.tagSet.id, public: false});
        rows.ownAnnotation = await models['annotation'].add({
            documentId: rows.doc.id, userId: adminId, text: 'mine', selectors: {}, draft: false, tagId: rows.tag.id,
        });
        rows.theirAnnotation = await models['annotation'].add({
            documentId: rows.doc.id, userId: other.id, text: 'theirs', selectors: {}, draft: false, tagId: rows.tag.id,
        });
        rows.ownComment = await models['comment'].add({
            documentId: rows.doc.id, userId: adminId, text: 'my comment', annotationId: rows.ownAnnotation.id, draft: false,
        });
        rows.theirComment = await models['comment'].add({
            documentId: rows.doc.id, userId: other.id, text: 'their comment', annotationId: rows.theirAnnotation.id, draft: false,
        });
    });

    afterAll(async () => {
        for (const [model, keys] of [
            ['comment', ['ownComment', 'theirComment']],
            ['annotation', ['ownAnnotation', 'theirAnnotation']],
            ['tag', ['tag']],
            ['tag_set', ['tagSet']],
            ['document', ['doc']],
            ['submission', ['own', 'theirs']],
        ]) {
            for (const key of keys) {
                if (rows[key]) {
                    await models[model].deleteById(rows[key].id).catch(() => {});
                }
            }
        }
        await models['user'].deleteById(other.id);
        for (const token of [full, narrow]) {
            await request(server.http).delete('/auth/api-tokens/' + token.token.id).set('Cookie', cookie);
        }
        server.stop();
    });

    function call(method, path, body, token = full) {
        const req = request(server.http)[method](path).set('Authorization', 'Bearer ' + token.secret);
        return body === undefined ? req : req.send(body);
    }

    describe('submissions', () => {
        test('the full token lists and gets every submission', async () => {
            const listed = await call('get', '/rest/v1/submissions');
            expect(listed.statusCode).toBe(200);
            const ids = listed.body.submissions.map((row) => row.id);
            expect(ids).toEqual(expect.arrayContaining([rows.own.id, rows.theirs.id]));
            const got = await call('get', '/rest/v1/submissions/' + rows.theirs.id);
            expect(got.statusCode).toBe(200);
            expect(Array.isArray(got.body.submission.documents)).toBe(true);
        });

        test('a narrow token reaches only its owner submissions', async () => {
            const listed = await call('get', '/rest/v1/submissions', undefined, narrow);
            const ids = listed.body.submissions.map((row) => row.id);
            expect(ids).toContain(rows.own.id);
            expect(ids).not.toContain(rows.theirs.id);
            const got = await call('get', '/rest/v1/submissions/' + rows.theirs.id, undefined, narrow);
            expect(got.statusCode).toBe(403);
            expect(got.body.message).toBe('errors.rest.submissionNoAccess');
            const deleted = await call('delete', '/rest/v1/submissions/' + rows.theirs.id, undefined, narrow);
            expect(deleted.statusCode).toBe(403);
        });

        test('unknown submission is 404, and delete removes an own submission', async () => {
            expect((await call('get', '/rest/v1/submissions/99999999')).statusCode).toBe(404);
            expect((await call('delete', '/rest/v1/submissions/nope')).statusCode).toBe(404);
            const deleted = await call('delete', '/rest/v1/submissions/' + rows.own.id);
            expect(deleted.statusCode).toBe(200);
            expect((await call('get', '/rest/v1/submissions/' + rows.own.id)).statusCode).toBe(404);
        });
    });

    describe('annotations and comments', () => {
        test('the full token reads every annotation and comment of a document', async () => {
            const annotations = await call('get', `/rest/v1/documents/${rows.doc.id}/annotations`);
            expect(annotations.statusCode).toBe(200);
            expect(annotations.body.annotations.map((row) => row.id))
                .toEqual(expect.arrayContaining([rows.ownAnnotation.id, rows.theirAnnotation.id]));
            const comments = await call('get', `/rest/v1/documents/${rows.doc.hash}/comments`);
            expect(comments.body.comments.map((row) => row.id))
                .toEqual(expect.arrayContaining([rows.ownComment.id, rows.theirComment.id]));
        });

        test('a narrow token reads only its owner notes', async () => {
            const annotations = await call('get', `/rest/v1/documents/${rows.doc.id}/annotations`, undefined, narrow);
            expect(annotations.statusCode).toBe(200);
            expect(annotations.body.annotations.map((row) => row.id)).toEqual([rows.ownAnnotation.id]);
            const comments = await call('get', `/rest/v1/documents/${rows.doc.id}/comments`, undefined, narrow);
            expect(comments.body.comments.map((row) => row.id)).toEqual([rows.ownComment.id]);
        });

        test('an unknown document is 404', async () => {
            expect((await call('get', '/rest/v1/documents/99999999/annotations')).statusCode).toBe(404);
        });

        test('another user\'s anonymous note comes back without its author; an own one keeps it', async () => {
            const added = {
                theirs: await models['annotation'].add({
                    documentId: rows.doc.id, userId: other.id, text: 'anon theirs', selectors: {}, draft: false,
                    tagId: rows.tag.id, anonymous: true,
                }),
                mine: await models['annotation'].add({
                    documentId: rows.doc.id, userId: adminId, text: 'anon mine', selectors: {}, draft: false,
                    tagId: rows.tag.id, anonymous: true,
                }),
            };
            added.theirComment = await models['comment'].add({
                documentId: rows.doc.id, userId: other.id, text: 'anon comment', annotationId: added.theirs.id,
                draft: false, anonymous: true,
            });
            try {
                const annotations = (await call('get', `/rest/v1/documents/${rows.doc.id}/annotations`)).body.annotations;
                expect(annotations.find((row) => row.id === added.theirs.id).userId).toBeNull();
                expect(annotations.find((row) => row.id === added.mine.id).userId).toBe(adminId);
                // A note that is not anonymous keeps its author.
                expect(annotations.find((row) => row.id === rows.theirAnnotation.id).userId).toBe(other.id);
                const comments = (await call('get', `/rest/v1/documents/${rows.doc.id}/comments`)).body.comments;
                expect(comments.find((row) => row.id === added.theirComment.id).userId).toBeNull();
            } finally {
                await models['comment'].deleteById(added.theirComment.id).catch(() => {});
                await models['annotation'].deleteById(added.theirs.id).catch(() => {});
                await models['annotation'].deleteById(added.mine.id).catch(() => {});
            }
        });
    });
});
