const Server = require("../webserver/Server.js");
const {getSocketClient} = require("./utils.js");

/**
 * Socket tests for criterion versions and their scoring options (Stage 2A of the versioned
 * assessments): retrieve, create, new version, delete, permissions, validation and rollback.
 * Version numbers are always assigned by the backend; a client number is refused (see "client version numbers"
 * below). Numbering across kinds, concurrency and history queries are in socket.assessment_versions.test.js.
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
        name: next(),
        description: "A criterion",
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
        // the logger writes the refused requests of these users to the log table asynchronously
        await new Promise((resolve) => setTimeout(resolve, 500));
        await remove('DELETE FROM "log" WHERE "userId" IN (:ids)', {ids: created.users});
        await remove('DELETE FROM "user" WHERE id IN (:ids)', {ids: created.users});
        server.stop();
    });

    /** a rubric version that references the criterion version, created in one transaction */
    const referenceFromRubric = async (criterionId, fields = {}) => {
        const {rubric, rubric_criterion} = db.models;
        return db.sequelize.transaction(async (transaction) => {
            const row = await rubric.create(
                {versionNumber: "1", name: next(), description: "", minPoints: 0, maxPoints: 4, ...fields}, {transaction});
            created.rubric.push(row.id);
            await rubric_criterion.create({rubricId: row.id, criterionId, criterionPositionInRubric: 1}, {transaction});
            return row;
        });
    };

    describe("create criterion", () => {
        test("creates the criterion with a generated id, a generated group id and ordered options", async () => {
            const data = await create({
                minPoints: -1, maxPoints: 3, settings: {function: "auto_grading", subjective: true, expertLevel: 2},
                scoringOptions: [{points: 3, description: "third"}, {points: -1, description: "first"}, {points: 0.5, description: "mid"}],
            });

            expect(Number.isInteger(data.id)).toBe(true);
            expect(Number.isInteger(data.criterionGroupId)).toBe(true);
            expect(data).toMatchObject({versionNumber: "1", settings: {function: "auto_grading", subjective: true, expertLevel: 2}, minPoints: -1, maxPoints: 3});
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
            expect(b).toMatchObject({minPoints: null, maxPoints: null, settings: {}, scoringOptions: []});
        });

        test("negative points and numeric strings are supported", async () => {
            const data = await create({minPoints: "-5", maxPoints: 5.5, scoringOptions: [{points: "-2.25", description: ""}]});
            expect(data.minPoints).toBe(-5);
            expect(data.scoringOptions[0].points).toBe(-2.25);
        });
    });

    describe("retrieve criteria", () => {
        test("criterionGetAll returns every version with ordered options and numeric values", async () => {
            const first = await create({});
            const second = (await addVersion({criterionGroupId: first.criterionGroupId, copyFromId: first.id})).data;

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
            const row = await create({});
            const response = await call(admin, "criterionGet", {criterionId: row.id});
            expect(response.success).toBe(true);
            expect(response.data).toMatchObject({id: row.id, versionNumber: "1"});
            expect(response.data.scoringOptions).toHaveLength(3);
        });

        test.each([[999999999], ["abc"], [null], [undefined], [-1]])("criterionGet with id %p fails", async (criterionId) => {
            const response = await call(admin, "criterionGet", {criterionId});
            expect(response).toMatchObject({success: false, key: "errors.assessment.criterion.notFound"});
        });
    });

    describe("create a new version", () => {
        test("adds a version to the group without touching earlier versions", async () => {
            const v1 = await create({});
            const response = await addVersion({
                criterionGroupId: v1.criterionGroupId, copyFromId: v1.id, name: "renamed", maxPoints: 10,
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
            const v1 = await create({settings: {function: "f", subjective: true, expertLevel: 0}});
            const response = await addVersion({copyFromId: v1.id});
            expect(response.success).toBe(true);
            const {id, versionNumber, scoringOptions, ...rest} = response.data;
            const {id: _id, versionNumber: _v, scoringOptions: sourceOptions, ...sourceRest} = v1;
            expect(versionNumber).toBe("2");
            expect(rest).toEqual({...sourceRest, createdAt: rest.createdAt, updatedAt: rest.updatedAt});
            expect(scoringOptions.map(({points, description, position}) => [points, description, position]))
                .toEqual(sourceOptions.map(({points, description, position}) => [points, description, position]));
            // new option rows, not the source's
            expect(scoringOptions.map((o) => o.id)).not.toEqual(expect.arrayContaining(sourceOptions.map((o) => o.id)));
        });

        test("a copy can clear nullable fields", async () => {
            const v1 = await create({settings: {function: "f"}});
            const response = await addVersion({copyFromId: v1.id, settings: {}, minPoints: null, maxPoints: null});
            expect(response.data).toMatchObject({settings: {}, minPoints: null, maxPoints: null});
        });

        test("without copyFromId all properties must be sent", async () => {
            const v1 = await create();
            const missing = await addVersion({criterionGroupId: v1.criterionGroupId});
            expect(missing).toMatchObject({success: false, key: "errors.assessment.fieldRequired", params: {field: "name"}});

            const response = await addVersion(base({criterionGroupId: v1.criterionGroupId}));
            expect(response.success).toBe(true);
            expect(response.data.criterionGroupId).toBe(v1.criterionGroupId);
        });

        test("many versions in one group are numbered 1, 2, 3, 4 by the backend", async () => {
            const v1 = await create({});
            for (let i = 0; i < 3; i++) {
                expect((await addVersion({copyFromId: v1.id})).success).toBe(true);
            }
            const all = (await call(admin, "criterionGetAll")).data.filter((c) => c.criterionGroupId === v1.criterionGroupId);
            expect(all.map((c) => c.versionNumber)).toEqual(["1", "2", "3", "4"]);
        });

        test("every criterion starts at version 1 in its own group", async () => {
            const a = await create({});
            const b = await create({});
            expect(a.criterionGroupId).not.toBe(b.criterionGroupId);
            expect([a.versionNumber, b.versionNumber]).toEqual(["1", "1"]);
        });

        test("unknown or invalid group and source ids are rejected", async () => {
            const other = await create();
            const v1 = await create();
            const cases = [
                [{...base(), criterionGroupId: 999999999}, "errors.assessment.criterion.groupNotFound"],
                [{...base(), criterionGroupId: "abc"}, "errors.assessment.criterion.groupNotFound"],
                [{...base(), criterionGroupId: 0}, "errors.assessment.criterion.groupNotFound"],
                [base(), "errors.assessment.fieldRequired"],
                [{copyFromId: 999999999}, "errors.assessment.criterion.notFound"],
                [{copyFromId: v1.id, criterionGroupId: other.criterionGroupId}, "errors.assessment.criterion.copySourceMismatch"],
            ];
            for (const [payload, key] of cases) {
                expect(await call(admin, "criterionCreateVersion", payload)).toMatchObject({success: false, key});
            }
        });
    });

    describe("delete a criterion version", () => {
        test("deletes an unreferenced version with its options and leaves the other versions", async () => {
            const v1 = await create({});
            const v2 = (await addVersion({copyFromId: v1.id})).data;

            const response = await call(admin, "criterionDelete", {criterionId: v2.id});
            expect(response).toMatchObject({success: true, data: {id: v2.id, criterionGroupId: v1.criterionGroupId}});

            expect(response.data.latestVersionId).toBe(v1.id);
            // soft delete: the version and its options stay in the table, flagged, and are hidden from every read
            expect(await db.models.criterion.count({where: {id: v2.id}})).toBe(1);
            expect(await db.models.criterion.count({where: {id: v2.id, deleted: false}})).toBe(0);
            expect(await db.models.criterion_scoring_option.count({where: {criterionId: v2.id}})).toBe(3);
            expect(await db.models.criterion_scoring_option.count({where: {criterionId: v2.id, deleted: false}})).toBe(0);
            expect((await call(admin, "criterionGet", {criterionId: v2.id})).success).toBe(false);
            const remaining = (await call(admin, "criterionGet", {criterionId: v1.id})).data;
            expect(remaining).toEqual(v1);
        });

        test("deleting the first version keeps the later one usable", async () => {
            const v1 = await create({});
            const v2 = (await addVersion({copyFromId: v1.id})).data;
            expect((await call(admin, "criterionDelete", {criterionId: v1.id})).success).toBe(true);
            expect((await call(admin, "criterionGet", {criterionId: v2.id})).data.criterionGroupId).toBe(v1.criterionGroupId);
            // the group id is not reused, and a new version number can still be added
            expect((await addVersion({copyFromId: v2.id})).success).toBe(true);
        });

        test("is refused while a rubric references the version", async () => {
            const v1 = await create();
            const rubric = await referenceFromRubric(v1.id);

            const response = await call(admin, "criterionDelete", {criterionId: v1.id});
            expect(response).toMatchObject({
                success: false,
                key: "errors.assessment.criterion.inUse",
                params: {name: v1.name, version: "1", count: 1, references: `'${rubric.name}' (v1)`},
            });
            // names and version numbers, never database ids
            expect(response.message).toBe(`Cannot delete '${v1.name}' (version 1) because it is used by 1 rubric version(s): '${rubric.name}' (v1).`);
            expect(response.message).not.toMatch(new RegExp(`\\b(${v1.id}|${rubric.id})\\b`));
            // criterion and options are intact
            expect((await call(admin, "criterionGet", {criterionId: v1.id})).data).toEqual(v1);
        });

        test("the message uses the stored version numbers of the rubrics, not their ids, and lists several of them", async () => {
            const v1 = await create();
            const first = await referenceFromRubric(v1.id, {name: "Rubric 1"});
            const second = await referenceFromRubric(v1.id, {name: "Rubric R1", versionNumber: "2"});
            const response = await call(admin, "criterionDelete", {criterionId: v1.id});
            expect(response.params).toMatchObject({count: 2, references: "'Rubric 1' (v1), 'Rubric R1' (v2)"});
            expect(response.params.references).not.toContain(String(first.id));
            expect(response.params.references).not.toContain(String(second.id));
        });

        test("rubrics with the same name in different groups are told apart by their group", async () => {
            const v1 = await create();
            const one = await referenceFromRubric(v1.id, {name: "Same name"});
            const two = await referenceFromRubric(v1.id, {name: "Same name"});
            const response = await call(admin, "criterionDelete", {criterionId: v1.id});
            expect(response.params.references).toBe(`'Same name' (v1, #${one.rubricGroupId}), 'Same name' (v1, #${two.rubricGroupId})`);
        });

        test("a long list is cut after five entries and user-made names cannot break the message", async () => {
            const v1 = await create({name: "Quote ' and \"double\" <b>tag</b> {version} \u0001"});
            for (let i = 1; i <= 7; i++) {
                await referenceFromRubric(v1.id, {name: i === 1 ? `line\nbreak\u2028and tab\t${"x".repeat(100)}` : `R${i}`});
            }
            const response = await call(admin, "criterionDelete", {criterionId: v1.id});
            expect(response).toMatchObject({success: false, key: "errors.assessment.criterion.inUse"});
            expect(response.params.count).toBe(7);
            expect(response.params.references).toMatch(/, … \(\+2\)$/);
            expect(response.params.references).not.toMatch(/[\n\t\u2028\u0001]/);
            expect(response.params.references.length).toBeLessThan(200);
            // control characters are removed, nothing else is altered
            expect(response.params.name).toBe("Quote ' and \"double\" <b>tag</b> {version}");
            // the {version} inside the name is data: it is not interpolated a second time
            expect(response.message).toContain("{version}' (version 1)");
        });

        test("another version of the same group can still be deleted while one is referenced", async () => {
            const v1 = await create({});
            const v2 = (await addVersion({copyFromId: v1.id})).data;
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
                ["criterionCreateVersion", {copyFromId: row.id}],
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

            const version = await addVersion({copyFromId: row.id}, allowed);
            expect(version.success).toBe(true);
            const own = await create({}, allowed);
            expect(own.id).toBeDefined();

            expect((await call(allowed, "criterionDelete", {criterionId: version.data.id})).success).toBe(true);
            expect((await call(allowed, "criterionDelete", {criterionId: row.id})).success).toBe(true);
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
            expect((await create({minPoints: 2, maxPoints: 2, scoringOptions: [{points: 2, description: "only"}]})).minPoints).toBe(2);
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
                name, minPoints: null, maxPoints: null, scoringOptions: [{points: 1, description: "ok"}, {points: `1${"0".repeat(200000)}`, description: "huge"}],
            }));
            expect(response.success).toBe(false);
            expect(await countByName(name)).toBe(0);
        });
    });

    describe("client version numbers", () => {
        // every value is refused, whatever it looks like: the backend alone assigns the number
        const refused = [["1"], ["1.1"], [" 3.1 "], [2], [0], [""], ["  "], [null], [{}], [["1"]], ["abc"], ["x".repeat(256)]];

        test.each(refused)("criterionCreate refuses a versionNumber %j and stores nothing", async (versionNumber) => {
            const name = next();
            const response = await call(admin, "criterionCreate", base({name, versionNumber}));
            expect(response).toMatchObject({success: false, key: "errors.assessment.versionNumberNotAllowed"});
            expect(await countByName(name)).toBe(0);
        });

        test.each(refused)("criterionCreateVersion refuses a versionNumber %j, with or without a copy source, and stores nothing", async (versionNumber) => {
            const v1 = await create({});
            expect(await addVersion({copyFromId: v1.id, versionNumber}))
                .toMatchObject({success: false, key: "errors.assessment.versionNumberNotAllowed"});
            expect(await addVersion(base({criterionGroupId: v1.criterionGroupId, versionNumber})))
                .toMatchObject({success: false, key: "errors.assessment.versionNumberNotAllowed"});
            expect(await db.models.criterion.count({where: {criterionGroupId: v1.criterionGroupId}})).toBe(1);
        });

        test("numbers are never reused: after the newest version is deleted the next one continues the sequence", async () => {
            const v1 = await create({});
            const v2 = (await addVersion({copyFromId: v1.id})).data;
            expect(v2.versionNumber).toBe("2");
            expect((await call(admin, "criterionDelete", {criterionId: v2.id})).success).toBe(true);
            expect((await addVersion({copyFromId: v1.id})).data.versionNumber).toBe("3");
        });

        test("a stored label of another form stays readable, listed and copyable; the copy gets the next number", async () => {
            // e.g. imported data: written straight to the table, never through the API
            const old = await db.models.criterion.create({versionNumber: "v1-beta", name: next(), description: "", minPoints: 0, maxPoints: 2});
            created.criterion.push(old.id);
            expect((await call(admin, "criterionGet", {criterionId: old.id})).data.versionNumber).toBe("v1-beta");
            expect((await call(admin, "criterionGetAll")).data.find((c) => c.id === old.id).versionNumber).toBe("v1-beta");
            const copy = await addVersion({copyFromId: old.id});
            // "v1-beta" has no leading number and counts as 0, so the first automatic number of its group is 1
            expect(copy).toMatchObject({success: true, data: {criterionGroupId: old.criterionGroupId, versionNumber: "1"}});
            expect((await call(admin, "criterionGet", {criterionId: old.id})).data.versionNumber).toBe("v1-beta");
        });
    });

    describe("scoring options within the criterion range", () => {
        const options = (...points) => points.map((p) => ({points: p, description: String(p)}));
        const rejected = async (data, key, params) => {
            const name = next();
            const response = await call(admin, "criterionCreate", base({name, ...data}));
            expect(response).toMatchObject({success: false, key, params});
            expect(await countByName(name)).toBe(0);
        };

        test("points at the bounds and inside them are accepted, negative and decimal values included", async () => {
            const row = await create({minPoints: -2, maxPoints: 3.5, scoringOptions: options(-2, -0.25, 0, 1.75, 3.5)});
            expect(row.scoringOptions.map((o) => o.points)).toEqual([-2, -0.25, 0, 1.75, 3.5]);
            expect((await create({minPoints: 2, maxPoints: 2, scoringOptions: options(2)})).scoringOptions).toHaveLength(1);
            expect((await create({minPoints: "-1.5", maxPoints: "1.5", scoringOptions: options("-1.5", "1.5")})).scoringOptions).toHaveLength(2);
        });

        test("points below the minimum or above the maximum are rejected with the option position and the bound", async () => {
            await rejected({minPoints: 0, maxPoints: 4, scoringOptions: options(1, -0.01)}, "errors.assessment.optionBelowMin", {position: 2, min: 0});
            await rejected({minPoints: 0, maxPoints: 4, scoringOptions: options(4, 4.01, 9)}, "errors.assessment.optionAboveMax", {position: 2, max: 4});
            await rejected({minPoints: -3, maxPoints: -1, scoringOptions: options(-3, 0)}, "errors.assessment.optionAboveMax", {position: 2, max: -1});
            await rejected({minPoints: "0.5", maxPoints: "1", scoringOptions: options("0.49")}, "errors.assessment.optionBelowMin", {position: 1, min: 0.5});
        });

        test("with one bound only that bound is enforced", async () => {
            expect((await create({minPoints: 1, maxPoints: null, scoringOptions: options(1, 500)})).scoringOptions).toHaveLength(2);
            await rejected({minPoints: 1, maxPoints: null, scoringOptions: options(0.99)}, "errors.assessment.optionBelowMin", {position: 1, min: 1});
            expect((await create({minPoints: null, maxPoints: -5, scoringOptions: options(-5, -1000)})).scoringOptions).toHaveLength(2);
            await rejected({minPoints: null, maxPoints: -5, scoringOptions: options(-4.9)}, "errors.assessment.optionAboveMax", {position: 1, max: -5});
        });

        test("without bounds any number is accepted", async () => {
            const row = await create({minPoints: null, maxPoints: null, scoringOptions: options(-1e6, 0.001, 1e6)});
            expect(row.scoringOptions.map((o) => o.points)).toEqual([-1e6, 0.001, 1e6]);
        });

        test("a new version is checked against its own bounds, copied options included", async () => {
            const v1 = await create({minPoints: 0, maxPoints: 4, scoringOptions: options(0, 2, 4)});
            // narrowing the range makes the copied option 4 invalid; nothing is clamped or dropped
            expect(await addVersion({copyFromId: v1.id, maxPoints: 3}))
                .toMatchObject({success: false, key: "errors.assessment.optionAboveMax", params: {position: 3, max: 3}});
            expect(await addVersion({copyFromId: v1.id, maxPoints: 3, scoringOptions: options(0, 2, 3)}))
                .toMatchObject({success: true});
            expect(await addVersion({copyFromId: v1.id, maxPoints: null})).toMatchObject({success: true});
            expect(await db.models.criterion.count({where: {criterionGroupId: v1.criterionGroupId}})).toBe(3);
            expect((await call(admin, "criterionGet", {criterionId: v1.id})).data).toEqual(v1);
        });

        test("a stored version whose options lie outside its bounds stays readable", async () => {
            const old = await db.sequelize.transaction(async (transaction) => {
                const row = await db.models.criterion.create({versionNumber: "1", name: next(), description: "", minPoints: 0, maxPoints: 2}, {transaction});
                await db.models.criterion_scoring_option.create({criterionId: row.id, points: 9, description: "legacy", position: 1}, {transaction});
                return row;
            });
            created.criterion.push(old.id);
            expect((await call(admin, "criterionGet", {criterionId: old.id})).data.scoringOptions.map((o) => o.points)).toEqual([9]);
            // copying it as it is is refused until the options or the bounds are fixed
            expect(await addVersion({copyFromId: old.id})).toMatchObject({success: false, key: "errors.assessment.optionAboveMax"});
            expect(await addVersion({copyFromId: old.id, maxPoints: 10})).toMatchObject({success: true});
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
            await addVersion({copyFromId: v1.id, scoringOptions: []});
            expect((await call(admin, "criterionGet", {criterionId: v1.id})).data).toEqual(v1);
        });
    });
});
