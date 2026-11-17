const Server = require("../webserver/Server.js");
const {getSocketClient} = require("./utils.js");

/**
 * Socket tests for rubric versions and their criterion associations (Stage 2B of the versioned
 * assessments): retrieve, create, new version, delete, permissions, validation, rollback, immutability.
 * Version numbers are always assigned by the backend; a client number is refused (see "client version numbers"
 * below). Numbering across kinds, concurrency and history queries are in socket.assessment_versions.test.js.
 */
describe("Test Websockets - Rubric", () => {
    const PORT = 3109;
    const tag = `t${Date.now()}`;
    let counter = 0;
    const next = () => `${tag}-${++counter}`;

    let server;
    let admin;        // administrator
    let allowed;      // plain user that was granted the dashboard right
    let denied;       // plain user without the right
    let db;
    const sockets = [];
    const created = {assessment: [], rubric: [], criterion: [], users: [], roles: []};

    /** emit and wait for the acknowledgement */
    const call = (socket, event, data = {}) => new Promise((resolve) => socket.emit(event, data, resolve));

    /** a committed criterion version (with one option) */
    const newCriterion = async (data = {}) => {
        const {criterion, criterion_scoring_option} = db.models;
        const row = await db.sequelize.transaction(async (transaction) => {
            const c = await criterion.create(
                {versionNumber: "1", name: next(), description: "", ...data}, {transaction});
            await criterion_scoring_option.create({criterionId: c.id, points: -1, description: "opt", position: 1}, {transaction});
            return c;
        });
        created.criterion.push(row.id);
        return row;
    };
    const criteria = async (n) => Promise.all(Array.from({length: n}, () => newCriterion()));

    const base = (data = {}) => ({
        name: next(),
        description: "A rubric",
        minPoints: 0,
        maxPoints: 4,
        calculation: "sum",
        ...data,
    });

    const create = async (data = {}, socket = admin) => {
        const response = await call(socket, "rubricCreate", base(data));
        expect(response.success).toBe(true);
        created.rubric.push(response.data.id);
        return response.data;
    };
    const addVersion = async (data, socket = admin) => {
        const response = await call(socket, "rubricCreateVersion", data);
        if (response.success) {
            created.rubric.push(response.data.id);
        }
        return response;
    };
    const countByName = (name) => db.models.rubric.count({where: {name}});
    const links = (rubricId) => db.models.rubric_criterion.findAll({where: {rubricId}, order: [["criterionPositionInRubric", "ASC"]], raw: true});
    const criterionIdsOf = (rubric) => rubric.criteria.map((link) => link.criterionId);

    /** an assessment version that references the rubric version, created in one transaction */
    const referenceFromAssessment = async (rubricId, fields = {}) => {
        const {assessment, assessment_rubric} = db.models;
        return db.sequelize.transaction(async (transaction) => {
            const row = await assessment.create({versionNumber: "1", name: next(), description: "", ...fields}, {transaction});
            created.assessment.push(row.id);
            await assessment_rubric.create({assessmentId: row.id, rubricId, rubricPositionInAssessment: 1}, {transaction});
            return row;
        });
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
        db = require("../db/index.js");
        server = new Server();
        server.start(PORT);
        admin = await getSocketClient(server, PORT, process.env.ADMIN_EMAIL, process.env.ADMIN_PWD);
        sockets.push(admin);

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
        sockets.forEach((socket) => socket.connected && socket.disconnect());
        // delete in reference order so RESTRICT keys never block the cleanup; links cascade
        await db.models.assessment.destroy({where: {id: created.assessment}});
        await db.models.rubric.destroy({where: {id: created.rubric}});
        await db.models.criterion.destroy({where: {id: created.criterion}});
        const remove = (sql, replacements) => db.sequelize.query(sql, {replacements});
        await remove('DELETE FROM "user_role_matching" WHERE "userId" IN (:ids) OR "userRoleId" IN (:roles)', {ids: created.users, roles: created.roles});
        await remove('DELETE FROM "role_right_matching" WHERE "userRoleId" IN (:roles)', {roles: created.roles});
        await remove('DELETE FROM "user_role" WHERE id IN (:roles)', {roles: created.roles});
        // the logger writes the refused requests of these users to the log table asynchronously
        await new Promise((resolve) => setTimeout(resolve, 500));
        await remove('DELETE FROM "log" WHERE "userId" IN (:ids)', {ids: created.users});
        await remove('DELETE FROM "user" WHERE id IN (:ids)', {ids: created.users});
        server.stop();
    });

    describe("create rubric", () => {
        test("creates the rubric with generated ids and ordered criterion associations", async () => {
            const [a, b, c] = await criteria(3);
            const data = await create({criterionIds: [c.id, a.id, b.id]});

            expect(Number.isInteger(data.id)).toBe(true);
            expect(Number.isInteger(data.rubricGroupId)).toBe(true);
            expect(data).toMatchObject({versionNumber: "1", minPoints: 0, maxPoints: 4, calculation: "sum", defaultPoints: null, isBonus: false});
            // array order is kept (not sorted by id), positions start at 1
            expect(data.criteria.map((l) => [l.criterionId, l.criterionPositionInRubric])).toEqual([[c.id, 1], [a.id, 2], [b.id, 3]]);
            // each occurrence has its own association id, the same as the database row
            const ids = data.criteria.map((l) => l.id);
            expect(new Set(ids).size).toBe(3);
            expect((await links(data.id)).map((l) => l.id)).toEqual(ids);
            expect(data.criteria.every((l) => l.rubricId === data.id)).toBe(true);
            // the full criterion version, with its ordered options and plain numbers, is embedded
            expect(data.criteria[0].criterion).toMatchObject({id: c.id, name: c.name});
            expect(data.criteria[0].criterion.scoringOptions).toEqual([
                expect.objectContaining({points: -1, description: "opt", position: 1}),
            ]);
        });

        test("a second rubric gets its own group", async () => {
            const a = await create();
            const b = await create();
            expect(a.rubricGroupId).not.toBe(b.rubricGroupId);
        });

        test("scoring properties: negative range, bonus, max with default points, no calculation", async () => {
            const data = await create({minPoints: "-5", maxPoints: 5.5, isBonus: true, calculation: "max", defaultPoints: -1});
            expect(data).toMatchObject({minPoints: -5, maxPoints: 5.5, isBonus: true, calculation: "max", defaultPoints: -1});

            const plain = await create({calculation: undefined});
            expect(plain.calculation).toBeNull();
            expect(plain.isBonus).toBe(false);
        });

        test("same name is allowed; empty criterion list and string ids are accepted", async () => {
            const name = next();
            const [a] = await criteria(1);
            await create({name});
            const second = await create({name, criterionIds: [String(a.id)]});
            expect(criterionIdsOf(second)).toEqual([a.id]);
            expect((await create({criterionIds: undefined})).criteria).toEqual([]);
        });
    });

    describe("retrieve rubrics", () => {
        test("rubricGetAll returns every version with ordered criteria, association ids and numeric values", async () => {
            const [a, b] = await criteria(2);
            const first = await create({criterionIds: [a.id, b.id]});
            const second = (await addVersion({copyFromId: first.id, criterionIds: [b.id, a.id]})).data;

            const response = await call(admin, "rubricGetAll");
            expect(response.success).toBe(true);
            const row = response.data.find((r) => r.id === first.id);
            expect(row.criteria.map((l) => l.criterionPositionInRubric)).toEqual([1, 2]);
            expect(row.criteria.every((l) => Number.isInteger(l.id))).toBe(true);
            expect(typeof row.minPoints).toBe("number");
            expect(typeof row.criteria[0].criterion.scoringOptions[0].points).toBe("number");
            // historical versions are not hidden
            expect(response.data.filter((r) => r.rubricGroupId === first.rubricGroupId).map((r) => r.id)).toEqual([first.id, second.id]);
        });

        test("rubricGet returns one version by id", async () => {
            const [a] = await criteria(1);
            const row = await create({criterionIds: [a.id]});
            const response = await call(admin, "rubricGet", {rubricId: row.id});
            expect(response.success).toBe(true);
            expect(response.data).toEqual(row);
        });

        test.each([[999999999], ["abc"], [null], [undefined], [-1]])("rubricGet with id %p fails", async (rubricId) => {
            expect(await call(admin, "rubricGet", {rubricId}))
                .toMatchObject({success: false, key: "errors.assessment.rubric.notFound"});
        });
    });

    describe("create a new version", () => {
        test("adds a version to the group, with new association ids, and leaves earlier versions unchanged", async () => {
            const [a, b] = await criteria(2);
            const v1 = await create({criterionIds: [a.id, b.id]});
            const linksBefore = await links(v1.id);

            const response = await addVersion({rubricGroupId: v1.rubricGroupId, copyFromId: v1.id});
            expect(response.success).toBe(true);
            expect(response.data.id).not.toBe(v1.id);
            expect(response.data.rubricGroupId).toBe(v1.rubricGroupId);
            expect(criterionIdsOf(response.data)).toEqual([a.id, b.id]);
            // new occurrences: none of the association ids is reused
            expect(response.data.criteria.map((l) => l.id).filter((id) => v1.criteria.map((l) => l.id).includes(id))).toEqual([]);

            expect((await call(admin, "rubricGet", {rubricId: v1.id})).data).toEqual(v1);
            expect(await links(v1.id)).toEqual(linksBefore);
        });

        test("copying keeps properties and criteria; overrides change the properties, the selection and the order", async () => {
            const [a, b, c] = await criteria(3);
            const v1 = await create({isBonus: true, calculation: "max", defaultPoints: 1, criterionIds: [a.id, b.id]});

            const same = await addVersion({copyFromId: v1.id});
            const {id, versionNumber, criteria: copiedCriteria, createdAt, ...rest} = same.data;
            const {id: _i, versionNumber: _v, criteria: _c, createdAt: _t, ...sourceRest} = v1;
            expect(versionNumber).toBe("2");
            expect(rest).toEqual({...sourceRest, updatedAt: rest.updatedAt});
            expect(copiedCriteria.map((l) => [l.criterionId, l.criterionPositionInRubric])).toEqual([[a.id, 1], [b.id, 2]]);

            const changed = await addVersion({copyFromId: v1.id, name: "renamed", criterionIds: [c.id, b.id, a.id]});
            expect(changed.data.name).toBe("renamed");
            expect(criterionIdsOf(changed.data)).toEqual([c.id, b.id, a.id]);

            const fewer = await addVersion({copyFromId: v1.id, criterionIds: [b.id]});
            expect(criterionIdsOf(fewer.data)).toEqual([b.id]);

            const none = await addVersion({copyFromId: v1.id, criterionIds: []});
            expect(none.data.criteria).toEqual([]);

            expect((await call(admin, "rubricGet", {rubricId: v1.id})).data).toEqual(v1);
        });

        test("a copy can clear nullable fields", async () => {
            const v1 = await create({calculation: "max", defaultPoints: 3});
            const response = await addVersion({copyFromId: v1.id, calculation: null, defaultPoints: null});
            expect(response.data).toMatchObject({calculation: null, defaultPoints: null});
        });

        test("without copyFromId all properties must be sent", async () => {
            const [a] = await criteria(1);
            const v1 = await create();
            const missing = await addVersion({rubricGroupId: v1.rubricGroupId});
            expect(missing).toMatchObject({success: false, key: "errors.assessment.fieldRequired", params: {field: "name"}});

            const response = await addVersion(base({rubricGroupId: v1.rubricGroupId, criterionIds: [a.id]}));
            expect(response.success).toBe(true);
            expect(response.data.rubricGroupId).toBe(v1.rubricGroupId);
        });

        test("versions of one rubric are numbered 1, 2, 3 by the backend, each with its own criterion links", async () => {
            const [a, b] = await criteria(2);
            const v1 = await create({criterionIds: [a.id, b.id]});
            const v2 = (await addVersion({copyFromId: v1.id})).data;
            const v3 = (await addVersion({copyFromId: v2.id, criterionIds: [b.id]})).data;
            expect([v1.versionNumber, v2.versionNumber, v3.versionNumber]).toEqual(["1", "2", "3"]);
            expect(await db.models.rubric_criterion.count({where: {rubricId: [v1.id, v2.id, v3.id]}})).toBe(5);
        });

        test("every rubric starts at version 1 in its own group", async () => {
            const a = await create({});
            const b = await create({});
            expect(a.rubricGroupId).not.toBe(b.rubricGroupId);
            expect([a.versionNumber, b.versionNumber]).toEqual(["1", "1"]);
        });

        test("unknown or invalid group and source ids are rejected", async () => {
            const other = await create();
            const v1 = await create();
            const cases = [
                [{...base(), rubricGroupId: 999999999}, "errors.assessment.rubric.groupNotFound"],
                [{...base(), rubricGroupId: "abc"}, "errors.assessment.rubric.groupNotFound"],
                [{...base(), rubricGroupId: 0}, "errors.assessment.rubric.groupNotFound"],
                [base(), "errors.assessment.fieldRequired"],
                [{copyFromId: 999999999}, "errors.assessment.rubric.notFound"],
                [{copyFromId: v1.id, rubricGroupId: other.rubricGroupId}, "errors.assessment.rubric.copySourceMismatch"],
            ];
            for (const [payload, key] of cases) {
                expect(await call(admin, "rubricCreateVersion", payload)).toMatchObject({success: false, key});
            }
        });
    });

    describe("criterion selection", () => {
        test("the same criterion version can be reused in different rubrics and rubric versions", async () => {
            const [a, b] = await criteria(2);
            const r1 = await create({criterionIds: [a.id, b.id]});
            const r2 = await create({criterionIds: [a.id]});
            const r1v2 = (await addVersion({copyFromId: r1.id})).data;

            const associationIds = [r1, r2, r1v2].map((r) => r.criteria.find((l) => l.criterionId === a.id).id);
            expect(new Set(associationIds).size).toBe(3);
            expect(await db.models.rubric_criterion.count({where: {criterionId: a.id}})).toBe(3);
            // the criterion row itself was not changed or duplicated
            expect(await db.models.criterion.count({where: {id: a.id}})).toBe(1);
        });

        test("duplicate criterion selections are rejected, including a number and its string form", async () => {
            const [a, b] = await criteria(2);
            for (const ids of [[a.id, b.id, a.id], [a.id, String(a.id)]]) {
                const name = next();
                const response = await call(admin, "rubricCreate", base({name, criterionIds: ids}));
                expect(response).toMatchObject({success: false, key: "errors.assessment.rubric.duplicateCriterion", params: {criterionId: a.id}});
                expect(await countByName(name)).toBe(0);
            }
        });

        test("nonexistent criterion ids are rejected and nothing is stored", async () => {
            const [a] = await criteria(1);
            const name = next();
            const linksBefore = await db.models.rubric_criterion.count();
            const response = await call(admin, "rubricCreate", base({name, criterionIds: [a.id, 999999999, 999999998]}));
            expect(response).toMatchObject({success: false, key: "errors.assessment.rubric.criteriaNotFound", params: {criterionIds: "999999999, 999999998"}});
            expect(await countByName(name)).toBe(0);
            expect(await db.models.rubric_criterion.count()).toBe(linksBefore);

            const v1 = await create({criterionIds: [a.id]});
            expect(await addVersion({copyFromId: v1.id, criterionIds: [999999999]}))
                .toMatchObject({success: false, key: "errors.assessment.rubric.criteriaNotFound"});
        });

        test.each([
            ["not an array", {}],
            ["a zero", [0]],
            ["a negative id", [-3]],
            ["a decimal", [1.5]],
            ["a word", ["abc"]],
            ["null", [null]],
            ["an object", [{id: 1}]],
        ])("invalid criterionIds (%s) are rejected", async (_label, criterionIds) => {
            expect(await call(admin, "rubricCreate", base({criterionIds})))
                .toMatchObject({success: false, key: "errors.assessment.fieldInvalid", params: {field: "criterionIds"}});
        });
    });

    describe("delete a rubric version", () => {
        test("deletes an unreferenced version with its associations and leaves criteria and other versions", async () => {
            const [a, b] = await criteria(2);
            const v1 = await create({criterionIds: [a.id, b.id]});
            const v2 = (await addVersion({copyFromId: v1.id})).data;

            const response = await call(admin, "rubricDelete", {rubricId: v2.id});
            expect(response).toMatchObject({success: true, data: {id: v2.id, rubricGroupId: v1.rubricGroupId}});

            expect(response.data.latestVersionId).toBe(v1.id);
            // soft delete: the version and its associations stay in the table, flagged, and are hidden from every read
            expect(await db.models.rubric.count({where: {id: v2.id}})).toBe(1);
            expect(await db.models.rubric.count({where: {id: v2.id, deleted: false}})).toBe(0);
            expect(await db.models.rubric_criterion.count({where: {rubricId: v2.id}})).toBe(2);
            expect(await db.models.rubric_criterion.count({where: {rubricId: v2.id, deleted: false}})).toBe(0);
            expect((await call(admin, "rubricGet", {rubricId: v2.id})).success).toBe(false);
            expect(await db.models.criterion.count({where: {id: [a.id, b.id]}})).toBe(2);
            expect((await call(admin, "rubricGet", {rubricId: v1.id})).data).toEqual(v1);
        });

        test("deleting the first version keeps the later one usable", async () => {
            const v1 = await create({});
            const v2 = (await addVersion({copyFromId: v1.id})).data;
            expect((await call(admin, "rubricDelete", {rubricId: v1.id})).success).toBe(true);
            expect((await addVersion({copyFromId: v2.id})).data.rubricGroupId).toBe(v1.rubricGroupId);
        });

        test("is refused while an assessment references the version", async () => {
            const [a] = await criteria(1);
            const v1 = await create({criterionIds: [a.id]});
            const assessment = await referenceFromAssessment(v1.id);

            const response = await call(admin, "rubricDelete", {rubricId: v1.id});
            expect(response).toMatchObject({
                success: false,
                key: "errors.assessment.rubric.inUse",
                params: {name: v1.name, version: "1", count: 1, references: `'${assessment.name}' (v1)`},
            });
            expect(response.message).toBe(`Cannot delete '${v1.name}' (version 1) because it is used by 1 assessment version(s): '${assessment.name}' (v1).`);
            expect(response.message).not.toMatch(new RegExp(`\\b(${v1.id}|${assessment.id})\\b`));
            // rubric and associations are intact
            expect((await call(admin, "rubricGet", {rubricId: v1.id})).data).toEqual(v1);
        });

        test("several assessments are named with their version numbers; equal names are told apart by group", async () => {
            const [a] = await criteria(1);
            const v1 = await create({criterionIds: [a.id]});
            await referenceFromAssessment(v1.id, {name: "Assessment 1"});
            await referenceFromAssessment(v1.id, {name: "Assessment A1", versionNumber: "3"});
            let response = await call(admin, "rubricDelete", {rubricId: v1.id});
            expect(response.params).toMatchObject({count: 2, references: "'Assessment 1' (v1), 'Assessment A1' (v3)"});

            const one = await referenceFromAssessment(v1.id, {name: "Twin"});
            const two = await referenceFromAssessment(v1.id, {name: "Twin"});
            response = await call(admin, "rubricDelete", {rubricId: v1.id});
            expect(response.params.references).toContain(`'Twin' (v1, #${one.assessmentGroupId}), 'Twin' (v1, #${two.assessmentGroupId})`);
        });

        test("another version of the same group can be deleted while one is referenced", async () => {
            const v1 = await create({});
            const v2 = (await addVersion({copyFromId: v1.id})).data;
            await referenceFromAssessment(v1.id);
            expect((await call(admin, "rubricDelete", {rubricId: v2.id})).success).toBe(true);
            expect(await db.models.rubric.count({where: {id: v1.id}})).toBe(1);
        });

        test.each([[999999999], [null], ["abc"]])("unknown id %p fails", async (rubricId) => {
            expect(await call(admin, "rubricDelete", {rubricId}))
                .toMatchObject({success: false, key: "errors.assessment.rubric.notFound"});
        });
    });

    describe("permissions", () => {
        test("a user without the dashboard right is rejected on every event", async () => {
            const row = await create();
            const before = await db.models.rubric.count();
            const requests = [
                ["rubricGetAll", {}],
                ["rubricGet", {rubricId: row.id}],
                ["rubricCreate", base()],
                ["rubricCreateVersion", {copyFromId: row.id}],
                ["rubricDelete", {rubricId: row.id}],
            ];
            for (const [event, payload] of requests) {
                expect(await call(denied, event, payload))
                    .toMatchObject({success: false, key: "errors.assessment.accessDenied"});
            }
            expect(await db.models.rubric.count()).toBe(before);
        });

        test("a user with the right may use every event on rubrics created by someone else", async () => {
            const [a] = await criteria(1);
            const row = await create({criterionIds: [a.id]}, admin);
            expect((await call(allowed, "rubricGet", {rubricId: row.id})).success).toBe(true);
            expect((await call(allowed, "rubricGetAll")).data.map((r) => r.id)).toContain(row.id);

            const version = await addVersion({copyFromId: row.id}, allowed);
            expect(version.success).toBe(true);
            expect((await create({}, allowed)).id).toBeDefined();

            expect((await call(allowed, "rubricDelete", {rubricId: version.data.id})).success).toBe(true);
            expect((await call(allowed, "rubricDelete", {rubricId: row.id})).success).toBe(true);
        });
    });

    describe("validation and rollback", () => {
        test.each([
            ["name missing", {name: undefined}, "errors.assessment.fieldRequired", {field: "name"}],
            ["name blank", {name: " "}, "errors.assessment.fieldRequired", {field: "name"}],
            ["name not a string", {name: 5}, "errors.assessment.fieldInvalid", {field: "name"}],
            ["description missing", {description: undefined}, "errors.assessment.fieldRequired", {field: "description"}],
            ["minPoints not numeric", {minPoints: "abc"}, "errors.assessment.fieldInvalid", {field: "minPoints"}],
            ["maxPoints not finite", {maxPoints: "Infinity"}, "errors.assessment.fieldInvalid", {field: "maxPoints"}],
            ["min greater than max", {minPoints: 3, maxPoints: 2}, "errors.assessment.pointsRange", undefined],
            ["calculation not a string", {calculation: 3}, "errors.assessment.fieldInvalid", {field: "calculation"}],
            ["defaultPoints not numeric", {defaultPoints: "x"}, "errors.assessment.fieldInvalid", {field: "defaultPoints"}],
            ["isBonus not boolean", {isBonus: "yes"}, "errors.assessment.fieldInvalid", {field: "isBonus"}],
            ["isBonus null", {isBonus: null}, "errors.assessment.fieldInvalid", {field: "isBonus"}],
        ])("create rejects: %s and stores nothing", async (_label, override, key, params) => {
            const name = next();
            const response = await call(admin, "rubricCreate", base({name, ...override}));
            expect(response.success).toBe(false);
            expect(response.key).toBe(key);
            if (params) {
                expect(response.params).toEqual(params);
            }
            expect(await countByName(name)).toBe(0);
        });

        test("min equal to max is allowed, and any calculation text is stored as sent", async () => {
            const row = await create({minPoints: 2, maxPoints: 2, calculation: "custom"});
            expect(row).toMatchObject({minPoints: 2, maxPoints: 2, calculation: "custom"});
        });

        test("a database failure while inserting the associations rolls the rubric back", async () => {
            const [a, b] = await criteria(2);
            const name = next();
            const spy = jest.spyOn(db.models.rubric_criterion, "bulkCreate").mockRejectedValueOnce(new Error("boom"));
            try {
                const response = await call(admin, "rubricCreate", base({name, criterionIds: [a.id, b.id]}));
                expect(response.success).toBe(false);
                expect(spy).toHaveBeenCalledTimes(1);
            } finally {
                spy.mockRestore();
            }
            expect(await countByName(name)).toBe(0);
        });

        test("a failing new version leaves the source and the group unchanged", async () => {
            const [a] = await criteria(1);
            const v1 = await create({criterionIds: [a.id]});
            const spy = jest.spyOn(db.models.rubric_criterion, "bulkCreate").mockRejectedValueOnce(new Error("boom"));
            try {
                expect((await call(admin, "rubricCreateVersion", {copyFromId: v1.id})).success).toBe(false);
            } finally {
                spy.mockRestore();
            }
            expect(await db.models.rubric.count({where: {rubricGroupId: v1.rubricGroupId}})).toBe(1);
            // the version number is free again
            expect((await addVersion({copyFromId: v1.id})).success).toBe(true);
        });

        test("a database failure on the rubric row (numeric overflow) leaves nothing behind", async () => {
            const name = next();
            const response = await call(admin, "rubricCreate", base({name, maxPoints: `1${"0".repeat(200000)}`}));
            expect(response.success).toBe(false);
            expect(await countByName(name)).toBe(0);
        });
    });

    describe("client version numbers", () => {
        // every value is refused, whatever it looks like: the backend alone assigns the number
        const refused = [["1"], ["1.1"], [" 3.1 "], [2], [0], [""], ["  "], [null], [{}], [["1"]], ["abc"], ["x".repeat(256)]];

        test.each(refused)("rubricCreate refuses a versionNumber %j and stores nothing", async (versionNumber) => {
            const name = next();
            const response = await call(admin, "rubricCreate", base({name, versionNumber}));
            expect(response).toMatchObject({success: false, key: "errors.assessment.versionNumberNotAllowed"});
            expect(await countByName(name)).toBe(0);
        });

        test.each(refused)("rubricCreateVersion refuses a versionNumber %j, with or without a copy source, and stores nothing", async (versionNumber) => {
            const v1 = await create({});
            expect(await addVersion({copyFromId: v1.id, versionNumber}))
                .toMatchObject({success: false, key: "errors.assessment.versionNumberNotAllowed"});
            expect(await addVersion(base({rubricGroupId: v1.rubricGroupId, versionNumber})))
                .toMatchObject({success: false, key: "errors.assessment.versionNumberNotAllowed"});
            expect(await db.models.rubric.count({where: {rubricGroupId: v1.rubricGroupId}})).toBe(1);
        });

        test("numbers are never reused: after the newest version is deleted the next one continues the sequence", async () => {
            const v1 = await create({});
            const v2 = (await addVersion({copyFromId: v1.id})).data;
            expect(v2.versionNumber).toBe("2");
            expect((await call(admin, "rubricDelete", {rubricId: v2.id})).success).toBe(true);
            expect((await addVersion({copyFromId: v1.id})).data.versionNumber).toBe("3");
        });

        test("a stored label of another form stays readable, listed and copyable; the copy gets the next number", async () => {
            const old = await db.models.rubric.create({versionNumber: "v1-beta", name: next(), description: "", minPoints: 0, maxPoints: 4});
            created.rubric.push(old.id);
            expect((await call(admin, "rubricGet", {rubricId: old.id})).data.versionNumber).toBe("v1-beta");
            expect((await call(admin, "rubricGetAll")).data.find((r) => r.id === old.id).versionNumber).toBe("v1-beta");
            const copy = await addVersion({copyFromId: old.id});
            // "v1-beta" has no leading number and counts as 0, so the first automatic number of its group is 1
            expect(copy).toMatchObject({success: true, data: {rubricGroupId: old.rubricGroupId, versionNumber: "1"}});
            expect((await call(admin, "rubricGet", {rubricId: old.id})).data.versionNumber).toBe("v1-beta");
        });
    });

    describe("immutability", () => {
        test("there is no update event for rubrics", async () => {
            const row = await create();
            const ack = await Promise.race([
                call(admin, "rubricUpdate", {rubricId: row.id, name: "changed"}),
                new Promise((resolve) => setTimeout(() => resolve("no handler"), 300)),
            ]);
            expect(ack).toBe("no handler");
            expect((await call(admin, "rubricGet", {rubricId: row.id})).data.name).toBe(row.name);
        });

        test("a committed version rejects updates, late associations and single association deletes (triggers)", async () => {
            const [a, b] = await criteria(2);
            const row = await create({criterionIds: [a.id]});
            await expect(db.models.rubric.update({name: "changed"}, {where: {id: row.id}})).rejects.toThrow();
            await expect(db.models.rubric_criterion.create({rubricId: row.id, criterionId: b.id, criterionPositionInRubric: 2})).rejects.toThrow();
            await expect(db.models.rubric_criterion.update({criterionPositionInRubric: 5}, {where: {rubricId: row.id}})).rejects.toThrow();
            await expect(db.models.rubric_criterion.destroy({where: {rubricId: row.id}})).rejects.toThrow();
            expect((await call(admin, "rubricGet", {rubricId: row.id})).data).toEqual(row);
        });

        test("criterion versions stay immutable and cannot be deleted while a rubric uses them", async () => {
            const [a] = await criteria(1);
            await create({criterionIds: [a.id]});
            await expect(db.models.criterion.destroy({where: {id: a.id}})).rejects.toThrow();
            expect(await db.models.criterion.count({where: {id: a.id}})).toBe(1);
        });
    });
});
