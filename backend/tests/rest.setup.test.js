const request = require('supertest');
const Server = require('../webserver/Server.js');
const {enableRestForTests, allTokenRights, addResearcherUser} = require('./utils.js');

const PORT = 3131;

/** Projects, tag sets, workflows, and configurations over REST. */
describe('REST setup resources', () => {
    let server;
    let models;
    let cookie;
    let full;
    let other;
    let otherToken;
    let otherCookie;

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
            .send({name: 'setup tests', rights: await allTokenRights(server, cookie)})).body;
        other = await addResearcherUser(models);
        const otherLogin = await request(server.http).post('/auth/login')
            .send({username: other.user.email, password: other.password});
        otherCookie = otherLogin.headers['set-cookie'];
        otherToken = (await request(server.http).post('/auth/api-tokens').set('Cookie', otherCookie)
            .send({name: 'other user', rights: await allTokenRights(server, otherCookie)})).body;
    });

    afterAll(async () => {
        await request(server.http).delete('/auth/api-tokens/' + full.token.id).set('Cookie', cookie);
        await request(server.http).delete('/auth/api-tokens/' + otherToken.token.id).set('Cookie', otherCookie);
        await models['user'].deleteById(other.user.id);
        server.stop();
    });

    function call(method, path, body, token = full) {
        const req = request(server.http)[method](path).set('Authorization', 'Bearer ' + token.secret);
        return body === undefined ? req : req.send(body);
    }

    describe('projects', () => {
        test('create, rename, publish, close, delete an own project', async () => {
            const created = await call('post', '/rest/v1/projects', {name: 'REST project', description: 'd'});
            expect(created.statusCode).toBe(201);
            const id = created.body.project.id;
            expect(created.body.project.public).toBe(false);
            const renamed = await call('patch', '/rest/v1/projects/' + id, {name: 'REST project renamed', public: true, closed: true});
            expect(renamed.statusCode).toBe(200);
            expect(renamed.body.project.public).toBe(true);
            expect(renamed.body.project.closed).toBeTruthy();
            const unpublish = await call('patch', '/rest/v1/projects/' + id, {public: false});
            expect(unpublish.statusCode).toBe(400);
            expect((await call('get', '/rest/v1/projects/' + id)).body.project.name).toBe('REST project renamed');
            expect((await call('delete', '/rest/v1/projects/' + id)).statusCode).toBe(200);
            expect((await call('get', '/rest/v1/projects/' + id)).statusCode).toBe(404);
        });

        test('list and get return real createdAt and updatedAt', async () => {
            const id = (await call('post', '/rest/v1/projects', {name: 'REST dated project'})).body.project.id;
            try {
                const listed = (await call('get', '/rest/v1/projects')).body.projects.find((row) => row.id === id);
                expect(listed.createdAt).not.toBeNull();
                expect(listed.updatedAt).not.toBeNull();
                expect((await call('get', '/rest/v1/projects/' + id)).body.project.createdAt).not.toBeNull();
            } finally {
                await call('delete', '/rest/v1/projects/' + id);
            }
        });

        test('another user cannot change or read a private project', async () => {
            const id = (await call('post', '/rest/v1/projects', {name: 'REST private project'})).body.project.id;
            try {
                expect((await call('patch', '/rest/v1/projects/' + id, {name: 'x'}, otherToken)).statusCode).toBe(403);
                expect((await call('delete', '/rest/v1/projects/' + id, undefined, otherToken)).statusCode).toBe(403);
                expect((await call('get', '/rest/v1/projects/' + id, undefined, otherToken)).statusCode).toBe(403);
            } finally {
                await call('delete', '/rest/v1/projects/' + id);
            }
        });

        test('bad bodies are 400', async () => {
            expect((await call('post', '/rest/v1/projects', {})).statusCode).toBe(400);
            expect((await call('post', '/rest/v1/projects', {name: 5})).statusCode).toBe(400);
        });
    });

    describe('tag sets', () => {
        test('create with tags, replace the tag list, publish, delete', async () => {
            const created = await call('post', '/rest/v1/tag-sets', {
                name: 'REST tags', tags: [{name: 'good', colorCode: 'success'}, {name: 'bad', colorCode: 'danger'}],
            });
            expect(created.statusCode).toBe(201);
            const tagSet = created.body.tagSet;
            expect(tagSet.tags.map((tag) => tag.name)).toEqual(['good', 'bad']);
            const keep = tagSet.tags[0];
            const updated = await call('patch', '/rest/v1/tag-sets/' + tagSet.id, {
                tags: [{id: keep.id, name: 'very good', colorCode: 'success'}, {name: 'new', colorCode: 'info'}],
            });
            expect(updated.statusCode).toBe(200);
            expect(updated.body.tagSet.tags.map((tag) => tag.name)).toEqual(['very good', 'new']);
            const published = await call('patch', '/rest/v1/tag-sets/' + tagSet.id, {public: true});
            expect(published.body.tagSet.public).toBe(true);
            expect((await call('get', '/rest/v1/tag-sets/' + tagSet.id, undefined, otherToken)).statusCode).toBe(200);
            expect((await call('patch', '/rest/v1/tag-sets/' + tagSet.id, {name: 'x'}, otherToken)).statusCode).toBe(403);
            expect((await call('delete', '/rest/v1/tag-sets/' + tagSet.id)).statusCode).toBe(200);
        });

        test('without projectId a tag set goes into the default project, so the Tags page shows it', async () => {
            const systemDefault = parseInt(await models['setting'].get('projects.default'), 10);
            const res = await call('post', '/rest/v1/tag-sets', {name: 'REST default project', tags: []});
            expect(res.statusCode).toBe(201);
            expect(res.body.tagSet.projectId).toBe(systemDefault);
            await call('delete', '/rest/v1/tag-sets/' + res.body.tagSet.id);
        });

        test('a tag set refuses an unknown project or another user\'s private project', async () => {
            const privateProject = await models['project'].add({name: 'REST private for tags', userId: other.user.id, public: false});
            try {
                for (const projectId of [99999999, privateProject.id]) {
                    const res = await call('post', '/rest/v1/tag-sets', {name: 'REST bad project', projectId, tags: []});
                    expect({projectId, status: res.statusCode, message: res.body.message})
                        .toEqual({projectId, status: 400, message: 'errors.rest.invalidProjectId'});
                }
            } finally {
                await models['project'].deleteById(privateProject.id);
            }
        });

        test('a tag needs a known colour, and a foreign tag id is refused', async () => {
            expect((await call('post', '/rest/v1/tag-sets', {name: 'x', tags: [{name: 'a', colorCode: 'pink'}]})).statusCode).toBe(400);
            const tagSet = (await call('post', '/rest/v1/tag-sets', {name: 'REST tags two', tags: []})).body.tagSet;
            try {
                const res = await call('patch', '/rest/v1/tag-sets/' + tagSet.id, {tags: [{id: 99999999, name: 'a', colorCode: 'info'}]});
                expect(res.statusCode).toBe(400);
                expect(res.body.message).toBe('errors.rest.tagNotInSet');
            } finally {
                await call('delete', '/rest/v1/tag-sets/' + tagSet.id);
            }
        });
    });

    describe('workflows', () => {
        const steps = [
            {name: 'Read', stepType: 1, allowBackward: false, configuration: {}},
            {name: 'Write', stepType: 2, allowBackward: true, configuration: {}, documentFromStep: 1},
        ];

        test('import, copy, rename, replace steps while unused, delete', async () => {
            const imported = await call('post', '/rest/v1/workflows/import', [{name: 'REST workflow', workflow_step: steps}]);
            expect(imported.statusCode).toBe(201);
            const id = imported.body.workflows[0].id;
            const got = await call('get', '/rest/v1/workflows/' + id);
            expect(got.body.workflow.steps.map((step) => step.name)).toEqual(['Read', 'Write']);
            expect(got.body.workflow.steps[1].workflowStepDocument).toBe(got.body.workflow.steps[0].id);

            const copy = await call('post', '/rest/v1/workflows/' + id + '/copy', {name: 'REST workflow copy'});
            expect(copy.statusCode).toBe(201);
            const copied = await call('get', '/rest/v1/workflows/' + copy.body.workflow.id);
            expect(copied.body.workflow.steps).toHaveLength(2);

            const renamed = await call('patch', '/rest/v1/workflows/' + id, {name: 'REST workflow renamed'});
            expect(renamed.body.workflow.name).toBe('REST workflow renamed');
            const replaced = await call('put', '/rest/v1/workflows/' + id + '/steps', {steps: [steps[0]]});
            expect(replaced.statusCode).toBe(200);
            expect((await call('get', '/rest/v1/workflows/' + id)).body.workflow.steps).toHaveLength(1);

            expect((await call('patch', '/rest/v1/workflows/' + id, {name: 'x'}, otherToken)).statusCode).toBe(403);
            for (const workflowId of [id, copy.body.workflow.id]) {
                expect((await call('delete', '/rest/v1/workflows/' + workflowId)).statusCode).toBe(200);
            }
        });

        test('a workflow used by a study cannot change steps or be deleted', async () => {
            const id = (await call('post', '/rest/v1/workflows/import', {name: 'REST used workflow', steps})).body.workflows[0].id;
            const study = await models['study'].add({name: 'uses workflow', workflowId: id, userId: full.token.userId, template: true},
                {context: {stepDocuments: []}});
            try {
                const res = await call('put', '/rest/v1/workflows/' + id + '/steps', {steps});
                expect(res.statusCode).toBe(400);
                expect(res.body.message).toBe('errors.rest.workflowInUse');
                expect((await call('delete', '/rest/v1/workflows/' + id)).statusCode).toBe(400);
            } finally {
                await models['study'].deleteById(study.id);
                await call('delete', '/rest/v1/workflows/' + id);
            }
        });

        test('bad steps are 400', async () => {
            const bad = [[], [{name: 'x', stepType: 9}], [{name: 'x', stepType: 1, documentFromStep: 1}]];
            for (const stepsList of bad) {
                const res = await call('post', '/rest/v1/workflows/import', {name: 'bad', steps: stepsList});
                expect(res.statusCode).toBe(400);
            }
        });
    });

    describe('configurations', () => {
        const rubric = {rubrics: [{name: 'Clarity', criteria: [{name: 'Structure', minPoints: 0, maxPoints: 2}]}]};

        test('create, read, update, delete an own assessment configuration', async () => {
            const created = await call('post', '/rest/v1/configurations', {name: 'REST rubric', type: 'assessment', content: rubric});
            expect(created.statusCode).toBe(201);
            const id = created.body.configuration.id;
            expect(created.body.configuration.type).toBe(0);
            expect((await call('get', '/rest/v1/configurations/' + id)).body.configuration.content).toEqual(rubric);
            const changed = {rubrics: [{name: 'Clarity', criteria: [{name: 'Structure', minPoints: 0, maxPoints: 4}]}]};
            expect((await call('patch', '/rest/v1/configurations/' + id, {content: changed})).statusCode).toBe(200);
            expect((await call('delete', '/rest/v1/configurations/' + id)).statusCode).toBe(200);
        });

        test('content must fit the type', async () => {
            const cases = [
                {type: 'assessment', content: {}},
                {type: 'assessment', content: {rubrics: [{name: 'x', criteria: [{name: 'y', minPoints: 3, maxPoints: 1}]}]}},
                {type: 'validation', content: {}},
            ];
            for (const body of cases) {
                const res = await call('post', '/rest/v1/configurations', {name: 'bad', ...body});
                expect(res.statusCode).toBe(400);
                expect(res.body.message).toBe('errors.rest.invalidConfigurationContent');
            }
        });

        test('writes need the manage right; another user cannot change mine', async () => {
            const id = (await call('post', '/rest/v1/configurations', {name: 'REST mine', type: 'dialoguePlan', content: {}})).body.configuration.id;
            const readOnly = (await request(server.http).post('/auth/api-tokens').set('Cookie', cookie)
                .send({name: 'no manage', rights: ['frontend.dashboard.api_tokens.view']})).body;
            try {
                expect((await call('post', '/rest/v1/configurations', {name: 'x', type: 'dialoguePlan', content: {}}, readOnly)).statusCode).toBe(403);
                expect((await call('get', '/rest/v1/configurations/' + id, undefined, readOnly)).statusCode).toBe(200);
                expect((await call('patch', '/rest/v1/configurations/' + id, {name: 'x'}, otherToken)).statusCode).toBe(403);
            } finally {
                await request(server.http).delete('/auth/api-tokens/' + readOnly.token.id).set('Cookie', cookie);
                await call('delete', '/rest/v1/configurations/' + id);
            }
        });
    });
});
