const request = require('supertest');
const Server = require('../webserver/Server.js');
const {addResearcherUser, enableRestForTests, allTokenRights} = require('./utils.js');

const PORT = 3123;

/**
 * Make one model method fail on its nth call, then call through again: a stand-in for a crash or
 * error halfway through a bulk write, after the first items are already written.
 *
 * @param {Object} model the model to spy on
 * @param {string} method the method name
 * @param {number} nth the call that throws
 * @returns {Object} the Jest spy
 */
function failOnCall(model, method, nth) {
    const original = model[method].bind(model);
    let calls = 0;
    return jest.spyOn(model, method).mockImplementation(async (...args) => {
        calls += 1;
        if (calls === nth) {
            throw new Error('simulated failure halfway');
        }
        return original(...args);
    });
}
const SETTING = 'system.auth.apiTokens.enabled';
const ADD_SINGLE = 'frontend.dashboard.studies.addSingleAssignments';

describe('REST assignments', () => {
    let server;
    let models;
    let cookie;
    let secret;
    let tokenId;
    let adminId;
    let workflow;
    let workflowStep;
    let template;
    let alice;
    let bob;
    let aliceDoc;
    let bobDoc;

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

        const created = await request(server.http)
            .post('/auth/api-tokens')
            .set('Cookie', cookie)
            .send({name: 'assignment tests', rights: await allTokenRights(server, cookie)});
        expect(created.statusCode).toBe(201);
        secret = created.body.secret;
        tokenId = created.body.token.id;

        workflow = await models['workflow'].add({
            name: 'REST assignment workflow',
            description: 'workflow for rest assignments',
            userId: adminId,
        });
        workflowStep = await models['workflow_step'].add({
            name: 'review',
            workflowId: workflow.id,
            stepType: 1,
            workflowStepPrevious: null,
            allowBackward: false,
            configuration: {},
        });
        template = await models['study'].add({
            name: 'REST assignment template',
            description: 'template description',
            workflowId: workflow.id,
            userId: adminId,
            template: true,
            collab: false,
            resumable: false,
            multipleSubmit: false,
            enableEmailNotifications: false,
        }, {context: {stepDocuments: []}});

        alice = (await addResearcherUser(models)).user;
        bob = (await addResearcherUser(models)).user;
        aliceDoc = await models['document'].add({name: 'alice essay', type: 1, userId: alice.id});
        bobDoc = await models['document'].add({name: 'bob essay', type: 1, userId: bob.id});
    });

    afterAll(async () => {
        const studies = await models['study'].findAll({
            where: {workflowId: workflow.id, deleted: false},
            raw: true,
        });
        for (const study of studies) {
            await models['study'].deleteById(study.id);
        }
        for (const doc of [aliceDoc, bobDoc]) {
            await models['document'].deleteById(doc.id);
        }
        for (const user of [alice, bob]) {
            await models['user'].deleteById(user.id);
        }
        await models['workflow_step'].deleteById(workflowStep.id);
        await models['workflow'].deleteById(workflow.id);
        await request(server.http).delete('/auth/api-tokens/' + tokenId).set('Cookie', cookie);
        server.stop();
    });

    function post(body, bearer = secret) {
        return request(server.http)
            .post('/rest/v1/review-assignments')
            .set('Authorization', 'Bearer ' + bearer)
            .send(body);
    }

    async function assignmentStudyCount() {
        return models['study'].count({where: {workflowId: workflow.id, template: false, deleted: false}});
    }

    describe('single assignment', () => {
        test('dryRun returns the plan and writes nothing', async () => {
            const before = await assignmentStudyCount();
            const res = await post({templateId: template.id, items: [aliceDoc.id], reviewers: [bob.id], dryRun: true});
            expect(res.statusCode).toBe(200);
            expect(res.body.dryRun).toBe(true);
            expect(res.body.plan).toEqual([{itemId: aliceDoc.id, reviewerIds: [bob.id]}]);
            expect(await assignmentStudyCount()).toBe(before);
        });

        test('creates one study owned by the document owner with a session for the reviewer', async () => {
            const res = await post({templateId: template.id, items: [aliceDoc.id], reviewers: [bob.id]});
            expect(res.statusCode).toBe(201);
            expect(res.body.studies).toHaveLength(1);
            const created = res.body.studies[0];
            expect(created.itemId).toBe(aliceDoc.id);
            expect(created.sessions.map((session) => session.userId)).toEqual([bob.id]);

            const study = await models['study'].getById(created.id);
            expect(study.userId).toBe(alice.id);
            expect(study.createdByUserId).toBe(adminId);
            expect(study.template).toBe(false);
            expect(study.limitSessions).toBe(1);
            const steps = await models['study_step'].getAllByKey('studyId', study.id);
            expect(steps[0].documentId).toBe(aliceDoc.id);
        });

        test('study fields in the body are ignored', async () => {
            const res = await post({
                templateId: template.id,
                items: [aliceDoc.id],
                reviewers: [bob.id],
                template: {name: 'injected', userId: bob.id},
                userId: bob.id,
                name: 'injected',
            });
            expect(res.statusCode).toBe(201);
            const study = await models['study'].getById(res.body.studies[0].id);
            expect(study.name).toBe(template.name);
            expect(study.userId).toBe(alice.id);
        });

        test('studyId adds reviewers to an existing study and raises its session limit', async () => {
            const first = await post({templateId: template.id, items: [aliceDoc.id], reviewers: [bob.id]});
            const studyId = first.body.studies[0].id;
            const res = await post({studyId, reviewers: [adminId]});
            expect(res.statusCode).toBe(201);
            expect(res.body.studies[0].sessions.map((session) => session.userId)).toEqual([adminId]);
            const study = await models['study'].getById(studyId);
            expect(study.limitSessions).toBe(2);
        });

        test('adding reviewers to a study without a limit keeps it unlimited', async () => {
            const first = await post({templateId: template.id, items: [aliceDoc.id], reviewers: [bob.id]});
            const studyId = first.body.studies[0].id;
            await models['study'].updateById(studyId, {limitSessions: null});
            const res = await post({studyId, reviewers: [adminId]});
            expect(res.statusCode).toBe(201);
            expect((await models['study'].getById(studyId)).limitSessions).toBeNull();
        });
    });

    describe('bulk assignment', () => {
        test('mode everyReviewer creates one study per item', async () => {
            const res = await post({templateId: template.id, items: [aliceDoc.id, bobDoc.id], reviewers: [adminId]});
            expect(res.statusCode).toBe(201);
            expect(res.body.studies.map((study) => study.itemId).sort()).toEqual([aliceDoc.id, bobDoc.id].sort());
        });

        test('mode byCount never gives a user their own document', async () => {
            const res = await post({
                templateId: template.id,
                items: [aliceDoc.id, bobDoc.id],
                mode: 'byCount',
                counts: [{userId: alice.id, items: 1}, {userId: bob.id, items: 1}],
                dryRun: true,
            });
            expect(res.statusCode).toBe(200);
            expect(res.body.plan).toEqual(expect.arrayContaining([
                {itemId: aliceDoc.id, reviewerIds: [bob.id]},
                {itemId: bobDoc.id, reviewerIds: [alice.id]},
            ]));
            expect(res.body.plan).toHaveLength(2);
        });

        test('mode byRole resolves the users of a role on the server', async () => {
            const res = await post({
                templateId: template.id,
                items: [aliceDoc.id, bobDoc.id],
                mode: 'byRole',
                roles: [{role: 'user', items: 1}],
                reviewers: [alice.id, bob.id],
                dryRun: true,
            });
            expect(res.statusCode).toBe(200);
            expect(res.body.plan).toEqual(expect.arrayContaining([
                {itemId: aliceDoc.id, reviewerIds: [bob.id]},
                {itemId: bobDoc.id, reviewerIds: [alice.id]},
            ]));
        });

        test('mode byRole with an unknown role is 404', async () => {
            const res = await post({templateId: template.id, items: [aliceDoc.id], mode: 'byRole', roles: [{role: 'nobody', items: 1}]});
            expect(res.statusCode).toBe(404);
            expect(res.body.message).toBe('errors.rest.roleNotFound');
        });

        test('a deleted role counts as unknown', async () => {
            const role = await models['user_role'].create({name: 'rest deleted role', deleted: true});
            try {
                const res = await post({templateId: template.id, items: [aliceDoc.id], mode: 'byRole', roles: [{role: role.name, items: 1}]});
                expect(res.statusCode).toBe(404);
                expect(res.body.message).toBe('errors.rest.roleNotFound');
            } finally {
                await models['user_role'].destroy({where: {id: role.id}, force: true});
            }
        });
    });

    describe('failing halfway', () => {
        test('a bulk run that fails after the first study keeps nothing, and a keyed retry creates each study once', async () => {
            const key = 'bulk-halfway-' + Date.now();
            const send = () => request(server.http).post('/rest/v1/review-assignments')
                .set('Authorization', 'Bearer ' + secret).set('Idempotency-Key', key)
                .send({templateId: template.id, items: [aliceDoc.id, bobDoc.id], reviewers: [adminId]});
            const count = () => models['study'].count({where: {workflowId: workflow.id, template: false, deleted: false}});
            const before = await count();
            // One reviewer per item: the second session belongs to the second study.
            const spy = failOnCall(models['study_session'], 'add', 2);
            try {
                const failed = await send();
                expect(failed.statusCode).toBe(500);
                expect(await count()).toBe(before);
            } finally {
                spy.mockRestore();
            }
            const retry = await send();
            expect(retry.statusCode).toBe(201);
            expect(retry.headers['idempotent-replayed']).toBeUndefined();
            expect(retry.body.studies).toHaveLength(2);
            expect(await count()).toBe(before + 2);
        });
    });

    describe('validation and missing rows', () => {
        test('rejects malformed bodies', async () => {
            const cases = [
                [{}, 'errors.rest.assignmentTargetRequired'],
                [{templateId: template.id, studyId: 1}, 'errors.rest.assignmentTargetConflict'],
                [{templateId: 'nope'}, 'errors.rest.invalidTemplateId'],
                [{templateId: template.id, reviewers: [bob.id]}, 'errors.rest.assignmentItemsRequired'],
                [{templateId: template.id, items: [aliceDoc.id]}, 'errors.rest.assignmentReviewersRequired'],
                [{templateId: template.id, items: [aliceDoc.id], reviewers: [{id: bob.id}]}, 'errors.rest.invalidReviewAssignmentField'],
                [{templateId: template.id, items: [aliceDoc.id], reviewers: [bob.id], type: 'x'}, 'errors.rest.invalidAssignmentType'],
                [{templateId: template.id, items: [aliceDoc.id], reviewers: [bob.id], mode: 'x'}, 'errors.rest.invalidAssignmentMode'],
                [{templateId: template.id, items: [aliceDoc.id], reviewers: [bob.id], type: 'study_session'}, 'errors.rest.invalidWorkflowMapping'],
                [{studyId: 1}, 'errors.rest.assignmentReviewersRequired'],
                [{templateId: template.id, items: [aliceDoc.id], mode: 'byCount', counts: {[bob.id]: 1}}, 'errors.rest.assignmentReviewersRequired'],
                [{templateId: template.id, items: [aliceDoc.id], mode: 'byCount', counts: [{userId: bob.id, items: 1}, {userId: bob.id, items: 2}]}, 'errors.rest.assignmentReviewersRequired'],
                [{templateId: template.id, items: [aliceDoc.id], mode: 'all', reviewers: [bob.id]}, 'errors.rest.invalidAssignmentMode'],
            ];
            for (const [body, message] of cases) {
                const res = await post(body);
                expect(res.statusCode).toBe(400);
                expect(res.body.message).toBe(message);
            }
        });

        test('unknown template, item, reviewer, and study are 404', async () => {
            const cases = [
                [{templateId: 99999999, items: [aliceDoc.id], reviewers: [bob.id]}, 'errors.rest.templateNotFound'],
                [{templateId: template.id, items: [99999999], reviewers: [bob.id]}, 'errors.rest.assignmentItemNotFound'],
                [{templateId: template.id, items: [aliceDoc.id], reviewers: [99999999]}, 'errors.rest.reviewerNotFound'],
                [{studyId: 99999999, reviewers: [bob.id]}, 'errors.rest.studyNotFound'],
            ];
            for (const [body, message] of cases) {
                const res = await post(body);
                expect(res.statusCode).toBe(404);
                expect(res.body.message).toBe(message);
            }
        });

        test('a study that is not a template is rejected', async () => {
            const first = await post({templateId: template.id, items: [aliceDoc.id], reviewers: [bob.id]});
            const res = await post({templateId: first.body.studies[0].id, items: [aliceDoc.id], reviewers: [bob.id]});
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('errors.rest.notAStudyTemplate');
        });
    });

    describe('token rights', () => {
        test('a token with only the single-assignment right cannot create in bulk', async () => {
            const scoped = await request(server.http)
                .post('/auth/api-tokens')
                .set('Cookie', cookie)
                .send({name: 'single only', rights: [ADD_SINGLE]});
            expect(scoped.statusCode).toBe(201);
            try {
                const single = await post(
                    {templateId: template.id, items: [aliceDoc.id], reviewers: [bob.id], dryRun: true},
                    scoped.body.secret
                );
                expect(single.statusCode).toBe(200);
                const bulk = await post(
                    {templateId: template.id, items: [aliceDoc.id, bobDoc.id], reviewers: [adminId], dryRun: true},
                    scoped.body.secret
                );
                expect(bulk.statusCode).toBe(403);
                expect(bulk.body.message).toBe('errors.rest.missingTokenRight');
            } finally {
                await request(server.http).delete('/auth/api-tokens/' + scoped.body.token.id).set('Cookie', cookie);
            }
        });
    });
});
