const Server = require("../webserver/Server.js");
const {getSocketClient} = require("./utils.js");

/**
 * Socket tests for criterion versions and their scoring options (Stage 2A of the versioned
 * assessments): retrieve, create, new version, delete, permissions, validation and rollback.
 */
describe("Test Websockets - Criterion", () => {
    const PORT = 3108;
    const tag = `t${Date.now()}`;
    let counter = 0;
    const next = () => `${tag}-${++counter}`;

    let server;
    let admin;        // administrator
    let allowed;      // plain user that was granted the dashboard right (is not the creator of anything)
    let denied;       // plain user without the right
    let db;
    const sockets = [];
    const created = {criterion: [], rubric: [], users: [], roles: []};

    /** emit and wait for the acknowledgement */
    const call = (socket, event, data = {}) => new Promise((resolve) => socket.emit(event, data, resolve));

    const base = (data = {}) => ({
        versionNumber: "1",
        name: next(),
        description: "A criterion",
        expertLevel: 1,
        subjective: false,
        minPoints: 0,
        maxPoints: 2,
        scoringOptions: [
            {points: 0, description: "none"},
            {points: 1, description: "some"},
            {points: 2, description: "all"},
        ],
        ...data,
    });

    /** create a criterion through the socket and remember it for cleanup */
    const create = async (data = {}, socket = admin) => {
        const response = await call(socket, "criterionCreate", base(data));
        expect(response.success).toBe(true);
        created.criterion.push(response.data.id);
        return response.data;
    };
    const addVersion = async (data, socket = admin) => {
        const response = await call(socket, "criterionCreateVersion", data);
        if (response.success) {
            created.criterion.push(response.data.id);
        }
        return response;
    };
    const countByName = (name) => db.models.criterion.count({where: {name}});

    /** local-login user with a known password, email verified, no roles */
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
        // rubric links first (RESTRICT), options and links cascade
        await db.models.rubric.destroy({where: {id: created.rubric}});
        await db.models.criterion.destroy({where: {id: created.criterion}});
        // raw deletes: the user models are soft-delete, and new users get default role matchings
        const remove = (sql, replacements) => db.sequelize.query(sql, {replacements});
        await remove('DELETE FROM "user_role_matching" WHERE "userId" IN (:ids) OR "userRoleId" IN (:roles)', {ids: created.users, roles: created.roles});
        await remove('DELETE FROM "role_right_matching" WHERE "userRoleId" IN (:roles)', {roles: created.roles});
        await remove('DELETE FROM "user_role" WHERE id IN (:roles)', {roles: created.roles});
        await remove('DELETE FROM "user" WHERE id IN (:ids)', {ids: created.users});
        server.stop();
    });

    /** a rubric version that references the criterion version, created in one transaction */
    const referenceFromRubric = async (criterionId) => {
        const {rubric, rubric_criterion} = db.models;
        return db.sequelize.transaction(async (transaction) => {
            const row = await rubric.create(
                {versionNumber: "1", name: next(), description: "", minPoints: 0, maxPoints: 4}, {transaction});
            created.rubric.push(row.id);
            await rubric_criterion.create({rubricId: row.id, criterionId, criterionPositionInRubric: 1}, {transaction});
            return row;
        });
    };

    describe("create criterion", () => {
        test("creates the criterion with a generated id, a generated group id and ordered options", async () => {
            const data = await create({
                versionNumber: "v1", function: "auto_grading", subjective: true, expertLevel: 2,
                scoringOptions: [{points: 3, description: "third"}, {points: -1, description: "first"}, {points: 0.5, description: "mid"}],
            });

            expect(Number.isInteger(data.id)).toBe(true);
            expect(Number.isInteger(data.criterionGroupId)).toBe(true);
            expect(data).toMatchObject({versionNumber: "v1", function: "auto_grading", subjective: true, expertLevel: 2, minPoints: 0, maxPoints: 2});
            // array order is kept, not sorted by points
            expect(data.scoringOptions.map((o) => [o.position, o.points, o.description]))
                .toEqual([[1, 3, "third"], [2, -1, "first"], [3, 0.5, "mid"]]);
        });

        test("a second criterion gets its own group", async () => {
            const a = await create();
            const b = await create();
            expect(a.criterionGroupId).not.toBe(b.criterionGroupId);
        });

        test("same name and optional fields left out are accepted", async () => {
            const name = next();
            const a = await create({name});
            const b = await create({name, minPoints: undefined, maxPoints: undefined, scoringOptions: undefined});
            expect(a.criterionGroupId).not.toBe(b.criterionGroupId);
            expect(b).toMatchObject({minPoints: null, maxPoints: null, function: null, scoringOptions: []});
        });

        test("negative points and numeric strings are supported", async () => {
            const data = await create({minPoints: "-5", maxPoints: 5.5, scoringOptions: [{points: "-2.25", description: ""}]});
            expect(data.minPoints).toBe(-5);
            expect(data.scoringOptions[0].points).toBe(-2.25);
        });
    });

    describe("retrieve criteria", () => {
        test("criterionGetAll returns every version with ordered options and numeric values", async () => {
            const first = await create({versionNumber: "a"});
            const second = (await addVersion({criterionGroupId: first.criterionGroupId, versionNumber: "b", copyFromId: first.id})).data;

            const response = await call(admin, "criterionGetAll");
            expect(response.success).toBe(true);
            const ids = response.data.map((c) => c.id);
            expect(ids).toEqual(expect.arrayContaining([first.id, second.id]));
            const row = response.data.find((c) => c.id === first.id);
            expect(row.scoringOptions.map((o) => o.position)).toEqual([1, 2, 3]);
            expect(typeof row.minPoints).toBe("number");
            expect(typeof row.scoringOptions[0].points).toBe("number");
            // historical versions are not hidden: both versions of the group are listed
            expect(response.data.filter((c) => c.criterionGroupId === first.criterionGroupId)).toHaveLength(2);
        });

        test("criterionGet returns one version by id", async () => {
            const row = await create({versionNumber: "x"});
            const response = await call(admin, "criterionGet", {criterionId: row.id});
            expect(response.success).toBe(true);
            expect(response.data).toMatchObject({id: row.id, versionNumber: "x"});
            expect(response.data.scoringOptions).toHaveLength(3);
        });

        test.each([[999999999], ["abc"], [null], [undefined], [-1]])("criterionGet with id %p fails", async (criterionId) => {
            const response = await call(admin, "criterionGet", {criterionId});
            expect(response).toMatchObject({success: false, key: "errors.assessment.criterion.notFound"});
        });
    });

    describe("create a new version", () => {
        test("adds a version to the group without touching earlier versions", async () => {
            const v1 = await create({versionNumber: "1"});
            const response = await addVersion({
                criterionGroupId: v1.criterionGroupId, versionNumber: "2", copyFromId: v1.id, name: "renamed",
                scoringOptions: [{points: 9, description: "new"}],
            });
            expect(response.success).toBe(true);
            expect(response.data.id).not.toBe(v1.id);
            expect(response.data).toMatchObject({criterionGroupId: v1.criterionGroupId, versionNumber: "2", name: "renamed"});
            expect(response.data.scoringOptions.map((o) => o.points)).toEqual([9]);

            const after = (await call(admin, "criterionGet", {criterionId: v1.id})).data;
            expect(after).toEqual(v1);
        });

        test("copying takes properties and options from the source; the group follows the source", async () => {
            const v1 = await create({versionNumber: "1", function: "f", subjective: true, expertLevel: 0});
            const response = await addVersion({copyFromId: v1.id, versionNumber: "1.1"});
            expect(response.success).toBe(true);
            const {id, versionNumber, scoringOptions, ...rest} = response.data;
            const {id: _id, versionNumber: _v, scoringOptions: sourceOptions, ...sourceRest} = v1;
            expect(versionNumber).toBe("1.1");
            expect(rest).toEqual({...sourceRest, createdAt: rest.createdAt});
            expect(scoringOptions.map(({points, description, position}) => [points, description, position]))
                .toEqual(sourceOptions.map(({points, description, position}) => [points, description, position]));
            // new option rows, not the source's
            expect(scoringOptions.map((o) => o.id)).not.toEqual(expect.arrayContaining(sourceOptions.map((o) => o.id)));
        });

        test("a copy can clear nullable fields", async () => {
            const v1 = await create({function: "f"});
            const response = await addVersion({copyFromId: v1.id, versionNumber: "2", function: null, minPoints: null, maxPoints: null});
            expect(response.data).toMatchObject({function: null, minPoints: null, maxPoints: null});
        });

        test("without copyFromId all properties must be sent", async () => {
            const v1 = await create();
            const missing = await addVersion({criterionGroupId: v1.criterionGroupId, versionNumber: "2"});
            expect(missing).toMatchObject({success: false, key: "errors.assessment.fieldRequired", params: {field: "name"}});

            const response = await addVersion(base({criterionGroupId: v1.criterionGroupId, versionNumber: "2"}));
            expect(response.success).toBe(true);
            expect(response.data.criterionGroupId).toBe(v1.criterionGroupId);
        });

        test("many versions in one group", async () => {
            const v1 = await create({versionNumber: "1"});
            for (const versionNumber of ["2", "3", "4"]) {
                expect((await addVersion({copyFromId: v1.id, versionNumber})).success).toBe(true);
            }
            const all = (await call(admin, "criterionGetAll")).data.filter((c) => c.criterionGroupId === v1.criterionGroupId);
            expect(all.map((c) => c.versionNumber)).toEqual(["1", "2", "3", "4"]);
        });

        test("duplicate version numbers within a group are rejected and nothing is left behind", async () => {
            const v1 = await create({versionNumber: "1"});
            const optionsBefore = await db.models.criterion_scoring_option.count();
            const response = await addVersion({copyFromId: v1.id, versionNumber: "1"});
            expect(response).toMatchObject({success: false, key: "errors.assessment.criterion.versionExists", params: {versionNumber: "1"}});
            expect(await db.models.criterion.count({where: {criterionGroupId: v1.criterionGroupId}})).toBe(1);
            expect(await db.models.criterion_scoring_option.count()).toBe(optionsBefore);
        });

        test("the same version number may be used in another group", async () => {
            const a = await create({versionNumber: "1"});
            const b = await create({versionNumber: "1"});
            expect(a.criterionGroupId).not.toBe(b.criterionGroupId);
        });

        test("unknown or invalid group and source ids are rejected", async () => {
            const other = await create();
            const v1 = await create();
            const cases = [
                [{...base(), criterionGroupId: 999999999}, "errors.assessment.criterion.groupNotFound"],
                [{...base(), criterionGroupId: "abc"}, "errors.assessment.criterion.groupNotFound"],
                [{...base(), criterionGroupId: 0}, "errors.assessment.criterion.groupNotFound"],
                [base(), "errors.assessment.fieldRequired"],
                [{copyFromId: 999999999, versionNumber: "2"}, "errors.assessment.criterion.notFound"],
                [{copyFromId: v1.id, criterionGroupId: other.criterionGroupId, versionNumber: "2"}, "errors.assessment.criterion.copySourceMismatch"],
            ];
            for (const [payload, key] of cases) {
                expect(await call(admin, "criterionCreateVersion", payload)).toMatchObject({success: false, key});
            }
        });
    });

    describe("delete a criterion version", () => {
        test("deletes an unreferenced version with its options and leaves the other versions", async () => {
            const v1 = await create({versionNumber: "1"});
            const v2 = (await addVersion({copyFromId: v1.id, versionNumber: "2"})).data;

            const response = await call(admin, "criterionDelete", {criterionId: v2.id});
            expect(response).toMatchObject({success: true, data: {id: v2.id, criterionGroupId: v1.criterionGroupId}});

            expect(await db.models.criterion.count({where: {id: v2.id}})).toBe(0);
            expect(await db.models.criterion_scoring_option.count({where: {criterionId: v2.id}})).toBe(0);
            const remaining = (await call(admin, "criterionGet", {criterionId: v1.id})).data;
            expect(remaining).toEqual(v1);
        });

        test("deleting the first version keeps the later one usable", async () => {
            const v1 = await create({versionNumber: "1"});
            const v2 = (await addVersion({copyFromId: v1.id, versionNumber: "2"})).data;
            expect((await call(admin, "criterionDelete", {criterionId: v1.id})).success).toBe(true);
            expect((await call(admin, "criterionGet", {criterionId: v2.id})).data.criterionGroupId).toBe(v1.criterionGroupId);
            // the group id is not reused, and a new version number can still be added
            expect((await addVersion({copyFromId: v2.id, versionNumber: "3"})).success).toBe(true);
        });

        test("is refused while a rubric references the version", async () => {
            const v1 = await create();
            const rubric = await referenceFromRubric(v1.id);

            const response = await call(admin, "criterionDelete", {criterionId: v1.id});
            expect(response).toMatchObject({
                success: false,
                key: "errors.assessment.criterion.inUse",
                params: {criterionId: v1.id, count: 1, rubricIds: String(rubric.id)},
            });
            expect(response.message).toContain(String(rubric.id));
            // criterion and options are intact
            expect((await call(admin, "criterionGet", {criterionId: v1.id})).data).toEqual(v1);
        });

        test("another version of the same group can still be deleted while one is referenced", async () => {
            const v1 = await create({versionNumber: "1"});
            const v2 = (await addVersion({copyFromId: v1.id, versionNumber: "2"})).data;
            await referenceFromRubric(v1.id);
            expect((await call(admin, "criterionDelete", {criterionId: v2.id})).success).toBe(true);
            expect(await db.models.criterion.count({where: {id: v1.id}})).toBe(1);
        });

        test.each([[999999999], [null], ["abc"]])("unknown id %p fails", async (criterionId) => {
            expect(await call(admin, "criterionDelete", {criterionId}))
                .toMatchObject({success: false, key: "errors.assessment.criterion.notFound"});
        });
    });

    describe("permissions", () => {
        test("a user without the dashboard right is rejected on every event", async () => {
            const row = await create();
            const before = await db.models.criterion.count();
            const requests = [
                ["criterionGetAll", {}],
                ["criterionGet", {criterionId: row.id}],
                ["criterionCreate", base()],
                ["criterionCreateVersion", {copyFromId: row.id, versionNumber: "2"}],
                ["criterionDelete", {criterionId: row.id}],
            ];
            for (const [event, payload] of requests) {
                expect(await call(denied, event, payload))
                    .toMatchObject({success: false, key: "errors.assessment.accessDenied"});
            }
            expect(await db.models.criterion.count()).toBe(before);
        });

        test("a user with the right may use every event on criteria created by someone else", async () => {
            const row = await create({}, admin);
            expect((await call(allowed, "criterionGet", {criterionId: row.id})).success).toBe(true);
            expect((await call(allowed, "criterionGetAll")).data.map((c) => c.id)).toContain(row.id);

            const version = await addVersion({copyFromId: row.id, versionNumber: "2"}, allowed);
            expect(version.success).toBe(true);
            const own = await create({}, allowed);
            expect(own.id).toBeDefined();

            expect((await call(allowed, "criterionDelete", {criterionId: version.data.id})).success).toBe(true);
            expect((await call(allowed, "criterionDelete", {criterionId: row.id})).success).toBe(true);
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
            ["description missing", {description: undefined}, "errors.assessment.fieldRequired", {field: "description"}],
            ["subjective missing", {subjective: undefined}, "errors.assessment.fieldRequired", {field: "subjective"}],
            ["subjective not boolean", {subjective: "yes"}, "errors.assessment.fieldInvalid", {field: "subjective"}],
            ["expertLevel missing", {expertLevel: undefined}, "errors.assessment.fieldRequired", {field: "expertLevel"}],
            ["expertLevel not integer", {expertLevel: 1.5}, "errors.assessment.fieldInvalid", {field: "expertLevel"}],
            ["minPoints not numeric", {minPoints: "abc"}, "errors.assessment.fieldInvalid", {field: "minPoints"}],
            ["maxPoints not finite", {maxPoints: "Infinity"}, "errors.assessment.fieldInvalid", {field: "maxPoints"}],
            ["min greater than max", {minPoints: 3, maxPoints: 2}, "errors.assessment.pointsRange", undefined],
            ["function not a string", {function: 3}, "errors.assessment.fieldInvalid", {field: "function"}],
            ["scoringOptions not an array", {scoringOptions: {}}, "errors.assessment.fieldInvalid", {field: "scoringOptions"}],
            ["option not an object", {scoringOptions: ["x"]}, "errors.assessment.optionInvalid", {position: 1, field: "option"}],
            ["option points missing", {scoringOptions: [{points: 1, description: ""}, {description: ""}]}, "errors.assessment.optionInvalid", {position: 2, field: "points"}],
            ["option points not numeric", {scoringOptions: [{points: "x", description: ""}]}, "errors.assessment.optionInvalid", {position: 1, field: "points"}],
            ["option description missing", {scoringOptions: [{points: 1}]}, "errors.assessment.optionInvalid", {position: 1, field: "description"}],
        ])("create rejects: %s and stores nothing", async (_label, override, key, params) => {
            const name = next();
            const response = await call(admin, "criterionCreate", base({name, ...override}));
            expect(response.success).toBe(false);
            expect(response.key).toBe(key);
            if (params) {
                expect(response.params).toEqual(params);
            }
            expect(await countByName(name)).toBe(0);
        });

        test("min equal to max is allowed", async () => {
            expect((await create({minPoints: 2, maxPoints: 2})).minPoints).toBe(2);
        });

        test("an invalid second option leaves no criterion and no option behind (single transaction)", async () => {
            const name = next();
            const optionsBefore = await db.models.criterion_scoring_option.count();
            const response = await call(admin, "criterionCreate", base({
                name, scoringOptions: [{points: 1, description: "ok"}, {points: "x", description: "bad"}],
            }));
            expect(response.success).toBe(false);
            expect(await countByName(name)).toBe(0);
            expect(await db.models.criterion_scoring_option.count()).toBe(optionsBefore);
        });

        test("a database failure while inserting the options rolls everything back", async () => {
            // passes validation, but PostgreSQL rejects a NUMERIC with more than 131072 digits
            // while inserting the second option, after the criterion row was already written
            const name = next();
            const response = await call(admin, "criterionCreate", base({
                name, scoringOptions: [{points: 1, description: "ok"}, {points: `1${"0".repeat(200000)}`, description: "huge"}],
            }));
            expect(response.success).toBe(false);
            expect(await countByName(name)).toBe(0);
        });
    });

    describe("immutability", () => {
        test("there is no update event for criteria", async () => {
            const row = await create();
            const ack = await Promise.race([
                call(admin, "criterionUpdate", {criterionId: row.id, name: "changed"}),
                new Promise((resolve) => setTimeout(() => resolve("no handler"), 300)),
            ]);
            expect(ack).toBe("no handler");
            expect((await call(admin, "criterionGet", {criterionId: row.id})).data.name).toBe(row.name);
        });

        test("a committed version rejects updates and extra options (database triggers still apply)", async () => {
            const row = await create();
            await expect(db.models.criterion.update({name: "changed"}, {where: {id: row.id}})).rejects.toThrow();
            await expect(db.models.criterion_scoring_option.create({criterionId: row.id, points: 5, description: "late", position: 9})).rejects.toThrow();
            await expect(db.models.criterion_scoring_option.destroy({where: {criterionId: row.id, position: 1}})).rejects.toThrow();
            expect((await call(admin, "criterionGet", {criterionId: row.id})).data).toEqual(row);
        });

        test("creating a version never changes the source version or its options", async () => {
            const v1 = await create();
            await addVersion({copyFromId: v1.id, versionNumber: "2", scoringOptions: []});
            expect((await call(admin, "criterionGet", {criterionId: v1.id})).data).toEqual(v1);
        });
    });
});
