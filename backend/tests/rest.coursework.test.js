const request = require('supertest');
const Server = require('../webserver/Server.js');
const {enableRestForTests, allTokenRights, addResearcherUser} = require('./utils.js');

const PORT = 3132;
// The smallest valid ZIP file: an empty archive.
const EMPTY_ZIP = Buffer.from([0x50, 0x4b, 0x05, 0x06, ...new Array(18).fill(0)]);

/** Assignments, submission upload, and template text over REST. */
describe('REST coursework', () => {
    let server;
    let models;
    let cookie;
    let full;
    let student;
    let studentCookie;
    let studentToken;
    let validation;
    let project;

    beforeAll(async () => {
        server = new Server();
        server.start(PORT);
        await server.devAdminReady;
        models = server.db.models;
        await enableRestForTests(models);
        const login = await request(server.http)
            .post('/auth/login')
            .send({username: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PWD});
        cookie = login.headers['set-cookie'];
        full = (await request(server.http).post('/auth/api-tokens').set('Cookie', cookie)
            .send({name: 'coursework tests', rights: await allTokenRights(server, cookie)})).body;
        student = await addResearcherUser(models);
        studentCookie = (await request(server.http).post('/auth/login')
            .send({username: student.user.email, password: student.password})).headers['set-cookie'];
        studentToken = (await request(server.http).post('/auth/api-tokens').set('Cookie', studentCookie)
            .send({name: 'student', rights: await allTokenRights(server, studentCookie)})).body;
        project = await models['project'].add({name: 'REST coursework project', userId: full.token.userId, public: true});
        validation = await models['configuration'].add({
            name: 'REST any zip', description: '', userId: full.token.userId, type: 1,
            content: {rules: {additionalFilesAreAllowed: true, requiredFiles: []}},
        });
    });

    afterAll(async () => {
        await models['configuration'].deleteById(validation.id);
        await models['project'].deleteById(project.id);
        await request(server.http).delete('/auth/api-tokens/' + full.token.id).set('Cookie', cookie);
        await request(server.http).delete('/auth/api-tokens/' + studentToken.token.id).set('Cookie', studentCookie);
        await models['user'].deleteById(student.user.id);
        server.stop();
    });

    function call(method, path, body, token = full) {
        const req = request(server.http)[method](path).set('Authorization', 'Bearer ' + token.secret);
        return body === undefined ? req : req.send(body);
    }

    describe('assignments', () => {
        test('create shared with a user, list for that user, edit, close, delete when empty', async () => {
            const created = await call('post', '/rest/v1/assignments', {
                name: 'REST essay', validationConfigurationId: validation.id, maxRevisions: 1,
                shareWith: {users: [student.user.id]},
            });
            expect(created.statusCode).toBe(201);
            const assignment = created.body.assignment;
            expect(assignment.userId).toBe(full.token.userId);
            expect(assignment.shareWith.users).toEqual([student.user.id]);

            const seen = await call('get', '/rest/v1/assignments', undefined, studentToken);
            expect(seen.body.assignments.map((row) => row.id)).toContain(assignment.id);
            expect((await call('patch', '/rest/v1/assignments/' + assignment.id, {name: 'x'}, studentToken)).statusCode).toBe(403);

            const edited = await call('patch', '/rest/v1/assignments/' + assignment.id, {name: 'REST essay 2', shareWith: {roles: ['user']}});
            expect(edited.body.assignment.name).toBe('REST essay 2');
            expect(edited.body.assignment.shareWith.users).toEqual([]);
            expect(edited.body.assignment.shareWith.roles).toHaveLength(1);

            const closed = await call('post', '/rest/v1/assignments/' + assignment.id + '/close');
            expect(closed.body.assignment.closed).toBeTruthy();
            expect((await call('post', '/rest/v1/assignments/' + assignment.id + '/close')).statusCode).toBe(400);
            expect((await call('delete', '/rest/v1/assignments/' + assignment.id)).statusCode).toBe(200);
        });

        test('without projectId an assignment goes into the default project', async () => {
            const systemDefault = parseInt(await models['setting'].get('projects.default'), 10);
            const res = await call('post', '/rest/v1/assignments', {name: 'REST default project assignment'});
            expect(res.statusCode).toBe(201);
            expect(res.body.assignment.projectId).toBe(systemDefault);
            await call('delete', '/rest/v1/assignments/' + res.body.assignment.id);
        });

        test('bad fields and unknown shares are refused', async () => {
            expect((await call('post', '/rest/v1/assignments', {name: ''})).statusCode).toBe(400);
            expect((await call('post', '/rest/v1/assignments', {name: 'x', maxRevisions: -2})).statusCode).toBe(400);
            expect((await call('post', '/rest/v1/assignments', {name: 'x', shareWith: {roles: ['nobody']}})).statusCode).toBe(404);
            expect((await call('post', '/rest/v1/assignments', {name: 'x', validationConfigurationId: 99999999})).statusCode).toBe(400);
        });
    });

    describe('submission upload', () => {
        let assignment;

        beforeAll(async () => {
            assignment = (await call('post', '/rest/v1/assignments', {
                name: 'REST upload assignment', validationConfigurationId: validation.id, maxRevisions: 0, projectId: project.id,
                notifyOnSubmissionUpload: false, shareWith: {users: [student.user.id]},
            })).body.assignment;
        });

        test('a student uploads their own submission; a second one goes past maxRevisions', async () => {
            const res = await request(server.http)
                .post('/rest/v1/submissions')
                .set('Authorization', 'Bearer ' + studentToken.secret)
                .field('assignmentId', String(assignment.id))
                .attach('files', EMPTY_ZIP, 'essay.zip');
            expect(res.statusCode).toBe(201);
            expect(res.body.submission.userId).toBe(student.user.id);
            expect(res.body.submission.documents).toHaveLength(1);

            const again = await request(server.http)
                .post('/rest/v1/submissions')
                .set('Authorization', 'Bearer ' + studentToken.secret)
                .field('assignmentId', String(assignment.id))
                .attach('files', EMPTY_ZIP, 'essay2.zip');
            expect(again.statusCode).toBe(400);
            expect(again.body.message).toBe('errors.assignment.maxRevisionsReached');

            const blocked = await call('delete', '/rest/v1/assignments/' + assignment.id);
            expect(blocked.statusCode).toBe(400);
            expect(blocked.body.message).toBe('errors.rest.assignmentHasSubmissions');
        });

        test('uploading for someone else needs uploadForOthers', async () => {
            const res = await request(server.http)
                .post('/rest/v1/submissions')
                .set('Authorization', 'Bearer ' + studentToken.secret)
                .field('assignmentId', String(assignment.id))
                .field('userId', String(full.token.userId))
                .attach('files', EMPTY_ZIP, 'not-mine.zip');
            expect(res.statusCode).toBe(403);
        });

        test('a projectId must be an own or public project', async () => {
            const privateProject = await models['project'].add({name: 'REST student private', userId: student.user.id, public: false});
            try {
                for (const projectId of [99999999, privateProject.id]) {
                    const res = await request(server.http)
                        .post('/rest/v1/submissions')
                        .set('Authorization', 'Bearer ' + full.secret)
                        .field('validationConfigurationId', String(validation.id))
                        .field('projectId', String(projectId))
                        .attach('files', EMPTY_ZIP, 'project.zip');
                    expect({projectId, status: res.statusCode, message: res.body.message})
                        .toEqual({projectId, status: 400, message: 'errors.rest.invalidProjectId'});
                }
            } finally {
                await models['project'].deleteById(privateProject.id);
            }
        });

        test('no files, or a closed assignment, is refused', async () => {
            const noFiles = await request(server.http)
                .post('/rest/v1/submissions')
                .set('Authorization', 'Bearer ' + full.secret)
                .field('assignmentId', String(assignment.id));
            expect(noFiles.statusCode).toBe(400);
            expect(noFiles.body.message).toBe('errors.rest.filesRequired');

            await call('post', '/rest/v1/assignments/' + assignment.id + '/close');
            const closed = await request(server.http)
                .post('/rest/v1/submissions')
                .set('Authorization', 'Bearer ' + full.secret)
                .field('assignmentId', String(assignment.id))
                .attach('files', EMPTY_ZIP, 'late.zip');
            expect(closed.statusCode).toBe(400);
            expect(closed.body.message).toBe('errors.rest.assignmentClosed');
        });
    });

    describe('template text', () => {
        test('create a prompt template, set text in two languages, remove one, delete', async () => {
            const created = await call('post', '/rest/v1/templates', {name: 'REST prompt', description: 'd', type: 8, defaultLanguage: 'en'});
            expect(created.statusCode).toBe(201);
            const id = created.body.template.id;
            const en = await call('put', `/rest/v1/templates/${id}/content/en`, {ops: [{insert: 'Summarise.\n'}]});
            expect(en.statusCode).toBe(200);
            expect((await call('put', `/rest/v1/templates/${id}/content/de`, {ops: [{insert: 'Zusammenfassen.\n'}]})).statusCode).toBe(200);
            const exported = await call('get', '/rest/v1/templates/export?id=' + id);
            expect(exported.body.templates[0].template_content.map((row) => row.language).sort()).toEqual(['de', 'en']);

            expect((await call('delete', `/rest/v1/templates/${id}/content/en`)).statusCode).toBe(400);
            expect((await call('delete', `/rest/v1/templates/${id}/content/de`)).statusCode).toBe(200);
            expect((await call('put', `/rest/v1/templates/${id}/content/en`, {ops: 'x'})).statusCode).toBe(400);
            expect((await call('patch', '/rest/v1/templates/' + id, {name: 'x'}, studentToken)).statusCode).toBe(403);
            expect((await call('delete', '/rest/v1/templates/' + id)).statusCode).toBe(200);
        });

        test('email templates cannot be created', async () => {
            const res = await call('post', '/rest/v1/templates', {name: 'mail', description: 'd', type: 1});
            expect(res.statusCode).toBe(400);
        });
    });
});
