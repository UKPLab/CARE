const request = require('supertest');
const Server = require('../webserver/Server.js');
const {getSocketClient, addResearcherUser, enableRestForTests, allTokenRights} = require('./utils.js');

const PORT = 3129;
const SETTING = 'system.auth.apiTokens.enabled';

/**
 * REST writes reach open dashboards through the same table broadcast socket writes use,
 * and each browser only gets rows its user may see.
 */
describe('REST live refresh', () => {
    let server;
    let models;
    let secret;
    let tokenId;
    let tokenOwnerId;
    let cookie;
    let adminSocket;
    let researcherSocket;
    let researcher;

    function connected(socket) {
        return new Promise((resolve) => (socket.connected ? resolve() : socket.once('connect', resolve)));
    }

    function subscribe(socket, table) {
        return new Promise((resolve) => socket.emit('subscribeAppData', {table}, resolve));
    }

    /** Collect every `<table>Refresh` row the socket receives. */
    function collect(socket, table) {
        const rows = [];
        socket.on(table + 'Refresh', (payload) => rows.push(...(Array.isArray(payload) ? payload : [payload])));
        return rows;
    }

    async function waitFor(check, ms = 4000) {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (check()) {
                return true;
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return check();
    }

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
        const created = await request(server.http).post('/auth/api-tokens').set('Cookie', cookie).send({name: 'live refresh', rights: await allTokenRights(server, cookie)});
        secret = created.body.secret;
        tokenId = created.body.token.id;
        tokenOwnerId = created.body.token.userId;

        researcher = await addResearcherUser(models);
        adminSocket = await getSocketClient(server, PORT, process.env.ADMIN_EMAIL, process.env.ADMIN_PWD);
        researcherSocket = await getSocketClient(server, PORT, researcher.user.email, researcher.password);
        await Promise.all([connected(adminSocket), connected(researcherSocket)]);
        await subscribe(adminSocket, 'document');
        for (const table of ['project', 'tag_set', 'workflow', 'configuration', 'study']) {
            await subscribe(adminSocket, table);
        }
        await subscribe(researcherSocket, 'document');
    });

    afterAll(async () => {
        adminSocket?.disconnect();
        researcherSocket?.disconnect();
        await request(server.http).delete('/auth/api-tokens/' + tokenId).set('Cookie', cookie);
        await models['user'].deleteById(researcher.user.id);
        server.stop();
    });

    test('a document created over REST reaches the owner dashboard but not another user', async () => {
        const adminRows = collect(adminSocket, 'document');
        const researcherRows = collect(researcherSocket, 'document');
        const res = await request(server.http)
            .post('/rest/v1/documents')
            .set('Authorization', 'Bearer ' + secret)
            .send({name: 'REST live refresh'});
        expect(res.statusCode).toBe(201);
        const id = res.body.document.id;
        try {
            expect(await waitFor(() => adminRows.some((row) => row.id === id))).toBe(true);
            // Give the other socket the same time to (wrongly) receive it.
            await new Promise((resolve) => setTimeout(resolve, 300));
            expect(researcherRows.some((row) => row.id === id)).toBe(false);
        } finally {
            await models['document'].deleteById(id);
        }
    });

    test('a rename over REST reaches the dashboard too', async () => {
        const created = await request(server.http)
            .post('/rest/v1/documents')
            .set('Authorization', 'Bearer ' + secret)
            .send({name: 'REST before rename'});
        const id = created.body.document.id;
        const adminRows = collect(adminSocket, 'document');
        try {
            await request(server.http)
                .patch('/rest/v1/documents/' + id)
                .set('Authorization', 'Bearer ' + secret)
                .send({name: 'REST after rename'});
            expect(await waitFor(() => adminRows.some((row) => row.id === id && row.name === 'REST after rename'))).toBe(true);
        } finally {
            await models['document'].deleteById(id);
        }
    });

    test('a rolled-back write sends nothing to the dashboard', async () => {
        const workflow = await models['workflow'].add({name: 'REST rollback workflow', userId: 1});
        const rows = collect(adminSocket, 'study');
        const importStudies = (items) => request(server.http)
            .post('/rest/v1/studies/import')
            .set('Authorization', 'Bearer ' + secret)
            .send(items);
        let controlId = null;
        try {
            const failed = await importStudies([
                {name: 'REST rollback first', workflowId: workflow.id},
                {name: 'REST rollback second', workflowId: workflow.id, stepDocuments: [{id: 1, documentId: 99999999}]},
            ]);
            expect(failed.statusCode).toBe(400);
            // A later successful import shows the channel works; the failed one must not show up before it.
            const control = await importStudies([{name: 'REST rollback control', workflowId: workflow.id}]);
            expect(control.statusCode).toBe(201);
            controlId = control.body.studies[0].id;
            expect(await waitFor(() => rows.some((row) => row.id === controlId))).toBe(true);
            expect(rows.some((row) => row.name === 'REST rollback first')).toBe(false);
        } finally {
            if (controlId) {
                await models['study'].deleteById(controlId);
            }
            await models['workflow'].deleteById(workflow.id);
        }
    });

    test('a dashboard user who gains access gets the next REST change, despite the shared rights cache', async () => {
        const researcherRows = collect(researcherSocket, 'document');
        const post = (name) => request(server.http).post('/rest/v1/documents').set('Authorization', 'Bearer ' + secret).send({name});
        const adminRole = await models['user_role'].findOne({where: {name: 'admin'}, raw: true});
        const ids = [];
        try {
            // First write: the researcher may not see it, and the cache now remembers that.
            ids.push((await post('REST cache before')).body.document.id);
            await new Promise((resolve) => setTimeout(resolve, 300));
            expect(researcherRows.some((row) => row.id === ids[0])).toBe(false);
            // A role change reloads that user's cache entry at once.
            await models['user_role_matching'].create({userId: researcher.user.id, userRoleId: adminRole.id, deleted: false});
            ids.push((await post('REST cache after')).body.document.id);
            expect(await waitFor(() => researcherRows.some((row) => row.id === ids[1]))).toBe(true);
        } finally {
            await models['user_role_matching'].deleteUserRoles(researcher.user.id, [adminRole.id]);
            for (const id of ids) {
                await models['document'].deleteById(id);
            }
        }
    });

    test('a bulk close refreshes dashboards once, with every closed study', async () => {
        const adminId = tokenOwnerId;
        const workflow = await models['workflow'].add({name: 'REST bulk workflow', userId: adminId});
        const studies = [];
        for (const name of ['REST bulk one', 'REST bulk two']) {
            studies.push(await models['study'].add({name, workflowId: workflow.id, userId: adminId, template: false},
                {context: {stepDocuments: []}}));
        }
        const events = [];
        const listener = (payload) => events.push(Array.isArray(payload) ? payload : [payload]);
        adminSocket.on('studyRefresh', listener);
        try {
            const res = await request(server.http)
                .post('/rest/v1/studies/close')
                .set('Authorization', 'Bearer ' + secret)
                .send({ids: studies.map((study) => study.id)});
            expect(res.statusCode).toBe(200);
            expect(res.body.closedCount).toBe(2);
            const seen = () => studies.every((study) => events.flat().some((row) => row.id === study.id && row.closed));
            expect(await waitFor(seen)).toBe(true);
            await new Promise((resolve) => setTimeout(resolve, 300));
            const withOurs = events.filter((rows) => rows.some((row) => studies.some((study) => study.id === row.id)));
            expect(withOurs).toHaveLength(1);
        } finally {
            adminSocket.off('studyRefresh', listener);
            for (const study of studies) {
                await models['study'].deleteById(study.id);
            }
            await models['workflow'].deleteById(workflow.id);
        }
    });

    // One case per table created through the newer REST routes.
    const cases = [
        ['project', '/rest/v1/projects', {name: 'REST live project'}, (body) => body.project.id],
        ['tag_set', '/rest/v1/tag-sets', {name: 'REST live tags', tags: []}, (body) => body.tagSet.id],
        ['workflow', '/rest/v1/workflows/import', {name: 'REST live workflow', steps: [{name: 'Read', stepType: 1}]},
            (body) => body.workflows[0].id],
        ['configuration', '/rest/v1/configurations', {name: 'REST live config', type: 'dialoguePlan', content: {}},
            (body) => body.configuration.id],
    ];
    for (const [table, path, body, idOf] of cases) {
        test(`a ${table} created over REST reaches the open dashboard`, async () => {
            const rows = collect(adminSocket, table);
            const res = await request(server.http).post(path).set('Authorization', 'Bearer ' + secret).send(body);
            expect(res.statusCode).toBe(201);
            const id = idOf(res.body);
            try {
                expect(await waitFor(() => rows.some((row) => row.id === id))).toBe(true);
            } finally {
                await models[table].deleteById(id);
            }
        });
    }
});
