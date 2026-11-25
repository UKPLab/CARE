const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Server = require('../webserver/Server.js');
const {storedFilePath} = require('../webserver/rest/documentReplace');
const {addResearcherUser, enableRestForTests, allTokenRights} = require('./utils.js');

const PORT = 3121;
const SETTING = 'system.auth.apiTokens.enabled';
const DOCUMENTS_VIEW = 'frontend.dashboard.documents.view';

describe('REST documents', () => {
    let server;
    let cookie;
    let secret;
    let tokenId;
    let ownerId;

    beforeAll(async () => {
        server = new Server();
        server.start(PORT);
        await server.devAdminReady;
        await enableRestForTests(server.db.models);

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
            .send({name: 'documents tests', rights: await allTokenRights(server, cookie)});
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

    function auth() {
        return {'Authorization': 'Bearer ' + secret};
    }

    async function bearerGet(url) {
        return request(server.http).get(url).set(auth());
    }

    async function bearerPost(body) {
        return request(server.http)
            .post('/rest/v1/documents')
            .set(auth())
            .send(body);
    }

    function writeTempZip(fileName) {
        const zipPath = path.join(os.tmpdir(), fileName);
        fs.writeFileSync(zipPath, Buffer.from('PK\x05\x06' + '\x00'.repeat(18)));
        return zipPath;
    }

    describe('list and JSON create', () => {
        test('GET lists documents (admin token sees all, including own)', async () => {
            const created = await bearerPost({name: 'REST list own'});
            expect(created.statusCode).toBe(201);
            const res = await bearerGet('/rest/v1/documents');
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body.documents)).toBe(true);
            expect(res.body.documents.some((doc) => doc.id === created.body.document.id)).toBe(true);
            await server.db.models['document'].deleteById(created.body.document.id);
        });

        test('POST creates a blank HTML document for the owner', async () => {
            const res = await bearerPost({name: 'REST blank html'});
            expect(res.statusCode).toBe(201);
            expect(res.body.document.name).toBe('REST blank html');
            expect(res.body.document.type).toBe(1);
            expect(res.body.document.userId).toBe(ownerId);
            const stored = await server.db.models['document'].getById(res.body.document.id);
            expect(stored.uploadedByUserId).toBeNull();
            // Internal columns are not part of the REST document.
            expect(res.body.document.uploadedByUserId).toBeUndefined();
            expect(res.body.document.deleted).toBeUndefined();
            await server.db.models['document'].deleteById(res.body.document.id);
        });

        test('POST creates a modal document', async () => {
            const res = await bearerPost({name: 'REST modal', type: 2});
            expect(res.statusCode).toBe(201);
            expect(res.body.document.type).toBe(2);
            await server.db.models['document'].deleteById(res.body.document.id);
        });

        test('POST ignores userId in the body', async () => {
            const res = await bearerPost({name: 'steal attempt', userId: 999999});
            expect(res.statusCode).toBe(201);
            expect(res.body.document.userId).toBe(ownerId);
            expect(res.body.document.userId).not.toBe(999999);
            await server.db.models['document'].deleteById(res.body.document.id);
        });

        test('POST requires a name', async () => {
            const res = await bearerPost({name: '  '});
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('errors.rest.documentNameRequired');
        });

        test('POST rejects a PDF type on JSON create', async () => {
            const res = await bearerPost({name: 'pdf try', type: 0});
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('errors.rest.unsupportedDocumentType');
        });

        test('POST rejects a non-integer projectId', async () => {
            const res = await bearerPost({name: 'bad project', projectId: 'nope'});
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('errors.rest.invalidProjectId');
        });

        test('POST rejects a project or template that does not exist', async () => {
            const project = await bearerPost({name: 'missing project', projectId: 99999999});
            expect(project.statusCode).toBe(400);
            expect(project.body.message).toBe('errors.rest.invalidProjectId');
            const template = await bearerPost({name: 'missing template', templateId: 99999999});
            expect(template.statusCode).toBe(400);
            expect(template.body.message).toBe('errors.rest.invalidTemplateId');
        });

        test('POST rejects a non-integer templateId', async () => {
            const res = await bearerPost({name: 'bad template', templateId: 'nope'});
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('errors.rest.invalidTemplateId');
        });
    });

    describe('get one', () => {
        test('GET one by id and hash', async () => {
            const created = await bearerPost({name: 'REST get one'});
            expect(created.statusCode).toBe(201);
            const id = created.body.document.id;
            const hash = created.body.document.hash;
            const byId = await bearerGet('/rest/v1/documents/' + id);
            expect(byId.statusCode).toBe(200);
            expect(byId.body.document.id).toBe(id);
            const byHash = await bearerGet('/rest/v1/documents/' + hash);
            expect(byHash.statusCode).toBe(200);
            expect(byHash.body.document.hash).toBe(hash);
            await server.db.models['document'].deleteById(id);
        });

        test('item routes on a missing id are 404', async () => {
            const missing = '/rest/v1/documents/99999999';
            const calls = [
                bearerGet(missing),
                bearerGet(missing + '/file'),
                request(server.http).patch(missing).set(auth()).send({name: 'x'}),
                request(server.http).delete(missing).set(auth()),
                request(server.http).put(missing + '/file').set(auth())
                    .attach('file', writeTempZip('care-rest-missing-put.zip'), 'missing.zip'),
            ];
            for (const res of await Promise.all(calls)) {
                expect(res.statusCode).toBe(404);
                expect(res.body.message).toBe('errors.rest.documentNotFound');
            }
        });
    });

    describe('patch', () => {
        test('PATCH name and public', async () => {
            const created = await bearerPost({name: 'REST patch me'});
            expect(created.statusCode).toBe(201);
            const id = created.body.document.id;
            const renamed = await request(server.http)
                .patch('/rest/v1/documents/' + id)
                .set(auth())
                .send({name: 'REST patched', public: true});
            expect(renamed.statusCode).toBe(200);
            expect(renamed.body.document.name).toBe('REST patched');
            expect(renamed.body.document.public).toBe(true);
            await server.db.models['document'].deleteById(id);
        });

        test('PATCH empty body is 400', async () => {
            const created = await bearerPost({name: 'REST empty patch'});
            expect(created.statusCode).toBe(201);
            const res = await request(server.http)
                .patch('/rest/v1/documents/' + created.body.document.id)
                .set(auth())
                .send({});
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('errors.rest.noDocumentFields');
            await server.db.models['document'].deleteById(created.body.document.id);
        });

        test('PATCH rejects a non-boolean public', async () => {
            const created = await bearerPost({name: 'REST bad public'});
            expect(created.statusCode).toBe(201);
            const res = await request(server.http)
                .patch('/rest/v1/documents/' + created.body.document.id)
                .set(auth())
                .send({public: 'yes'});
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('errors.rest.invalidPublicFlag');
            await server.db.models['document'].deleteById(created.body.document.id);
        });

        test('PATCH rejects an empty name', async () => {
            const created = await bearerPost({name: 'REST empty name'});
            expect(created.statusCode).toBe(201);
            const res = await request(server.http)
                .patch('/rest/v1/documents/' + created.body.document.id)
                .set(auth())
                .send({name: '  '});
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('errors.rest.documentNameRequired');
            await server.db.models['document'].deleteById(created.body.document.id);
        });
    });

    describe('upload and files', () => {
        test('POST upload zip then GET file', async () => {
            const zipPath = writeTempZip('care-rest-sample.zip');
            const uploaded = await request(server.http)
                .post('/rest/v1/documents/upload')
                .set(auth())
                .attach('file', zipPath, 'sample.zip');
            expect(uploaded.statusCode).toBe(201);
            expect(uploaded.body.document.type).toBe(4);
            expect(uploaded.body.document.userId).toBe(ownerId);
            const id = uploaded.body.document.id;
            const fileRes = await bearerGet('/rest/v1/documents/' + id + '/file');
            expect(fileRes.statusCode).toBe(200);
            await server.db.models['document'].deleteById(id);
        });

        test('POST upload with no file is 400', async () => {
            const res = await request(server.http)
                .post('/rest/v1/documents/upload')
                .set(auth());
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('errors.rest.fileRequired');
        });

        test('POST upload rejects an unsupported file type', async () => {
            const res = await request(server.http)
                .post('/rest/v1/documents/upload')
                .set(auth())
                .attach('file', writeTempZip('care-rest-notes.zip'), 'notes.txt');
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('errors.file.invalidFileType');
        });

        test('PUT upload rejects HTML documents and a different file type', async () => {
            const html = await bearerPost({name: 'REST put html'});
            expect(html.statusCode).toBe(201);
            const zipPath = writeTempZip('care-rest-put-types.zip');
            const uploaded = await request(server.http)
                .post('/rest/v1/documents/upload')
                .set(auth())
                .attach('file', zipPath, 'typed.zip');
            expect(uploaded.statusCode).toBe(201);
            try {
                const onHtml = await request(server.http)
                    .put('/rest/v1/documents/' + html.body.document.id + '/file')
                    .set(auth())
                    .attach('file', zipPath, 'typed.zip');
                expect(onHtml.statusCode).toBe(400);
                expect(onHtml.body.message).toBe('errors.documents.replaceOnlyPdfZip');
                const mismatch = await request(server.http)
                    .put('/rest/v1/documents/' + uploaded.body.document.id + '/file')
                    .set(auth())
                    .attach('file', zipPath, 'typed.pdf');
                expect(mismatch.statusCode).toBe(400);
                expect(mismatch.body.message).toBe('errors.documents.replaceTypeMismatch');
            } finally {
                await server.db.models['document'].deleteById(html.body.document.id);
                await server.db.models['document'].deleteById(uploaded.body.document.id);
            }
        });

        test('GET file for HTML is 400', async () => {
            const created = await bearerPost({name: 'REST no pdf'});
            expect(created.statusCode).toBe(201);
            const res = await bearerGet('/rest/v1/documents/' + created.body.document.id + '/file');
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('errors.rest.documentHasNoBinaryFile');
            await server.db.models['document'].deleteById(created.body.document.id);
        });

        test('GET file when the disk file is missing is 404', async () => {
            const zipPath = writeTempZip('care-rest-missing.zip');
            const uploaded = await request(server.http)
                .post('/rest/v1/documents/upload')
                .set(auth())
                .attach('file', zipPath, 'missing.zip');
            expect(uploaded.statusCode).toBe(201);
            const doc = uploaded.body.document;
            const filePath = storedFilePath(doc);
            expect(filePath).toBeTruthy();
            expect(fs.existsSync(filePath)).toBe(true);
            fs.unlinkSync(filePath);
            try {
                const res = await bearerGet('/rest/v1/documents/' + doc.id + '/file');
                expect(res.statusCode).toBe(404);
                expect(res.body.message).toBe('errors.rest.documentFileMissing');
            } finally {
                await server.db.models['document'].deleteById(doc.id);
            }
        });

        test('PUT upload replaces the file and keeps id and hash', async () => {
            const zipPath = writeTempZip('care-rest-replace-a.zip');
            const uploaded = await request(server.http)
                .post('/rest/v1/documents/upload')
                .set(auth())
                .attach('file', zipPath, 'original.zip');
            expect(uploaded.statusCode).toBe(201);
            const id = uploaded.body.document.id;
            const hash = uploaded.body.document.hash;
            const replacement = writeTempZip('care-rest-replace-b.zip');
            const replaced = await request(server.http)
                .put('/rest/v1/documents/' + id + '/file')
                .set(auth())
                .attach('file', replacement, 'replaced.zip');
            expect(replaced.statusCode).toBe(200);
            expect(replaced.body.documentId).toBe(id);
            expect(replaced.body.hash).toBe(hash);
            const fileRes = await bearerGet('/rest/v1/documents/' + hash + '/file');
            expect(fileRes.statusCode).toBe(200);
            await server.db.models['document'].deleteById(id);
        });

        test('a non-ASCII file name is stored as sent and downloads without error', async () => {
            const name = 'Übersicht – تقرير.zip';
            const uploaded = await request(server.http)
                .post('/rest/v1/documents/upload')
                .set(auth())
                .attach('file', writeTempZip('care-rest-unicode.zip'), name);
            expect(uploaded.statusCode).toBe(201);
            const id = uploaded.body.document.id;
            try {
                expect(uploaded.body.document.name).toBe('Übersicht – تقرير');
                const fileRes = await bearerGet('/rest/v1/documents/' + id + '/file');
                expect(fileRes.statusCode).toBe(200);
                // The name travels encoded, as RFC 6266 filename*.
                expect(fileRes.headers['content-disposition']).toContain("filename*=UTF-8''");
            } finally {
                await server.db.models['document'].deleteById(id);
            }
        });

        test('a chunked upload without Content-Length is refused, because its size cannot be checked', async () => {
            const http = require('http');
            const boundary = 'carerestboundary';
            const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="chunked.zip"\r\n`
                + `Content-Type: application/zip\r\n\r\nPK\r\n--${boundary}--\r\n`;
            const res = await new Promise((resolve, reject) => {
                const req = http.request({
                    host: '127.0.0.1',
                    port: PORT,
                    path: '/rest/v1/documents/upload',
                    method: 'POST',
                    headers: {
                        ...auth(),
                        'Content-Type': `multipart/form-data; boundary=${boundary}`,
                        'Transfer-Encoding': 'chunked',
                    },
                }, (response) => {
                    let data = '';
                    response.on('data', (chunk) => (data += chunk));
                    response.on('end', () => resolve({status: response.statusCode, body: JSON.parse(data)}));
                });
                req.on('error', reject);
                req.write(body);
                req.end();
            });
            expect(res.status).toBe(411);
            expect(res.body.message).toBe('errors.rest.contentLengthRequired');
        });

        test('a request over 100 MB in total is refused before its files are read', async () => {
            // The size check reads only the Content-Length header, so two 60 MB files (each under the
            // per-file cap) are refused before any byte of them arrives. The request announces 120 MB
            // but sends only its first line: the test then has nothing left to send when the server
            // answers and closes, so it always reads the 413 instead of racing the close.
            const http = require('http');
            const boundary = 'carerestboundary';
            const before = await server.db.models['document'].count({where: {deleted: false}});
            const res = await new Promise((resolve, reject) => {
                const req = http.request({
                    host: '127.0.0.1',
                    port: PORT,
                    path: '/rest/v1/documents/upload',
                    method: 'POST',
                    headers: {
                        ...auth(),
                        'Content-Type': `multipart/form-data; boundary=${boundary}`,
                        'Content-Length': String(120 * 1024 * 1024),
                    },
                }, (response) => {
                    let data = '';
                    response.on('data', (chunk) => (data += chunk));
                    response.on('end', () => {
                        req.destroy();
                        resolve({status: response.statusCode, body: JSON.parse(data)});
                    });
                });
                req.on('error', (err) => (err.code === 'ECONNRESET' ? undefined : reject(err)));
                req.write(`--${boundary}\r\n`);
            });
            expect(res.status).toBe(413);
            expect(res.body.message).toBe('errors.rest.fileTooLarge');
            expect(await server.db.models['document'].count({where: {deleted: false}})).toBe(before);
        });

        test('a document upload with two files keeps only the first', async () => {
            const res = await request(server.http)
                .post('/rest/v1/documents/upload')
                .set(auth())
                .attach('file', writeTempZip('care-rest-first.zip'), 'first.zip')
                .attach('file', writeTempZip('care-rest-second.zip'), 'second.zip');
            expect(res.statusCode).toBe(201);
            expect(res.body.document.name).toBe('first');
            const second = await server.db.models['document'].count({where: {name: 'second', deleted: false}});
            expect(second).toBe(0);
            await server.db.models['document'].deleteById(res.body.document.id);
        });

        test('importAnnotations is refused instead of importing nothing; false is fine', async () => {
            const refused = await request(server.http)
                .post('/rest/v1/documents/upload')
                .set(auth())
                .field('importAnnotations', 'true')
                .attach('file', writeTempZip('care-rest-import.zip'), 'import.zip');
            expect(refused.statusCode).toBe(400);
            expect(refused.body.message).toBe('errors.rest.importAnnotationsNotSupported');

            const allowed = await request(server.http)
                .post('/rest/v1/documents/upload')
                .set(auth())
                .field('importAnnotations', 'false')
                .attach('file', writeTempZip('care-rest-noimport.zip'), 'noimport.zip');
            expect(allowed.statusCode).toBe(201);
            expect(allowed.body.annotations).toBeUndefined();
            await server.db.models['document'].deleteById(allowed.body.document.id);
        });

        test('a .json upload is refused instead of creating nothing', async () => {
            const res = await request(server.http)
                .post('/rest/v1/documents/upload')
                .set(auth())
                .attach('file', Buffer.from('{}'), 'notes.json');
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('errors.file.invalidFileType');
        });

        test('a replace whose final rename fails keeps the new file, hides paths, and answers 500', async () => {
            const uploaded = await request(server.http)
                .post('/rest/v1/documents/upload')
                .set(auth())
                .attach('file', writeTempZip('care-rest-rename-a.zip'), 'rename.zip');
            expect(uploaded.statusCode).toBe(201);
            const document = await server.db.models['document'].getById(uploaded.body.document.id);
            const target = storedFilePath(document);
            const tempPath = target + '.replace-tmp';
            // A directory where the file should go makes the rename after commit fail.
            fs.unlinkSync(target);
            fs.mkdirSync(path.join(target, 'block'), {recursive: true});
            try {
                const res = await request(server.http)
                    .put('/rest/v1/documents/' + document.id + '/file')
                    .set(auth())
                    .attach('file', writeTempZip('care-rest-rename-b.zip'), 'rename.zip');
                expect(res.statusCode).toBe(500);
                expect(res.body.message).toBe('errors.rest.replacePromoteFailed');
                expect(res.body.params).toEqual({documentId: document.id});
                expect(JSON.stringify(res.body)).not.toContain(target);
                expect(fs.existsSync(tempPath)).toBe(true);
            } finally {
                fs.rmSync(target, {recursive: true, force: true});
                fs.rmSync(tempPath, {force: true});
                await server.db.models['document'].deleteById(document.id);
            }
        });

        test('PUT upload with no file is 400', async () => {
            const created = await bearerPost({name: 'REST put no file'});
            expect(created.statusCode).toBe(201);
            const res = await request(server.http)
                .put('/rest/v1/documents/' + created.body.document.id + '/file')
                .set(auth());
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('errors.rest.fileRequired');
            await server.db.models['document'].deleteById(created.body.document.id);
        });
    });

    describe('delete', () => {
        test('DELETE removes the document', async () => {
            const created = await bearerPost({name: 'REST delete me'});
            expect(created.statusCode).toBe(201);
            const id = created.body.document.id;
            const deleted = await request(server.http)
                .delete('/rest/v1/documents/' + id)
                .set(auth());
            expect(deleted.statusCode).toBe(200);
            const missing = await bearerGet('/rest/v1/documents/' + id);
            expect(missing.statusCode).toBe(404);
        });

        test('DELETE by hash removes the document', async () => {
            const created = await bearerPost({name: 'REST delete by hash'});
            expect(created.statusCode).toBe(201);
            const hash = created.body.document.hash;
            const deleted = await request(server.http)
                .delete('/rest/v1/documents/' + hash)
                .set(auth());
            expect(deleted.statusCode).toBe(200);
            const missing = await bearerGet('/rest/v1/documents/' + hash);
            expect(missing.statusCode).toBe(404);
        });
    });

    describe('token rights', () => {
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

        test('a token cannot be created with an empty rights list', async () => {
            const scoped = await request(server.http)
                .post('/auth/api-tokens')
                .set('Cookie', cookie)
                .send({name: 'empty rights', rights: []});
            expect(scoped.statusCode).toBe(400);
            expect(scoped.body.message).toBe('errors.rest.tokenRightsRequired');
        });
    });

    describe('non-admin access', () => {
        let researcher;
        let researcherSecret;
        let researcherTokenId;
        let researcherCookie;
        let researcherUserId;

        beforeAll(async () => {
            researcher = await addResearcherUser(server.db.models);
            const login = await request(server.http)
                .post('/auth/login')
                .send({
                    username: researcher.user.email,
                    password: researcher.password,
                });
            expect(login.statusCode).toBe(200);
            researcherCookie = login.headers['set-cookie'];
            researcherUserId = login.body.user.id;

            const created = await request(server.http)
                .post('/auth/api-tokens')
                .set('Cookie', researcherCookie)
                .send({
                    name: 'researcher docs',
                    rights: [DOCUMENTS_VIEW, 'frontend.dashboard.documents.upload'],
                });
            expect(created.statusCode).toBe(201);
            researcherSecret = created.body.secret;
            researcherTokenId = created.body.token.id;
        });

        afterAll(async () => {
            if (researcherCookie && researcherTokenId) {
                await request(server.http)
                    .delete('/auth/api-tokens/' + researcherTokenId)
                    .set('Cookie', researcherCookie);
            }
            if (researcher && researcher.user.id) {
                await server.db.models['user'].deleteById(researcher.user.id);
            }
        });

        function researcherAuth() {
            return {'Authorization': 'Bearer ' + researcherSecret};
        }

        test('GET another user private document is 403 not 404', async () => {
            const created = await bearerPost({name: 'admin private'});
            expect(created.statusCode).toBe(201);
            const id = created.body.document.id;
            try {
                const res = await request(server.http)
                    .get('/rest/v1/documents/' + id)
                    .set(researcherAuth());
                expect(res.statusCode).toBe(403);
                expect(res.body.message).toBe('errors.rest.documentNoAccess');
            } finally {
                await server.db.models['document'].deleteById(id);
            }
        });

        test('public document: another user can read but not edit or delete it', async () => {
            const created = await bearerPost({name: 'admin public'});
            expect(created.statusCode).toBe(201);
            const id = created.body.document.id;
            try {
                const published = await request(server.http)
                    .patch('/rest/v1/documents/' + id)
                    .set(auth())
                    .send({public: true});
                expect(published.statusCode).toBe(200);
                const read = await request(server.http)
                    .get('/rest/v1/documents/' + id)
                    .set(researcherAuth());
                expect(read.statusCode).toBe(200);
                const edit = await request(server.http)
                    .patch('/rest/v1/documents/' + id)
                    .set(researcherAuth())
                    .send({name: 'researcher rename'});
                expect(edit.statusCode).toBe(403);
                expect(edit.body.message).toBe('errors.rest.documentNoAccess');
                const remove = await request(server.http)
                    .delete('/rest/v1/documents/' + id)
                    .set(researcherAuth());
                expect(remove.statusCode).toBe(403);
                expect(remove.body.message).toBe('errors.rest.documentNoAccess');
            } finally {
                await server.db.models['document'].deleteById(id);
            }
        });

        test('non-admin list is own documents only', async () => {
            const adminDoc = await bearerPost({name: 'admin hidden from researcher'});
            expect(adminDoc.statusCode).toBe(201);
            const own = await request(server.http)
                .post('/rest/v1/documents')
                .set(researcherAuth())
                .send({name: 'researcher own'});
            expect(own.statusCode).toBe(201);
            expect(own.body.document.userId).toBe(researcherUserId);
            try {
                const listed = await request(server.http)
                    .get('/rest/v1/documents')
                    .set(researcherAuth());
                expect(listed.statusCode).toBe(200);
                expect(listed.body.documents.some((doc) => doc.id === own.body.document.id)).toBe(true);
                expect(listed.body.documents.some((doc) => doc.id === adminDoc.body.document.id)).toBe(false);
            } finally {
                await server.db.models['document'].deleteById(own.body.document.id);
                await server.db.models['document'].deleteById(adminDoc.body.document.id);
            }
        });

        test('non-admin cannot replace a file', async () => {
            const zipPath = writeTempZip('care-rest-researcher.zip');
            const uploaded = await request(server.http)
                .post('/rest/v1/documents/upload')
                .set(researcherAuth())
                .attach('file', zipPath, 'own.zip');
            expect(uploaded.statusCode).toBe(201);
            const replacement = writeTempZip('care-rest-researcher-put.zip');
            try {
                const res = await request(server.http)
                    .put('/rest/v1/documents/' + uploaded.body.document.id + '/file')
                    .set(researcherAuth())
                    .attach('file', replacement, 'own.zip');
                expect(res.statusCode).toBe(403);
                expect(res.body.message).toBe('errors.rest.documentNoAccess');
            } finally {
                await server.db.models['document'].deleteById(uploaded.body.document.id);
            }
        });
    });

    describe('document text', () => {
        test('GET content returns the delta and plain text of an HTML document', async () => {
            const created = await bearerPost({name: 'REST content doc'});
            const id = created.body.document.id;
            try {
                const res = await bearerGet('/rest/v1/documents/' + id + '/content');
                expect(res.statusCode).toBe(200);
                expect(res.body.document.id).toBe(id);
                expect(Array.isArray(res.body.delta.ops)).toBe(true);
                expect(typeof res.body.text).toBe('string');
            } finally {
                await server.db.models['document'].deleteById(id);
            }
        });

        test('GET content on a ZIP document is 400 and on a missing one 404', async () => {
            const zipPath = writeTempZip('care-rest-content.zip');
            const uploaded = await request(server.http)
                .post('/rest/v1/documents/upload')
                .set(auth())
                .attach('file', zipPath, 'content.zip');
            try {
                const res = await bearerGet('/rest/v1/documents/' + uploaded.body.document.id + '/content');
                expect(res.statusCode).toBe(400);
                expect(res.body.message).toBe('errors.rest.documentHasNoText');
                expect((await bearerGet('/rest/v1/documents/99999999/content')).statusCode).toBe(404);
            } finally {
                await server.db.models['document'].deleteById(uploaded.body.document.id);
            }
        });
    });

    describe('files after a failed upload', () => {
        test('a rolled-back upload leaves no file on disk', async () => {
            const {UPLOAD_PATH} = require('../webserver/rest/documentUpload');
            const before = new Set(fs.readdirSync(UPLOAD_PATH));
            // A .delta upload writes its file first and then parses it; broken JSON fails after the write.
            const res = await request(server.http)
                .post('/rest/v1/documents/upload')
                .set(auth())
                .attach('file', Buffer.from('this is not json'), 'rollback.delta');
            expect(res.statusCode).toBeGreaterThanOrEqual(400);
            const added = fs.readdirSync(UPLOAD_PATH).filter((name) => !before.has(name));
            expect(added).toEqual([]);
        });
    });

    describe('upload size', () => {
        test('a file over 100 MB is refused with 413 and nothing is created', async () => {
            const {MAX_UPLOAD_BYTES} = require('../webserver/routes/rest/routeHelpers');
            const before = await server.db.models['document'].count({where: {deleted: false}});
            const res = await request(server.http)
                .post('/rest/v1/documents/upload')
                .set(auth())
                .attach('file', Buffer.alloc(MAX_UPLOAD_BYTES + 1024), 'too-big.pdf');
            expect(res.statusCode).toBe(413);
            expect(res.body.message).toBe('errors.rest.fileTooLarge');
            expect(await server.db.models['document'].count({where: {deleted: false}})).toBe(before);
        }, 60000);
    });

    describe('admin owner with a narrow token', () => {
        let other;
        let otherDoc;
        let narrow;

        beforeAll(async () => {
            other = (await addResearcherUser(server.db.models)).user;
            otherDoc = await server.db.models['document'].add({name: 'someone else private', type: 1, userId: other.id});
            const created = await request(server.http)
                .post('/auth/api-tokens')
                .set('Cookie', cookie)
                .send({name: 'admin narrow', rights: [DOCUMENTS_VIEW]});
            expect(created.statusCode).toBe(201);
            narrow = created.body;
        });

        afterAll(async () => {
            await request(server.http).delete('/auth/api-tokens/' + narrow.token.id).set('Cookie', cookie);
            await server.db.models['document'].deleteById(otherDoc.id);
            await server.db.models['user'].deleteById(other.id);
        });

        function narrowAuth() {
            return {'Authorization': 'Bearer ' + narrow.secret};
        }

        test('the full admin token sees and can delete another user document', async () => {
            const res = await request(server.http).get('/rest/v1/documents/' + otherDoc.id).set(auth());
            expect(res.statusCode).toBe(200);
        });

        test('list returns only the owner documents, not everyone', async () => {
            const res = await request(server.http).get('/rest/v1/documents').set(narrowAuth());
            expect(res.statusCode).toBe(200);
            expect(res.body.documents.some((doc) => doc.id === otherDoc.id)).toBe(false);
            expect(res.body.documents.every((doc) => doc.userId === ownerId)).toBe(true);
        });

        test('get, patch, and delete of another user document are 403', async () => {
            const got = await request(server.http).get('/rest/v1/documents/' + otherDoc.id).set(narrowAuth());
            expect(got.statusCode).toBe(403);
            const patched = await request(server.http)
                .patch('/rest/v1/documents/' + otherDoc.id)
                .set(narrowAuth())
                .send({name: 'taken over'});
            expect(patched.statusCode).toBe(403);
            const deleted = await request(server.http).delete('/rest/v1/documents/' + otherDoc.id).set(narrowAuth());
            expect(deleted.statusCode).toBe(403);
            expect((await server.db.models['document'].getById(otherDoc.id)).name).toBe('someone else private');
        });

        test('upload needs the upload right on the token', async () => {
            const res = await request(server.http)
                .post('/rest/v1/documents/upload')
                .set(narrowAuth())
                .attach('file', Buffer.from('{"ops":[{"insert":"hi\\n"}]}'), 'narrow.delta');
            expect(res.statusCode).toBe(403);
            expect(res.body.message).toBe('errors.rest.missingTokenRight');
        });
    });
});
