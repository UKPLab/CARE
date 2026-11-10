const Server = require("../webserver/Server.js");
const {getSocketClient} = require("./utils.js");
const assessmentReferences = require("../utils/helper/assessmentReferences.js");
const AssessmentSocket = require("../webserver/sockets/assessment.js");

// production default, read before any test switches the flag
const DEFAULT_DELETE_ENABLED = AssessmentSocket.deleteEnabled;

/**
 * Socket tests for assessment versions and their rubric associations (Stage 2C of the versioned
 * assessments): retrieve, create, new version, delete with reference protection, permissions,
 * validation, rollback, immutability and the delete / reference concurrency scenarios.
 *
 * `assessmentDelete` is temporarily disabled in production (`AssessmentSocket.deleteEnabled = false`)
 * until the writers take the assessment row lock. The tests of the preserved delete logic switch the
 * flag on for the whole file; the "temporary delete restriction" block switches it off again.
 */
describe("Test Websockets - Assessment", () => {
    const PORT = 3110;
    const tag = `t${Date.now()}`;
    let counter = 0;
    const next = () => `${tag}-${++counter}`;

    let server;
    let admin;        // administrator
    let allowed;      // plain user that was granted the dashboard right
    let denied;       // plain user without the right
    let db;
    let adminUserId;
    let workflowStepId;
    let triggerEventId;
    let triggerActionId;
    const sockets = [];
    const created = {
        assessment: [], rubric: [], criterion: [], users: [], roles: [],
        study: [], study_step: [], trigger: [], trigger_action: [], trigger_queue: [],
    };

    /** emit and wait for the acknowledgement */
    const call = (socket, event, data = {}) => new Promise((resolve) => socket.emit(event, data, resolve));
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const query = async (sql, replacements, transaction) => {
        const [rows] = await db.sequelize.query(sql, {replacements, transaction});
        return rows;
    };

    /** a committed rubric version, optionally with one criterion (that has one scoring option) */
    const newRubric = async (withCriterion = false) => {
        const {rubric, criterion, criterion_scoring_option, rubric_criterion} = db.models;
        const row = await db.sequelize.transaction(async (transaction) => {
            const r = await rubric.create(
                {versionNumber: "1", name: next(), description: "", minPoints: -2, maxPoints: 4}, {transaction});
            if (withCriterion) {
                const c = await criterion.create(
                    {versionNumber: "1", name: next(), description: "", subjective: false, expertLevel: 1}, {transaction});
                created.criterion.push(c.id);
                await criterion_scoring_option.create({criterionId: c.id, points: -1, description: "opt", position: 1}, {transaction});
                await rubric_criterion.create({rubricId: r.id, criterionId: c.id, criterionPositionInRubric: 1}, {transaction});
            }
            return r;
        });
        created.rubric.push(row.id);
        return row;
    };
    const rubrics = (n, withCriterion = false) => Promise.all(Array.from({length: n}, () => newRubric(withCriterion)));

    const base = (data = {}) => ({versionNumber: "1", name: next(), description: "An assessment", ...data});

    const create = async (data = {}, socket = admin) => {
        const response = await call(socket, "assessmentCreate", base(data));
        expect(response.success).toBe(true);
        created.assessment.push(response.data.id);
        return response.data;
    };
    const addVersion = async (data, socket = admin) => {
        const response = await call(socket, "assessmentCreateVersion", data);
        if (response.success) {
            created.assessment.push(response.data.id);
        }
        return response;
    };
    const countByName = (name) => db.models.assessment.count({where: {name}});
    const links = (assessmentId) => db.models.assessment_rubric.findAll({where: {assessmentId}, order: [["rubricPositionInAssessment", "ASC"]], raw: true});
    const rubricIdsOf = (assessment) => assessment.rubrics.map((link) => link.rubricId);

    // ---- reference holders (raw SQL: the real writers do not exist yet) ----
    const addStudy = async (template = false) => {
        const [row] = await query(
            'INSERT INTO study (hash, template, "createdAt", "updatedAt") VALUES (:hash, :template, now(), now()) RETURNING id',
            {hash: next(), template});
        created.study.push(row.id);
        return row.id;
    };
    const addStep = async (configuration, {template = false, deleted = false, transaction} = {}) => {
        const studyId = await addStudy(template);
        const [row] = await query(
            `INSERT INTO study_step ("studyId", "workflowStepId", "stepType", configuration, deleted, "createdAt", "updatedAt")
             VALUES (:studyId, :workflowStepId, 1, CAST(:configuration AS jsonb), :deleted, now(), now()) RETURNING id`,
            {studyId, workflowStepId, configuration: JSON.stringify(configuration), deleted}, transaction);
        created.study_step.push(row.id);
        return row.id;
    };
    const addTrigger = async (configuration, deleted = false) => {
        const [row] = await query(
            `INSERT INTO "trigger" (name, "userId", "triggerEventId", "triggerActionId", configuration, deleted)
             VALUES (:name, :userId, :triggerEventId, :triggerActionId, CAST(:configuration AS jsonb), :deleted) RETURNING id`,
            {name: next(), userId: adminUserId, triggerEventId, triggerActionId, configuration: JSON.stringify(configuration), deleted});
        created.trigger.push(row.id);
        return row.id;
    };
    const addTriggerAction = async (configuration) => {
        const [row] = await query(
            "INSERT INTO trigger_action (name, configuration) VALUES (:name, CAST(:configuration AS jsonb)) RETURNING id",
            {name: next(), configuration: JSON.stringify(configuration)});
        created.trigger_action.push(row.id);
        return row.id;
    };
    const addQueueRun = async (configuration, status) => {
        const triggerId = await addTrigger({});
        const [row] = await query(
            'INSERT INTO trigger_queue ("triggerId", status, configuration) VALUES (:triggerId, :status, CAST(:configuration AS jsonb)) RETURNING id',
            {triggerId, status, configuration: JSON.stringify(configuration)});
        created.trigger_queue.push(row.id);
        return row.id;
    };

    const registerUser = async (userName) => {
        const {genSalt, genPwdHash} = require("../webserver/auth/utils.js");
        const salt = genSalt();
        const user = await db.models.user.create({
            userName, email: `${userName}@test.de`, firstName: "t", lastName: "u",
            passwordHash: await genPwdHash("testuser", salt), salt,
            acceptTerms: true, acceptStats: false, emailVerified: true,
        });
        created.users.push(user.id);
        return user;
    };

    beforeAll(async () => {
        AssessmentSocket.deleteEnabled = true;
        db = require("../db/index.js");
        server = new Server();
        server.start(PORT);
        admin = await getSocketClient(server, PORT, process.env.ADMIN_EMAIL, process.env.ADMIN_PWD);
        sockets.push(admin);

        adminUserId = (await query('SELECT id FROM "user" WHERE "userName" = \'admin\''))[0].id;
        workflowStepId = (await query("SELECT id FROM workflow_step ORDER BY id LIMIT 1"))[0].id;
        triggerEventId = (await query("SELECT id FROM trigger_event ORDER BY id LIMIT 1"))[0].id;
        triggerActionId = (await query("SELECT id FROM trigger_action ORDER BY id LIMIT 1"))[0].id;

        const allowedUser = await registerUser(`${tag}allowed`);
        const role = await db.models.user_role.create({name: `${tag}role`, description: "test", deleted: false});
        created.roles.push(role.id);
        await db.models.role_right_matching.create({userRoleId: role.id, userRightName: "frontend.dashboard.assessments.view"});
        await db.models.user_role_matching.create({userId: allowedUser.id, userRoleId: role.id, deleted: false});
        await registerUser(`${tag}denied`);

        allowed = await getSocketClient(server, PORT, `${tag}allowed`, "testuser");
        denied = await getSocketClient(server, PORT, `${tag}denied`, "testuser");
        sockets.push(allowed, denied);
    });

    afterAll(async () => {
        AssessmentSocket.deleteEnabled = DEFAULT_DELETE_ENABLED;
        sockets.forEach((socket) => socket.connected && socket.disconnect());
        const remove = (sql, replacements) => db.sequelize.query(sql, {replacements});
        const ids = (key) => (created[key].length ? created[key] : [0]);
        await remove('DELETE FROM trigger_queue WHERE id IN (:ids)', {ids: ids("trigger_queue")});
        await remove('DELETE FROM "trigger" WHERE id IN (:ids)', {ids: ids("trigger")});
        await remove('DELETE FROM trigger_action WHERE id IN (:ids)', {ids: ids("trigger_action")});
        await remove('DELETE FROM study_step WHERE id IN (:ids)', {ids: ids("study_step")});
        await remove('DELETE FROM study WHERE id IN (:ids)', {ids: ids("study")});
        // reference order so RESTRICT keys never block the cleanup; links cascade
        await db.models.assessment.destroy({where: {id: created.assessment}});
        await db.models.rubric.destroy({where: {id: created.rubric}});
        await db.models.criterion.destroy({where: {id: created.criterion}});
        await remove('DELETE FROM "user_role_matching" WHERE "userId" IN (:ids) OR "userRoleId" IN (:roles)', {ids: created.users, roles: created.roles});
        await remove('DELETE FROM "role_right_matching" WHERE "userRoleId" IN (:roles)', {roles: created.roles});
        await remove('DELETE FROM "user_role" WHERE id IN (:roles)', {roles: created.roles});
        await remove('DELETE FROM "user" WHERE id IN (:ids)', {ids: created.users});
        server.stop();
    });

    describe("create assessment", () => {
        test("creates the assessment with generated ids and ordered rubric associations", async () => {
            const [a, b, c] = await rubrics(3);
            const data = await create({versionNumber: "1.0.1", rubricIds: [c.id, a.id, b.id]});

            expect(Number.isInteger(data.id)).toBe(true);
            expect(Number.isInteger(data.assessmentGroupId)).toBe(true);
            expect(data).toMatchObject({versionNumber: "1.0.1", description: "An assessment"});
            expect(data.createdAt).toBeDefined();
            // array order is kept (not sorted by id), positions start at 1
            expect(data.rubrics.map((l) => [l.rubricId, l.rubricPositionInAssessment])).toEqual([[c.id, 1], [a.id, 2], [b.id, 3]]);
            // each occurrence has its own association id, the same as the database row
            const ids = data.rubrics.map((l) => l.id);
            expect(new Set(ids).size).toBe(3);
            expect((await links(data.id)).map((l) => l.id)).toEqual(ids);
            expect(data.rubrics.every((l) => l.assessmentId === data.id)).toBe(true);
            expect(data.rubrics[0].rubric).toMatchObject({id: c.id, name: c.name, minPoints: -2, maxPoints: 4});
        });

        test("a second assessment gets its own group", async () => {
            const a = await create();
            const b = await create();
            expect(a.assessmentGroupId).not.toBe(b.assessmentGroupId);
        });

        test("same name is allowed; empty rubric list and string ids are accepted", async () => {
            const name = next();
            const [a] = await rubrics(1);
            await create({name});
            const second = await create({name, rubricIds: [String(a.id)]});
            expect(rubricIdsOf(second)).toEqual([a.id]);
            expect((await create({rubricIds: undefined})).rubrics).toEqual([]);
            expect((await create({description: ""})).description).toBe("");
        });
    });

    describe("retrieve assessments", () => {
        test("returns rubrics with their criteria, association ids and scoring options (plain numbers)", async () => {
            const [r1, r2] = await rubrics(2, true);
            const row = await create({rubricIds: [r2.id, r1.id]});

            const rubric = row.rubrics[0].rubric;
            expect(rubric.id).toBe(r2.id);
            expect(rubric.criteria).toHaveLength(1);
            expect(Number.isInteger(rubric.criteria[0].id)).toBe(true);          // criterion association id
            expect(rubric.criteria[0].criterion.scoringOptions).toEqual([
                expect.objectContaining({points: -1, description: "opt", position: 1}),
            ]);
            expect(typeof rubric.minPoints).toBe("number");
            expect(typeof rubric.criteria[0].criterion.scoringOptions[0].points).toBe("number");
        });

        test("assessmentGetAll returns every version, historical ones included, in order", async () => {
            const [a, b] = await rubrics(2);
            const first = await create({versionNumber: "1", rubricIds: [a.id, b.id]});
            const second = (await addVersion({copyFromId: first.id, versionNumber: "2", rubricIds: [b.id, a.id]})).data;

            const response = await call(admin, "assessmentGetAll");
            expect(response.success).toBe(true);
            expect(response.data.filter((r) => r.assessmentGroupId === first.assessmentGroupId).map((r) => r.id)).toEqual([first.id, second.id]);
            expect(response.data.find((r) => r.id === first.id)).toEqual(first);
            expect(response.data.find((r) => r.id === second.id).rubrics.map((l) => l.rubricPositionInAssessment)).toEqual([1, 2]);
        });

        test("assessmentGet returns one version by id", async () => {
            const [a] = await rubrics(1, true);
            const row = await create({rubricIds: [a.id]});
            const response = await call(admin, "assessmentGet", {assessmentId: row.id});
            expect(response.success).toBe(true);
            expect(response.data).toEqual(row);
        });

        test.each([[999999999], ["abc"], [null], [undefined], [-1]])("assessmentGet with id %p fails", async (assessmentId) => {
            expect(await call(admin, "assessmentGet", {assessmentId}))
                .toMatchObject({success: false, key: "errors.assessment.assessment.notFound"});
        });
    });

    describe("create a new version", () => {
        test("adds a version to the group with new association ids and leaves earlier versions unchanged", async () => {
            const [a, b] = await rubrics(2);
            const v1 = await create({versionNumber: "1", rubricIds: [a.id, b.id]});
            const linksBefore = await links(v1.id);

            const response = await addVersion({assessmentGroupId: v1.assessmentGroupId, copyFromId: v1.id, versionNumber: "2"});
            expect(response.success).toBe(true);
            expect(response.data.id).not.toBe(v1.id);
            expect(response.data.assessmentGroupId).toBe(v1.assessmentGroupId);
            expect(rubricIdsOf(response.data)).toEqual([a.id, b.id]);
            const oldAssociationIds = v1.rubrics.map((l) => l.id);
            expect(response.data.rubrics.map((l) => l.id).filter((id) => oldAssociationIds.includes(id))).toEqual([]);

            expect((await call(admin, "assessmentGet", {assessmentId: v1.id})).data).toEqual(v1);
            expect(await links(v1.id)).toEqual(linksBefore);
        });

        test("copying keeps properties and rubrics; overrides change the properties, selection and order", async () => {
            const [a, b, c] = await rubrics(3);
            const v1 = await create({versionNumber: "1", rubricIds: [a.id, b.id]});

            const same = await addVersion({copyFromId: v1.id, versionNumber: "1.1"});
            expect(same.data).toMatchObject({name: v1.name, description: v1.description, versionNumber: "1.1", assessmentGroupId: v1.assessmentGroupId});
            expect(rubricIdsOf(same.data)).toEqual([a.id, b.id]);

            const changed = await addVersion({copyFromId: v1.id, versionNumber: "2", name: "renamed", rubricIds: [c.id, b.id, a.id]});
            expect(changed.data.name).toBe("renamed");
            expect(rubricIdsOf(changed.data)).toEqual([c.id, b.id, a.id]);

            expect(rubricIdsOf((await addVersion({copyFromId: v1.id, versionNumber: "3", rubricIds: [b.id]})).data)).toEqual([b.id]);
            expect((await addVersion({copyFromId: v1.id, versionNumber: "4", rubricIds: []})).data.rubrics).toEqual([]);
            expect((await call(admin, "assessmentGet", {assessmentId: v1.id})).data).toEqual(v1);
        });

        test("newer rubric versions are never picked up automatically", async () => {
            const [old] = await rubrics(1);
            const first = await create({rubricIds: [old.id]});
            // a newer version of the rubric appears; the copy still points at the old one
            const {rubric} = db.models;
            const newer = await rubric.create({rubricGroupId: old.rubricGroupId, versionNumber: "2", name: old.name, description: "", minPoints: 0, maxPoints: 1});
            created.rubric.push(newer.id);
            const copy = await addVersion({copyFromId: first.id, versionNumber: "2"});
            expect(rubricIdsOf(copy.data)).toEqual([old.id]);
        });

        test("without copyFromId all properties must be sent", async () => {
            const [a] = await rubrics(1);
            const v1 = await create();
            const missing = await addVersion({assessmentGroupId: v1.assessmentGroupId, versionNumber: "2"});
            expect(missing).toMatchObject({success: false, key: "errors.assessment.fieldRequired", params: {field: "name"}});

            const response = await addVersion(base({assessmentGroupId: v1.assessmentGroupId, versionNumber: "2", rubricIds: [a.id]}));
            expect(response.success).toBe(true);
            expect(response.data.assessmentGroupId).toBe(v1.assessmentGroupId);
        });

        test("duplicate version numbers within a group are rejected and nothing is left behind", async () => {
            const [a] = await rubrics(1);
            const v1 = await create({versionNumber: "1", rubricIds: [a.id]});
            const linksBefore = await db.models.assessment_rubric.count();
            const response = await addVersion({copyFromId: v1.id, versionNumber: "1"});
            expect(response).toMatchObject({success: false, key: "errors.assessment.assessment.versionExists", params: {versionNumber: "1"}});
            expect(await db.models.assessment.count({where: {assessmentGroupId: v1.assessmentGroupId}})).toBe(1);
            expect(await db.models.assessment_rubric.count()).toBe(linksBefore);
        });

        test("the same version number may be used in another group", async () => {
            const a = await create({versionNumber: "1"});
            const b = await create({versionNumber: "1"});
            expect(a.assessmentGroupId).not.toBe(b.assessmentGroupId);
        });

        test("unknown or invalid group and source ids are rejected", async () => {
            const other = await create();
            const v1 = await create();
            const cases = [
                [{...base(), assessmentGroupId: 999999999}, "errors.assessment.assessment.groupNotFound"],
                [{...base(), assessmentGroupId: "abc"}, "errors.assessment.assessment.groupNotFound"],
                [{...base(), assessmentGroupId: 0}, "errors.assessment.assessment.groupNotFound"],
                [base(), "errors.assessment.fieldRequired"],
                [{copyFromId: 999999999, versionNumber: "2"}, "errors.assessment.assessment.notFound"],
                [{copyFromId: v1.id, assessmentGroupId: other.assessmentGroupId, versionNumber: "2"}, "errors.assessment.assessment.copySourceMismatch"],
            ];
            for (const [payload, key] of cases) {
                expect(await call(admin, "assessmentCreateVersion", payload)).toMatchObject({success: false, key});
            }
        });
    });

    describe("rubric selection", () => {
        test("the same rubric version can be reused in different assessments and versions", async () => {
            const [a, b] = await rubrics(2);
            const s1 = await create({rubricIds: [a.id, b.id]});
            const s2 = await create({rubricIds: [a.id]});
            const s1v2 = (await addVersion({copyFromId: s1.id, versionNumber: "2"})).data;

            const associationIds = [s1, s2, s1v2].map((s) => s.rubrics.find((l) => l.rubricId === a.id).id);
            expect(new Set(associationIds).size).toBe(3);
            expect(await db.models.assessment_rubric.count({where: {rubricId: a.id}})).toBe(3);
            expect(await db.models.rubric.count({where: {id: a.id}})).toBe(1);
        });

        test("duplicate rubric selections are rejected, including a number and its string form", async () => {
            const [a, b] = await rubrics(2);
            for (const ids of [[a.id, b.id, a.id], [a.id, String(a.id)]]) {
                const name = next();
                const response = await call(admin, "assessmentCreate", base({name, rubricIds: ids}));
                expect(response).toMatchObject({success: false, key: "errors.assessment.assessment.duplicateRubric", params: {rubricId: a.id}});
                expect(await countByName(name)).toBe(0);
            }
        });

        test("nonexistent rubric ids are rejected and nothing is stored", async () => {
            const [a] = await rubrics(1);
            const name = next();
            const linksBefore = await db.models.assessment_rubric.count();
            const response = await call(admin, "assessmentCreate", base({name, rubricIds: [a.id, 999999999, 999999998]}));
            expect(response).toMatchObject({success: false, key: "errors.assessment.assessment.rubricsNotFound", params: {rubricIds: "999999999, 999999998"}});
            expect(await countByName(name)).toBe(0);
            expect(await db.models.assessment_rubric.count()).toBe(linksBefore);

            const v1 = await create({rubricIds: [a.id]});
            expect(await addVersion({copyFromId: v1.id, versionNumber: "2", rubricIds: [999999999]}))
                .toMatchObject({success: false, key: "errors.assessment.assessment.rubricsNotFound"});
        });

        test.each([
            ["not an array", {}],
            ["a zero", [0]],
            ["a negative id", [-3]],
            ["a decimal", [1.5]],
            ["a word", ["abc"]],
            ["null", [null]],
            ["an object", [{id: 1}]],
        ])("invalid rubricIds (%s) are rejected", async (_label, rubricIds) => {
            expect(await call(admin, "assessmentCreate", base({rubricIds})))
                .toMatchObject({success: false, key: "errors.assessment.fieldInvalid", params: {field: "rubricIds"}});
        });
    });

    describe("temporary delete restriction", () => {
        beforeEach(() => {
            AssessmentSocket.deleteEnabled = false;
        });
        afterEach(() => {
            AssessmentSocket.deleteEnabled = true;
        });

        const disabled = {success: false, key: "errors.assessment.assessment.deleteDisabled"};

        test("deletion is off by default in the code", () => {
            expect(DEFAULT_DELETE_ENABLED).toBe(false);
        });

        test("the event refuses an unreferenced assessment and changes nothing", async () => {
            const [a] = await rubrics(1);
            const row = await create({rubricIds: [a.id]});
            const response = await call(admin, "assessmentDelete", {assessmentId: row.id});
            expect(response).toMatchObject(disabled);
            expect(response.message).toMatch(/disabled/i);
            expect((await call(admin, "assessmentGet", {assessmentId: row.id})).data).toEqual(row);
            expect(await links(row.id)).toHaveLength(1);
        });

        test("every payload gets the same answer, so the event cannot be used to probe or bypass it", async () => {
            const row = await create();
            const payloads = [
                {assessmentId: row.id},
                {assessmentId: String(row.id)},
                {assessmentId: 999999999},
                {assessmentId: null},
                {assessmentId: row.id, force: true, deleteEnabled: true},
                {},
            ];
            for (const payload of payloads) {
                expect(await call(admin, "assessmentDelete", payload)).toMatchObject(disabled);
            }
            expect(await db.models.assessment.count({where: {id: row.id}})).toBe(1);
        });

        test("it applies to users with the dashboard right too, and users without it still get access denied", async () => {
            const row = await create();
            expect(await call(allowed, "assessmentDelete", {assessmentId: row.id})).toMatchObject(disabled);
            expect(await call(denied, "assessmentDelete", {assessmentId: row.id}))
                .toMatchObject({success: false, key: "errors.assessment.accessDenied"});
            expect(await db.models.assessment.count({where: {id: row.id}})).toBe(1);
        });

        test("it stops before reading references, taking the lock or deleting", async () => {
            const row = await create();
            const references = jest.spyOn(assessmentReferences, "findAssessmentReferences");
            const destroy = jest.spyOn(db.models.assessment, "destroy");
            const findByPk = jest.spyOn(db.models.assessment, "findByPk");
            try {
                expect(await call(admin, "assessmentDelete", {assessmentId: row.id})).toMatchObject(disabled);
                expect(references).not.toHaveBeenCalled();
                expect(destroy).not.toHaveBeenCalled();
                expect(findByPk).not.toHaveBeenCalled();
            } finally {
                references.mockRestore();
                destroy.mockRestore();
                findByPk.mockRestore();
            }
        });

        test("the other operations are unaffected: create, get, get all and new versions still work", async () => {
            const [a, b] = await rubrics(2);
            const v1 = await create({versionNumber: "1", rubricIds: [a.id, b.id]});
            const v2 = await addVersion({copyFromId: v1.id, versionNumber: "2", rubricIds: [b.id, a.id]});
            expect(v2.success).toBe(true);
            expect((await call(admin, "assessmentGet", {assessmentId: v1.id})).data).toEqual(v1);
            const all = (await call(admin, "assessmentGetAll")).data;
            expect(all.filter((r) => r.assessmentGroupId === v1.assessmentGroupId).map((r) => r.id)).toEqual([v1.id, v2.data.id]);
        });

        test("rubric and criterion deletion are unaffected by the restriction", async () => {
            const [unused] = await rubrics(1);
            expect((await call(admin, "rubricDelete", {rubricId: unused.id})).success).toBe(true);
        });
    });

    describe("delete an assessment version", () => {
        test("deletes an unreferenced version with its associations and leaves rubrics and other versions", async () => {
            const [a, b] = await rubrics(2);
            const v1 = await create({versionNumber: "1", rubricIds: [a.id, b.id]});
            const v2 = (await addVersion({copyFromId: v1.id, versionNumber: "2"})).data;

            const response = await call(admin, "assessmentDelete", {assessmentId: v2.id});
            expect(response).toMatchObject({success: true, data: {id: v2.id, assessmentGroupId: v1.assessmentGroupId}});

            expect(await db.models.assessment.count({where: {id: v2.id}})).toBe(0);
            expect(await db.models.assessment_rubric.count({where: {assessmentId: v2.id}})).toBe(0);
            expect(await db.models.rubric.count({where: {id: [a.id, b.id]}})).toBe(2);
            expect((await call(admin, "assessmentGet", {assessmentId: v1.id})).data).toEqual(v1);
        });

        test("deleting the first version keeps the group usable", async () => {
            const v1 = await create({versionNumber: "1"});
            const v2 = (await addVersion({copyFromId: v1.id, versionNumber: "2"})).data;
            expect((await call(admin, "assessmentDelete", {assessmentId: v1.id})).success).toBe(true);
            expect((await addVersion({copyFromId: v2.id, versionNumber: "3"})).data.assessmentGroupId).toBe(v1.assessmentGroupId);
        });

        test.each([[999999999], [null], ["abc"]])("unknown id %p fails", async (assessmentId) => {
            expect(await call(admin, "assessmentDelete", {assessmentId}))
                .toMatchObject({success: false, key: "errors.assessment.assessment.notFound"});
        });
    });

    describe("deletion is blocked by references in JSON", () => {
        /** the delete is refused, names the dependency, and leaves the assessment intact */
        const expectBlocked = async (row, expectedParams) => {
            const response = await call(admin, "assessmentDelete", {assessmentId: row.id});
            expect(response).toMatchObject({success: false, key: "errors.assessment.assessment.inUse", params: expect.objectContaining(expectedParams)});
            expect(response.message).toContain(String(row.id));
            expect((await call(admin, "assessmentGet", {assessmentId: row.id})).data).toEqual(row);
        };

        test("a study step (settings.assessmentId) blocks the delete and is named in the error", async () => {
            const [a] = await rubrics(1);
            const row = await create({rubricIds: [a.id]});
            const stepId = await addStep({settings: {assessmentId: row.id}});
            await expectBlocked(row, {assessmentId: row.id, count: 1, studySteps: String(stepId), templateSteps: "-", triggers: "-"});
        });

        test("a string id, a deeper path, or a soft-deleted step still block", async () => {
            const asString = await create();
            await addStep({settings: {assessmentId: String(asString.id)}});
            await expectBlocked(asString, {count: 1});

            const deep = await create();
            await addStep({services: [{inputs: {nested: [{assessmentId: deep.id}]}}]});
            await expectBlocked(deep, {count: 1});

            const softDeleted = await create();
            await addStep({settings: {assessmentId: softDeleted.id}}, {deleted: true});
            await expectBlocked(softDeleted, {count: 1});
        });

        test("a step of a study template is reported separately from a study step", async () => {
            const row = await create();
            const templateStep = await addStep({settings: {assessmentId: row.id}}, {template: true});
            const studyStep = await addStep({settings: {assessmentId: row.id}});
            await expectBlocked(row, {count: 2, studySteps: String(studyStep), templateSteps: String(templateStep)});
        });

        test("legacy configurationId is another id space and does not block", async () => {
            const row = await create();
            await addStep({settings: {configurationId: row.id}});
            await addStep({configurationId: row.id});
            await addStep({settings: {assessmentId: row.id + 1000000}});
            expect((await call(admin, "assessmentDelete", {assessmentId: row.id})).success).toBe(true);
        });

        test("a trigger, a trigger action and a pending or running trigger run block", async () => {
            const mapping = (id) => ({skillParameterMappings: {assessment: {table: "assessment", fileIds: [id]}}});
            const byTrigger = await create();
            const triggerId = await addTrigger(mapping(byTrigger.id));
            await expectBlocked(byTrigger, {count: 1, triggers: String(triggerId), triggerActions: "-"});

            const byAction = await create();
            const actionId = await addTriggerAction({data: mapping(String(byAction.id))});
            await expectBlocked(byAction, {count: 1, triggerActions: String(actionId)});

            const byRun = await create();
            const pending = await addQueueRun({trigger: mapping(byRun.id)}, 0);
            const running = await addQueueRun({trigger: mapping(byRun.id)}, 1);
            await expectBlocked(byRun, {count: 2, queuedRuns: `${pending}, ${running}`});
        });

        test("an AI hook input of type assessment blocks", async () => {
            const row = await create();
            await addStep({services: [{hookId: 1, inputs: [{type: "assessment", assessmentId: row.id}]}]});
            await expectBlocked(row, {count: 1});
        });

        test("finished or soft-deleted trigger rows and a configuration table mapping do not block", async () => {
            const row = await create();
            await addTrigger({skillParameterMappings: {a: {table: "assessment", fileIds: [row.id]}}}, true);
            await addQueueRun({trigger: {a: {table: "assessment", fileIds: [row.id]}}}, 2);
            await addQueueRun({trigger: {a: {table: "assessment", fileIds: [row.id]}}}, 4);
            await addTrigger({skillParameterMappings: {a: {table: "configuration", fileIds: [row.id]}}});
            expect((await call(admin, "assessmentDelete", {assessmentId: row.id})).success).toBe(true);
        });

        test("once the reference is gone the version can be deleted", async () => {
            const row = await create();
            const stepId = await addStep({settings: {assessmentId: row.id}});
            expect((await call(admin, "assessmentDelete", {assessmentId: row.id})).success).toBe(false);
            await query("DELETE FROM study_step WHERE id = :stepId", {stepId});
            expect((await call(admin, "assessmentDelete", {assessmentId: row.id})).success).toBe(true);
        });

        test("another version of the same group can be deleted while one is referenced", async () => {
            const v1 = await create({versionNumber: "1"});
            const v2 = (await addVersion({copyFromId: v1.id, versionNumber: "2"})).data;
            await addStep({settings: {assessmentId: v1.id}});
            expect((await call(admin, "assessmentDelete", {assessmentId: v2.id})).success).toBe(true);
            expect(await db.models.assessment.count({where: {id: v1.id}})).toBe(1);
        });

        test("collectAssessmentIds finds the same shapes the delete check matches", () => {
            const {collectAssessmentIds} = assessmentReferences;
            expect(collectAssessmentIds({settings: {assessmentId: 4}, configurationId: 9})).toEqual([4]);
            expect(collectAssessmentIds({services: [{inputs: [{type: "assessment", assessmentId: "5"}]}]})).toEqual([5]);
            expect(collectAssessmentIds({m: {a: {table: "assessment", fileIds: [6, "7"]}, b: {table: "configuration", fileIds: [8]}}})).toEqual([6, 7]);
            expect(collectAssessmentIds(null)).toEqual([]);
            expect(collectAssessmentIds({assessmentId: "x"})).toEqual([]);
        });
    });

    describe("concurrent delete and reference", () => {
        /**
         * Runs the real delete handler but pauses it after it holds the row lock and has read the
         * references, until `release()` is called.
         * @returns {{entered: Promise, release: Function, restore: Function}}
         */
        const pauseDeleteAfterCheck = () => {
            const original = assessmentReferences.findAssessmentReferences;
            let release;
            const gate = new Promise((resolve) => { release = resolve; });
            let enter;
            const entered = new Promise((resolve) => { enter = resolve; });
            const spy = jest.spyOn(assessmentReferences, "findAssessmentReferences").mockImplementationOnce(async (...args) => {
                const result = await original(...args);
                enter();
                await gate;
                return result;
            });
            return {entered, release, restore: () => spy.mockRestore()};
        };
        const pending = async (promise) => Promise.race([promise.then(() => false), sleep(400).then(() => true)]);

        test("a writer that holds the lock first: the delete waits, then sees the reference and refuses", async () => {
            const row = await create();
            const writer = await db.sequelize.transaction();
            let committed = false;
            try {
                await assessmentReferences.lockAssessmentForReference(db.sequelize, row.id, writer);
                await addStep({settings: {assessmentId: row.id}}, {transaction: writer});

                const deleting = call(admin, "assessmentDelete", {assessmentId: row.id});
                expect(await pending(deleting)).toBe(true);            // blocked behind the writer's lock

                await writer.commit();
                committed = true;
                expect(await deleting).toMatchObject({success: false, key: "errors.assessment.assessment.inUse"});
            } finally {
                if (!committed) {
                    await writer.rollback();
                }
            }
            expect(await db.models.assessment.count({where: {id: row.id}})).toBe(1);
        });

        test("the delete holds the lock first: a writer that follows the protocol waits, then finds the row gone", async () => {
            const row = await create();
            const pause = pauseDeleteAfterCheck();
            const writer = await db.sequelize.transaction();
            try {
                const deleting = call(admin, "assessmentDelete", {assessmentId: row.id});
                await pause.entered;

                const locking = assessmentReferences.lockAssessmentForReference(db.sequelize, row.id, writer)
                    .then(() => "locked", (error) => error);
                expect(await pending(locking)).toBe(true);             // waits for the delete

                pause.release();
                expect((await deleting).success).toBe(true);
                const outcome = await locking;
                expect(outcome.key).toBe("errors.assessment.assessment.notFound");   // no reference can be saved
            } finally {
                pause.restore();
                await writer.rollback();
            }
            expect(await db.models.assessment.count({where: {id: row.id}})).toBe(0);
        });

        test("KNOWN LIMITATION: a writer that does not take the lock can still save a reference during a delete", async () => {
            // Documents why the delete is not yet fully race-safe: the writers (study steps, triggers, hooks)
            // are not changed in this stage, so nothing stops them from writing without the row lock.
            const row = await create();
            const pause = pauseDeleteAfterCheck();
            let stepId;
            try {
                const deleting = call(admin, "assessmentDelete", {assessmentId: row.id});
                await pause.entered;
                stepId = await addStep({settings: {assessmentId: row.id}});   // no lock: not blocked
                pause.release();
                expect((await deleting).success).toBe(true);
            } finally {
                pause.restore();
            }
            // a reference to an assessment that no longer exists: exactly what the writer-side lock prevents
            expect(await db.models.assessment.count({where: {id: row.id}})).toBe(0);
            const [step] = await query("SELECT configuration FROM study_step WHERE id = :stepId", {stepId});
            expect(assessmentReferences.collectAssessmentIds(step.configuration)).toEqual([row.id]);
        });

        test("the writer-side lock refuses an assessment that does not exist", async () => {
            const writer = await db.sequelize.transaction();
            try {
                await expect(assessmentReferences.lockAssessmentForReference(db.sequelize, 999999999, writer))
                    .rejects.toMatchObject({key: "errors.assessment.assessment.notFound"});
            } finally {
                await writer.rollback();
            }
        });
    });

    describe("permissions", () => {
        test("a user without the dashboard right is rejected on every event", async () => {
            const row = await create();
            const before = await db.models.assessment.count();
            const requests = [
                ["assessmentGetAll", {}],
                ["assessmentGet", {assessmentId: row.id}],
                ["assessmentCreate", base()],
                ["assessmentCreateVersion", {copyFromId: row.id, versionNumber: "2"}],
                ["assessmentDelete", {assessmentId: row.id}],
            ];
            for (const [event, payload] of requests) {
                expect(await call(denied, event, payload))
                    .toMatchObject({success: false, key: "errors.assessment.accessDenied"});
            }
            expect(await db.models.assessment.count()).toBe(before);
        });

        test("a user with the right may use every event on assessments created by someone else", async () => {
            const [a] = await rubrics(1);
            const row = await create({rubricIds: [a.id]}, admin);
            expect((await call(allowed, "assessmentGet", {assessmentId: row.id})).success).toBe(true);
            expect((await call(allowed, "assessmentGetAll")).data.map((r) => r.id)).toContain(row.id);

            const version = await addVersion({copyFromId: row.id, versionNumber: "2"}, allowed);
            expect(version.success).toBe(true);
            expect((await create({}, allowed)).id).toBeDefined();

            expect((await call(allowed, "assessmentDelete", {assessmentId: version.data.id})).success).toBe(true);
            expect((await call(allowed, "assessmentDelete", {assessmentId: row.id})).success).toBe(true);
        });
    });

    describe("validation and rollback", () => {
        test.each([
            ["versionNumber missing", {versionNumber: undefined}, "errors.assessment.fieldRequired", {field: "versionNumber"}],
            ["versionNumber blank", {versionNumber: "  "}, "errors.assessment.fieldRequired", {field: "versionNumber"}],
            ["versionNumber not a string", {versionNumber: {}}, "errors.assessment.fieldInvalid", {field: "versionNumber"}],
            ["versionNumber too long", {versionNumber: "x".repeat(256)}, "errors.assessment.fieldInvalid", {field: "versionNumber"}],
            ["name missing", {name: undefined}, "errors.assessment.fieldRequired", {field: "name"}],
            ["name blank", {name: " "}, "errors.assessment.fieldRequired", {field: "name"}],
            ["name not a string", {name: 5}, "errors.assessment.fieldInvalid", {field: "name"}],
            ["name too long", {name: "x".repeat(256)}, "errors.assessment.fieldInvalid", {field: "name"}],
            ["description missing", {description: undefined}, "errors.assessment.fieldRequired", {field: "description"}],
            ["description not a string", {description: 3}, "errors.assessment.fieldInvalid", {field: "description"}],
        ])("create rejects: %s and stores nothing", async (_label, override, key, params) => {
            const name = next();
            const response = await call(admin, "assessmentCreate", base({name, ...override}));
            expect(response.success).toBe(false);
            expect(response.key).toBe(key);
            expect(response.params).toEqual(params);
            expect(await countByName(name)).toBe(0);
        });

        test("a database failure while inserting the associations rolls the assessment back", async () => {
            const [a, b] = await rubrics(2);
            const name = next();
            const spy = jest.spyOn(db.models.assessment_rubric, "bulkCreate").mockRejectedValueOnce(new Error("boom"));
            try {
                const response = await call(admin, "assessmentCreate", base({name, rubricIds: [a.id, b.id]}));
                expect(response.success).toBe(false);
                expect(spy).toHaveBeenCalledTimes(1);
            } finally {
                spy.mockRestore();
            }
            expect(await countByName(name)).toBe(0);
        });

        test("a failing new version leaves the source and the group unchanged", async () => {
            const [a] = await rubrics(1);
            const v1 = await create({rubricIds: [a.id]});
            const spy = jest.spyOn(db.models.assessment_rubric, "bulkCreate").mockRejectedValueOnce(new Error("boom"));
            try {
                expect((await call(admin, "assessmentCreateVersion", {copyFromId: v1.id, versionNumber: "2"})).success).toBe(false);
            } finally {
                spy.mockRestore();
            }
            expect(await db.models.assessment.count({where: {assessmentGroupId: v1.assessmentGroupId}})).toBe(1);
            expect((await addVersion({copyFromId: v1.id, versionNumber: "2"})).success).toBe(true);
        });

        test("a failing delete leaves the assessment and its associations in place", async () => {
            const [a] = await rubrics(1);
            const row = await create({rubricIds: [a.id]});
            const spy = jest.spyOn(db.models.assessment, "destroy").mockRejectedValueOnce(new Error("boom"));
            try {
                expect((await call(admin, "assessmentDelete", {assessmentId: row.id})).success).toBe(false);
            } finally {
                spy.mockRestore();
            }
            expect((await call(admin, "assessmentGet", {assessmentId: row.id})).data).toEqual(row);
        });
    });

    describe("version number format", () => {
        test.each([["1"], ["1.1"], ["1.1.1"], ["2.0.3"], [" 3.1 "]])("create accepts version %p", async (versionNumber) => {
            expect((await create({versionNumber})).versionNumber).toBe(versionNumber.trim());
        });

        test.each([["abc"], ["v1"], ["1.a"], ["1.2-beta"], ["1."], [".1"], ["1..2"], ["-1"], ["1,2"]])(
            "create rejects version %p and stores nothing", async (versionNumber) => {
                const name = next();
                const response = await call(admin, "assessmentCreate", base({name, versionNumber}));
                expect(response).toMatchObject({success: false, key: "errors.assessment.versionFormat"});
                expect(await countByName(name)).toBe(0);
            });

        test("a new version needs the format too, and the uniqueness rule still applies", async () => {
            const v1 = await create({versionNumber: "1"});
            for (const versionNumber of ["v2", "2.", "2-beta"]) {
                expect(await addVersion({copyFromId: v1.id, versionNumber}))
                    .toMatchObject({success: false, key: "errors.assessment.versionFormat"});
            }
            expect(await addVersion({copyFromId: v1.id, versionNumber: "1"}))
                .toMatchObject({success: false, key: "errors.assessment.assessment.versionExists"});
            expect((await addVersion({copyFromId: v1.id, versionNumber: "1.1"})).success).toBe(true);
            expect(await db.models.assessment.count({where: {assessmentGroupId: v1.assessmentGroupId}})).toBe(2);
        });

        test("a stored version that does not match the format stays readable, listed and copyable", async () => {
            const old = await db.models.assessment.create({versionNumber: "v1-beta", name: next(), description: ""});
            created.assessment.push(old.id);
            expect((await call(admin, "assessmentGet", {assessmentId: old.id})).data.versionNumber).toBe("v1-beta");
            expect((await call(admin, "assessmentGetAll")).data.find((r) => r.id === old.id).versionNumber).toBe("v1-beta");
            const copy = await addVersion({copyFromId: old.id, versionNumber: "2"});
            expect(copy).toMatchObject({success: true, data: {assessmentGroupId: old.assessmentGroupId, versionNumber: "2"}});
            expect((await call(admin, "assessmentGet", {assessmentId: old.id})).data.versionNumber).toBe("v1-beta");
        });
    });

    describe("immutability", () => {
        test("there is no update event for assessments", async () => {
            const row = await create();
            const ack = await Promise.race([
                call(admin, "assessmentUpdate", {assessmentId: row.id, name: "changed"}),
                sleep(300).then(() => "no handler"),
            ]);
            expect(ack).toBe("no handler");
            expect((await call(admin, "assessmentGet", {assessmentId: row.id})).data.name).toBe(row.name);
        });

        test("a committed version rejects updates, late associations and single association deletes (triggers)", async () => {
            const [a, b] = await rubrics(2);
            const row = await create({rubricIds: [a.id]});
            await expect(db.models.assessment.update({name: "changed"}, {where: {id: row.id}})).rejects.toThrow();
            await expect(db.models.assessment_rubric.create({assessmentId: row.id, rubricId: b.id, rubricPositionInAssessment: 2})).rejects.toThrow();
            await expect(db.models.assessment_rubric.update({rubricPositionInAssessment: 5}, {where: {assessmentId: row.id}})).rejects.toThrow();
            await expect(db.models.assessment_rubric.destroy({where: {assessmentId: row.id}})).rejects.toThrow();
            expect((await call(admin, "assessmentGet", {assessmentId: row.id})).data).toEqual(row);
        });

        test("a rubric used by an assessment cannot be deleted", async () => {
            const [a] = await rubrics(1);
            await create({rubricIds: [a.id]});
            await expect(db.models.rubric.destroy({where: {id: a.id}})).rejects.toThrow();
            expect(await db.models.rubric.count({where: {id: a.id}})).toBe(1);
        });
    });
});
