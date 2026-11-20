const request = require('supertest');
const yaml = require('js-yaml');
const Server = require('../webserver/Server.js');
const {addResearcherUser, enableRestForTests, allTokenRights} = require('./utils.js');

const PORT = 3122;
const SETTING = 'system.auth.apiTokens.enabled';
const STUDIES_VIEW = 'frontend.dashboard.studies.view';

describe('REST studies', () => {
    let server;
    let cookie;
    let secret;
    let tokenId;
    let ownerId;
    let workflow;
    let template;

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
            .send({name: 'studies tests', rights: await allTokenRights(server, cookie)});
        expect(created.statusCode).toBe(201);
        secret = created.body.secret;
        tokenId = created.body.token.id;

        workflow = await server.db.models['workflow'].add({
            name: 'REST study workflow',
            description: 'workflow for rest studies',
            userId: ownerId,
        });
        template = await server.db.models['study'].add({
            name: 'REST source template',
            description: 'template description',
            workflowId: workflow.id,
            userId: ownerId,
            template: true,
            collab: false,
            resumable: false,
            multipleSubmit: false,
            enableEmailNotifications: false,
        }, {context: {stepDocuments: []}});
    });

    afterAll(async () => {
        if (template) {
            await server.db.models['study'].deleteById(template.id);
        }
        if (workflow) {
            await server.db.models['workflow'].deleteById(workflow.id);
        }
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

    function bearerPost(body) {
        return request(server.http)
            .post('/rest/v1/studies')
            .set(auth())
            .send(body);
    }

    async function createStudy(name, extra = {}) {
        const res = await bearerPost({
            templateId: template.id,
            name,
            description: 'created from template',
            ...extra,
        });
        expect(res.statusCode).toBe(201);
        return res.body.study;
    }

    describe('list and create', () => {
        test('POST creates a study from a template for the token owner', async () => {
            const study = await createStudy('REST from template');
            expect(study.name).toBe('REST from template');
            expect(study.userId).toBe(ownerId);
            expect(study.template).toBe(false);
            expect(study.id).toBeTruthy();
            expect(study.hash).toBeTruthy();
            await server.db.models['study'].deleteById(study.id);
        });

        test('POST ignores userId in the body', async () => {
            const study = await createStudy('REST ignore user', {userId: 999999});
            expect(study.userId).toBe(ownerId);
            expect(study.userId).not.toBe(999999);
            await server.db.models['study'].deleteById(study.id);
        });

        test('GET lists studies with id and hash, and omits templates', async () => {
            const study = await createStudy('REST list me');
            const res = await request(server.http)
                .get('/rest/v1/studies')
                .set(auth());
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body.studies)).toBe(true);
            const row = res.body.studies.find((item) => item.id === study.id);
            expect(row).toBeTruthy();
            expect(row.hash).toBe(study.hash);
            expect(res.body.studies.some((item) => item.id === template.id)).toBe(false);
            await server.db.models['study'].deleteById(study.id);
        });

        test('POST without templateId is 400', async () => {
            const res = await bearerPost({name: 'REST no template'});
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('errors.rest.templateIdRequired');
        });

        test('POST with a bad templateId is 400', async () => {
            const res = await bearerPost({templateId: 'nope', name: 'REST bad template'});
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('errors.rest.invalidTemplateId');
        });

        test('POST with a missing template is 404', async () => {
            const res = await bearerPost({templateId: 99999999, name: 'REST missing template'});
            expect(res.statusCode).toBe(404);
            expect(res.body.message).toBe('errors.rest.templateNotFound');
        });

        test('POST from a study that is not a template is 400', async () => {
            const study = await createStudy('REST not a template');
            const res = await bearerPost({templateId: study.id, name: 'REST from study'});
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('errors.rest.notAStudyTemplate');
            await server.db.models['study'].deleteById(study.id);
        });
    });

    describe('get one', () => {
        test('GET one by id and hash', async () => {
            const study = await createStudy('REST get one');
            const byId = await request(server.http)
                .get('/rest/v1/studies/' + study.id)
                .set(auth());
            expect(byId.statusCode).toBe(200);
            expect(byId.body.study.id).toBe(study.id);
            const byHash = await request(server.http)
                .get('/rest/v1/studies/' + study.hash)
                .set(auth());
            expect(byHash.statusCode).toBe(200);
            expect(byHash.body.study.hash).toBe(study.hash);
            await server.db.models['study'].deleteById(study.id);
        });

        test('GET missing id is 404', async () => {
            const res = await request(server.http)
                .get('/rest/v1/studies/99999999')
                .set(auth());
            expect(res.statusCode).toBe(404);
            expect(res.body.message).toBe('errors.rest.studyNotFound');
        });

        test('GET without a bearer token is 401', async () => {
            const res = await request(server.http).get('/rest/v1/studies');
            expect(res.statusCode).toBe(401);
            expect(res.body.message).toBe('errors.rest.missingBearer');
        });
    });

    describe('patch, open, close, delete', () => {
        test('PATCH name and ignores userId', async () => {
            const study = await createStudy('REST patch me');
            const renamed = await request(server.http)
                .patch('/rest/v1/studies/' + study.id)
                .set(auth())
                .send({name: 'REST patched', userId: 999999});
            expect(renamed.statusCode).toBe(200);
            expect(renamed.body.study.name).toBe('REST patched');
            expect(renamed.body.study.userId).toBe(ownerId);
            await server.db.models['study'].deleteById(study.id);
        });

        test('PATCH empty body is 400', async () => {
            const study = await createStudy('REST empty patch');
            const res = await request(server.http)
                .patch('/rest/v1/studies/' + study.id)
                .set(auth())
                .send({});
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('errors.rest.noStudyFields');
            await server.db.models['study'].deleteById(study.id);
        });

        test('PATCH rejects badly typed fields', async () => {
            const study = await createStudy('REST bad fields');
            const cases = [
                [{name: 5}, 'errors.rest.invalidStudyField'],
                [{name: '  '}, 'errors.rest.studyNameRequired'],
                [{collab: 'yes'}, 'errors.rest.invalidStudyField'],
                [{timeLimit: 'soon'}, 'errors.rest.invalidStudyField'],
                [{start: 5}, 'errors.rest.invalidStudyField'],
                [{stepDocuments: 'all'}, 'errors.rest.invalidStudyField'],
                [{stepDocuments: [{documentId: 1}]}, 'errors.rest.invalidStudyField'],
                [{stepDocuments: [{id: 1, documentId: 'x'}]}, 'errors.rest.invalidStudyField'],
                [{stepDocuments: [{id: 1, documentId: 99999999}]}, 'errors.rest.stepDocumentNotFound'],
            ];
            for (const [body, message] of cases) {
                const res = await request(server.http)
                    .patch('/rest/v1/studies/' + study.id)
                    .set(auth())
                    .send(body);
                expect({body, status: res.statusCode, message: res.body.message})
                    .toEqual({body, status: 400, message});
            }
            await server.db.models['study'].deleteById(study.id);
        });

        test('PATCH a closed study is 400', async () => {
            const study = await createStudy('REST closed patch');
            await request(server.http)
                .post('/rest/v1/studies/' + study.id + '/close')
                .set(auth())
                .send({});
            const res = await request(server.http)
                .patch('/rest/v1/studies/' + study.id)
                .set(auth())
                .send({name: 'REST too late'});
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('errors.rest.studyNotEditable');
            await server.db.models['study'].deleteById(study.id);
        });

        test('item routes on a missing id are 404', async () => {
            const missing = '/rest/v1/studies/99999999';
            const calls = [
                request(server.http).patch(missing).set(auth()).send({name: 'x'}),
                request(server.http).delete(missing).set(auth()),
                request(server.http).post(missing + '/close').set(auth()).send({}),
                request(server.http).post(missing + '/open').set(auth()).send({}),
                request(server.http).post(missing + '/template').set(auth()).send({}),
                request(server.http).get(missing + '/export').set(auth()),
            ];
            for (const res of await Promise.all(calls)) {
                expect(res.statusCode).toBe(404);
                expect(res.body.message).toBe('errors.rest.studyNotFound');
            }
        });

        test('item close, item open, and bulk open share one closed flag', async () => {
            const study = await createStudy('REST close open');
            const closed = await request(server.http)
                .post('/rest/v1/studies/' + study.id + '/close')
                .set(auth())
                .send({notifySessions: false});
            expect(closed.statusCode).toBe(200);
            expect(closed.body.study.closed).toBeTruthy();

            const again = await request(server.http)
                .post('/rest/v1/studies/' + study.id + '/close')
                .set(auth())
                .send({notifySessions: false});
            expect(again.statusCode).toBe(400);
            expect(again.body.message).toBe('errors.rest.studyAlreadyClosed');

            const itemOpened = await request(server.http)
                .post('/rest/v1/studies/' + study.hash + '/open')
                .set(auth())
                .send({});
            expect(itemOpened.statusCode).toBe(200);
            expect(itemOpened.body.study.closed).toBeNull();

            await request(server.http)
                .post('/rest/v1/studies/' + study.id + '/close')
                .set(auth())
                .send({notifySessions: false});
            const opened = await request(server.http)
                .post('/rest/v1/studies/open')
                .set(auth())
                .send({ids: [study.id]});
            expect(opened.statusCode).toBe(200);
            expect(opened.body.openedCount).toBe(1);
            expect(opened.body.studies[0].closed).toBeNull();
            await server.db.models['study'].deleteById(study.id);
        });

        test('bulk close and item delete', async () => {
            const first = await createStudy('REST bulk a');
            const second = await createStudy('REST bulk b');
            const closed = await request(server.http)
                .post('/rest/v1/studies/close')
                .set(auth())
                .send({ids: [first.id, second.id], notifySessions: false});
            expect(closed.statusCode).toBe(200);
            expect(closed.body.closedCount).toBe(2);

            const deleted = await request(server.http)
                .delete('/rest/v1/studies/' + first.hash)
                .set(auth());
            expect(deleted.statusCode).toBe(200);
            expect(deleted.body.success).toBe(true);
            const missing = await request(server.http)
                .get('/rest/v1/studies/' + first.id)
                .set(auth());
            expect(missing.statusCode).toBe(404);

            const bulkDeleted = await request(server.http)
                .post('/rest/v1/studies/delete')
                .set(auth())
                .send({ids: [second.id]});
            expect(bulkDeleted.statusCode).toBe(200);
            expect(bulkDeleted.body.deletedCount).toBe(1);
            const alsoMissing = await request(server.http)
                .get('/rest/v1/studies/' + second.id)
                .set(auth());
            expect(alsoMissing.statusCode).toBe(404);
        });

        test('bulk routes need a list of integer ids', async () => {
            for (const action of ['close', 'open', 'delete']) {
                const empty = await request(server.http)
                    .post('/rest/v1/studies/' + action)
                    .set(auth())
                    .send({});
                expect(empty.statusCode).toBe(400);
                expect(empty.body.message).toBe('errors.rest.studyIdsRequired');
                const bad = await request(server.http)
                    .post('/rest/v1/studies/' + action)
                    .set(auth())
                    .send({ids: ['abc']});
                expect(bad.statusCode).toBe(400);
                expect(bad.body.message).toBe('errors.rest.invalidStudyIds');
            }
        });

        test('bulk close skips a missing id and closes the rest', async () => {
            const study = await createStudy('REST bulk partial');
            const res = await request(server.http)
                .post('/rest/v1/studies/close')
                .set(auth())
                .send({ids: [study.id, 99999999]});
            expect(res.statusCode).toBe(200);
            expect(res.body.closedCount).toBe(1);
            expect(res.body.studies[0].id).toBe(study.id);
            await server.db.models['study'].deleteById(study.id);
        });
    });

    describe('template, export, import', () => {
        test('POST template saves the study as a template', async () => {
            const study = await createStudy('REST save template');
            const saved = await request(server.http)
                .post('/rest/v1/studies/' + study.id + '/template')
                .set(auth())
                .send({});
            expect(saved.statusCode).toBe(201);
            expect(saved.body.study.template).toBe(true);
            expect(saved.body.study.id).not.toBe(study.id);
            expect(saved.body.study.name).toBe(study.name);
            await server.db.models['study'].deleteById(saved.body.study.id);
            await server.db.models['study'].deleteById(study.id);
        });

        test('GET export json and yaml, then POST import creates a template', async () => {
            const study = await createStudy('REST export me');
            const jsonExport = await request(server.http)
                .get('/rest/v1/studies/' + study.id + '/export?format=json')
                .set(auth());
            expect(jsonExport.statusCode).toBe(200);
            expect(Array.isArray(jsonExport.body)).toBe(true);
            expect(jsonExport.body[0].name).toBe('REST export me');
            expect(jsonExport.body[0].id).toBeUndefined();
            expect(Array.isArray(jsonExport.body[0].study_step)).toBe(true);

            const yamlExport = await request(server.http)
                .get('/rest/v1/studies/' + study.hash + '/export?format=yaml')
                .set(auth());
            expect(yamlExport.statusCode).toBe(200);
            const parsedYaml = yaml.load(yamlExport.text);
            expect(parsedYaml[0].name).toBe('REST export me');
            expect(Array.isArray(parsedYaml[0].study_step)).toBe(true);

            const imported = await request(server.http)
                .post('/rest/v1/studies/import')
                .set(auth())
                .send(jsonExport.body);
            expect(imported.statusCode).toBe(201);
            expect(imported.body.studies[0].template).toBe(true);
            expect(imported.body.studies[0].userId).toBe(ownerId);
            expect(imported.body.studies[0].name).toBe('REST export me');

            const importedYaml = await request(server.http)
                .post('/rest/v1/studies/import')
                .set(auth())
                .send({format: 'yaml', content: yamlExport.text});
            expect(importedYaml.statusCode).toBe(201);
            expect(importedYaml.body.studies[0].template).toBe(true);

            await server.db.models['study'].deleteById(imported.body.studies[0].id);
            await server.db.models['study'].deleteById(importedYaml.body.studies[0].id);
            await server.db.models['study'].deleteById(study.id);
        });

        test('GET export defaults to json, accepts yml, and rejects other formats', async () => {
            const study = await createStudy('REST export formats');
            const plain = await request(server.http)
                .get('/rest/v1/studies/' + study.id + '/export')
                .set(auth());
            expect(plain.statusCode).toBe(200);
            expect(plain.headers['content-type']).toMatch(/^application\/json/);
            const yml = await request(server.http)
                .get('/rest/v1/studies/' + study.id + '/export?format=yml')
                .set(auth());
            expect(yml.statusCode).toBe(200);
            expect(yml.headers['content-type']).toMatch(/^application\/yaml/);
            const csv = await request(server.http)
                .get('/rest/v1/studies/' + study.id + '/export?format=csv')
                .set(auth());
            expect(csv.statusCode).toBe(400);
            expect(csv.body.message).toBe('errors.rest.unsupportedExportFormat');
            await server.db.models['study'].deleteById(study.id);
        });

        test('POST import keeps only study fields and ignores owner and state columns', async () => {
            const res = await request(server.http)
                .post('/rest/v1/studies/import')
                .set(auth())
                .send([{
                    name: 'REST import allow-list',
                    workflowId: workflow.id,
                    userId: 999999,
                    createdByUserId: 999999,
                    closed: '2020-01-01T00:00:00.000Z',
                    template: false,
                }]);
            expect(res.statusCode).toBe(201);
            const imported = res.body.studies[0];
            expect(imported.userId).toBe(ownerId);
            expect(imported.template).toBe(true);
            expect(imported.closed == null).toBe(true);
            expect(imported.createdByUserId).not.toBe(999999);
            await server.db.models['study'].deleteById(imported.id);
        });

        test('POST import that fails on the second study keeps nothing of the first', async () => {
            const res = await request(server.http)
                .post('/rest/v1/studies/import')
                .set(auth())
                .send([
                    {name: 'REST import halfway first', workflowId: workflow.id},
                    {name: 'REST import halfway second', workflowId: workflow.id, stepDocuments: [{id: 1, documentId: 99999999}]},
                ]);
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('errors.rest.stepDocumentNotFound');
            // Rolled back, not soft-deleted: no row at all.
            expect(await server.db.models['study'].count({where: {name: 'REST import halfway first'}})).toBe(0);
        });

        test('export then import keeps the steps with their documents', async () => {
            const models = server.db.models;
            const stepWorkflow = await models['workflow'].add({name: 'REST step workflow', description: 'one step', userId: ownerId});
            const step = await models['workflow_step'].add({
                workflowId: stepWorkflow.id, stepType: 1, workflowStepPrevious: null, allowBackward: true,
            });
            const doc = await models['document'].add({name: 'REST step document', type: 1, userId: ownerId});
            const created = [];
            try {
                // The shape export returns: study fields plus study_step rows.
                const first = await request(server.http)
                    .post('/rest/v1/studies/import')
                    .set(auth())
                    .send([{name: 'REST import with steps', workflowId: stepWorkflow.id,
                        study_step: [{workflowStepId: step.id, documentId: doc.id, configuration: {}}]}]);
                expect(first.statusCode).toBe(201);
                created.push(first.body.studies[0].id);
                const stepsOf = (studyId) => models['study_step'].findAll({where: {studyId, deleted: false}, raw: true});
                expect((await stepsOf(created[0])).map((row) => row.documentId)).toEqual([doc.id]);

                const exported = await request(server.http)
                    .get('/rest/v1/studies/' + created[0] + '/export?format=json')
                    .set(auth());
                expect(exported.statusCode).toBe(200);
                const again = await request(server.http)
                    .post('/rest/v1/studies/import')
                    .set(auth())
                    .send(exported.body);
                expect(again.statusCode).toBe(201);
                created.push(again.body.studies[0].id);
                expect((await stepsOf(created[1])).map((row) => row.documentId)).toEqual([doc.id]);
            } finally {
                for (const id of created) {
                    await models['study'].deleteById(id);
                }
                await models['document'].deleteById(doc.id);
                await models['workflow_step'].deleteById(step.id);
                await models['workflow'].deleteById(stepWorkflow.id);
            }
        });

        test('POST import rejects a badly typed study field', async () => {
            const res = await request(server.http)
                .post('/rest/v1/studies/import')
                .set(auth())
                .send([{name: 'REST import bad type', workflowId: workflow.id, collab: 'yes'}]);
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('errors.rest.invalidStudyField');
        });

        test('POST import rejects empty, unparsable, and unknown-format content', async () => {
            const cases = [
                [{}, 'errors.rest.importContentRequired'],
                [[], 'errors.rest.importContentRequired'],
                [[1], 'errors.rest.importContentRequired'],
                [{content: '{}'}, 'errors.rest.importContentRequired'],
                [{content: '[{'}, 'errors.rest.importParseFailed'],
                [{format: 'csv', content: '[]'}, 'errors.rest.unsupportedExportFormat'],
            ];
            for (const [body, message] of cases) {
                const res = await request(server.http)
                    .post('/rest/v1/studies/import')
                    .set(auth())
                    .send(body);
                expect({body, status: res.statusCode, message: res.body.message})
                    .toEqual({body, status: 400, message});
            }
        });
    });

    describe('token rights', () => {
        test('token without studies.view is 403', async () => {
            const scoped = await request(server.http)
                .post('/auth/api-tokens')
                .set('Cookie', cookie)
                .send({
                    name: 'studies denied',
                    rights: ['frontend.dashboard.api_tokens.view'],
                });
            expect(scoped.statusCode).toBe(201);
            try {
                const denied = await request(server.http)
                    .get('/rest/v1/studies')
                    .set('Authorization', 'Bearer ' + scoped.body.secret);
                expect(denied.statusCode).toBe(403);
                expect(denied.body.message).toBe('errors.rest.missingTokenRight');
            } finally {
                await request(server.http)
                    .delete('/auth/api-tokens/' + scoped.body.token.id)
                    .set('Cookie', cookie);
            }
        });

        test('view-only token can list but cannot create', async () => {
            const scoped = await request(server.http)
                .post('/auth/api-tokens')
                .set('Cookie', cookie)
                .send({
                    name: 'studies view only',
                    rights: [STUDIES_VIEW],
                });
            expect(scoped.statusCode).toBe(201);
            try {
                const listed = await request(server.http)
                    .get('/rest/v1/studies')
                    .set('Authorization', 'Bearer ' + scoped.body.secret);
                expect(listed.statusCode).toBe(200);
                const denied = await request(server.http)
                    .post('/rest/v1/studies')
                    .set('Authorization', 'Bearer ' + scoped.body.secret)
                    .send({templateId: template.id, name: 'should fail'});
                expect(denied.statusCode).toBe(403);
                expect(denied.body.message).toBe('errors.rest.missingTokenRight');
            } finally {
                await request(server.http)
                    .delete('/auth/api-tokens/' + scoped.body.token.id)
                    .set('Cookie', cookie);
            }
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
                    name: 'researcher studies',
                    rights: [STUDIES_VIEW],
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

        test('GET another user study is 403 not 404', async () => {
            const study = await createStudy('admin hidden study');
            try {
                const res = await request(server.http)
                    .get('/rest/v1/studies/' + study.id)
                    .set(researcherAuth());
                expect(res.statusCode).toBe(403);
                expect(res.body.message).toBe('errors.rest.studyNoAccess');
            } finally {
                await server.db.models['study'].deleteById(study.id);
            }
        });

        test('non-admin list is own studies only', async () => {
            const adminStudy = await createStudy('admin not in researcher list');
            const own = await server.db.models['study'].add({
                name: 'researcher own study',
                description: 'own',
                workflowId: workflow.id,
                userId: researcherUserId,
                template: false,
                collab: false,
                resumable: false,
                multipleSubmit: false,
                enableEmailNotifications: false,
            }, {context: {stepDocuments: []}});
            try {
                const listed = await request(server.http)
                    .get('/rest/v1/studies')
                    .set(researcherAuth());
                expect(listed.statusCode).toBe(200);
                expect(listed.body.studies.some((row) => row.id === own.id)).toBe(true);
                expect(listed.body.studies.some((row) => row.id === adminStudy.id)).toBe(false);
                const one = await request(server.http)
                    .get('/rest/v1/studies/' + own.hash)
                    .set(researcherAuth());
                expect(one.statusCode).toBe(200);
                expect(one.body.study.id).toBe(own.id);
            } finally {
                await server.db.models['study'].deleteById(own.id);
                await server.db.models['study'].deleteById(adminStudy.id);
            }
        });

        test('non-admin cannot create', async () => {
            const res = await request(server.http)
                .post('/rest/v1/studies')
                .set(researcherAuth())
                .send({templateId: template.id, name: 'researcher create'});
            expect(res.statusCode).toBe(403);
            expect(res.body.message).toBe('errors.rest.missingTokenRight');
        });
    });

    describe('admin owner with a narrow token', () => {
        let other;
        let otherStudy;
        let narrow;

        beforeAll(async () => {
            other = (await addResearcherUser(server.db.models)).user;
            otherStudy = await server.db.models['study'].add({
                name: 'someone else study',
                workflowId: workflow.id,
                userId: other.id,
                template: false,
            }, {context: {stepDocuments: []}});
            const created = await request(server.http)
                .post('/auth/api-tokens')
                .set('Cookie', cookie)
                .send({name: 'admin narrow studies', rights: [STUDIES_VIEW, 'frontend.dashboard.studies.canManageStudies']});
            expect(created.statusCode).toBe(201);
            narrow = created.body;
        });

        afterAll(async () => {
            await request(server.http).delete('/auth/api-tokens/' + narrow.token.id).set('Cookie', cookie);
            await server.db.models['study'].deleteById(otherStudy.id);
            await server.db.models['user'].deleteById(other.id);
        });

        test('without studies.fullAccess on the token another user study is hidden and cannot be changed', async () => {
            const bearer = {'Authorization': 'Bearer ' + narrow.secret};
            const listed = await request(server.http).get('/rest/v1/studies').set(bearer);
            expect(listed.statusCode).toBe(200);
            expect(listed.body.studies.some((study) => study.id === otherStudy.id)).toBe(false);
            const got = await request(server.http).get('/rest/v1/studies/' + otherStudy.id).set(bearer);
            expect(got.statusCode).toBe(403);
            const patched = await request(server.http)
                .patch('/rest/v1/studies/' + otherStudy.id)
                .set(bearer)
                .send({name: 'taken over'});
            expect(patched.statusCode).toBe(403);
            const deleted = await request(server.http).delete('/rest/v1/studies/' + otherStudy.id).set(bearer);
            expect(deleted.statusCode).toBe(403);
        });

        test('the full admin token still reaches that study', async () => {
            const got = await request(server.http).get('/rest/v1/studies/' + otherStudy.id).set(auth());
            expect(got.statusCode).toBe(200);
        });
    });
    describe('review fixes', () => {
        test('a study date that is not a date is 400, not a server error', async () => {
            const study = await createStudy('REST bad date');
            try {
                const res = await request(server.http)
                    .patch('/rest/v1/studies/' + study.id)
                    .set(auth())
                    .send({start: 'next week'});
                expect(res.statusCode).toBe(400);
                expect(res.body.message).toBe('errors.rest.invalidStudyField');
                const ok = await request(server.http)
                    .patch('/rest/v1/studies/' + study.id)
                    .set(auth())
                    .send({start: '2030-01-01T00:00:00.000Z', end: null});
                expect(ok.statusCode).toBe(200);
            } finally {
                await server.db.models['study'].deleteById(study.id);
            }
        });

        test('a bulk close sends its emails one study at a time, after answering', async () => {
            const models = server.db.models;
            const reader = await addResearcherUser(models);
            const studies = [];
            for (const name of ['REST mail one', 'REST mail two', 'REST mail three']) {
                const study = await createStudy(name);
                // Only an open session is needed; without hooks, so the template needs no steps.
                await models['study_session'].create({studyId: study.id, userId: reader.user.id, hash: require('crypto').randomUUID(), deleted: false}, {hooks: false});
                studies.push(study);
            }
            const original = server.sendMail;
            let active = 0;
            let maxActive = 0;
            let sent = 0;
            server.sendMail = async () => {
                active += 1;
                maxActive = Math.max(maxActive, active);
                await new Promise((resolve) => setTimeout(resolve, 50));
                active -= 1;
                sent += 1;
            };
            try {
                const res = await request(server.http)
                    .post('/rest/v1/studies/close')
                    .set(auth())
                    .send({ids: studies.map((study) => study.id), notifySessions: true});
                expect(res.statusCode).toBe(200);
                expect(res.body.closedCount).toBe(3);
                const end = Date.now() + 5000;
                while (sent < 3 && Date.now() < end) {
                    await new Promise((resolve) => setTimeout(resolve, 25));
                }
                expect(sent).toBe(3);
                expect(maxActive).toBe(1);
            } finally {
                server.sendMail = original;
                for (const study of studies) {
                    await models['study'].deleteById(study.id);
                }
                await models['user'].deleteById(reader.user.id);
            }
        });

        test('bulk routes take at most 100 ids', async () => {
            const ids = Array.from({length: 101}, (_, i) => i + 1);
            for (const route of ['close', 'open', 'delete']) {
                const res = await request(server.http)
                    .post('/rest/v1/studies/' + route)
                    .set(auth())
                    .send({ids});
                expect({route, status: res.statusCode, message: res.body.message})
                    .toEqual({route, status: 400, message: 'errors.rest.tooManyStudyIds'});
            }
        });

        test('the list uses the system default project when the user has none of their own', async () => {
            const models = server.db.models;
            const systemDefault = parseInt(await models['setting'].get('projects.default'), 10);
            const own = await models['user_setting'].get('projects.default', ownerId);
            const project = await models['project'].add({name: 'REST other project', userId: ownerId});
            const study = await models['study'].add({
                name: 'REST study in other project', workflowId: workflow.id, userId: ownerId,
                projectId: project.id, template: false,
            }, {context: {stepDocuments: []}});
            const listedIds = async () => (await request(server.http).get('/rest/v1/studies').set(auth()))
                .body.studies.map((row) => row.id);
            // Plain SQL: user_setting has no id column, and removing the row restores "no own setting" exactly.
            const dropOwnSetting = () => server.db.sequelize.query(
                'DELETE FROM "user_setting" WHERE "userId" = :userId AND "key" = \'projects.default\'',
                {replacements: {userId: ownerId}});
            try {
                expect(project.id).not.toBe(systemDefault);
                await dropOwnSetting();
                expect(await listedIds()).not.toContain(study.id);
                await models['user_setting'].set('projects.default', String(project.id), ownerId);
                expect(await listedIds()).toContain(study.id);
            } finally {
                await dropOwnSetting();
                if (own !== null) {
                    await models['user_setting'].set('projects.default', own, ownerId);
                }
                await models['study'].deleteById(study.id);
                await models['project'].deleteById(project.id);
            }
        });
    });
});
