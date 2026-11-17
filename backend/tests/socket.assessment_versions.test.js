const Server = require("../webserver/Server.js");
const {getSocketClient} = require("./utils.js");
const {softDeleteAssessmentVersion} = require("../utils/helper/assessmentLifecycle.js");

/**
 * Phase B socket tests of the revised versioning design, for criteria, rubrics and assessments: automatic
 * sequential version numbers (a client number is refused), latest-version and history queries,
 * soft deletion, Advanced Settings without special keys, nullable rubric bounds and the assessment
 * predecessor links. Real server, real sockets, real PostgreSQL.
 */
describe("Test Websockets - Versioning (Phase B)", () => {
    const PORT = 3111;
    const tag = `t${Date.now()}`;
    let counter = 0;
    const next = () => `${tag}-${++counter}`;

    let server;
    let admin;
    let denied;
    let db;
    const sockets = [];
    const created = {assessment: [], rubric: [], criterion: [], users: []};

    const call = (socket, event, data = {}) => new Promise((resolve) => socket.emit(event, data, resolve));
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    /** the three entities with their events, group key and a minimal valid payload */
    const ENTITIES = {
        criterion: {group: "criterionGroupId", id: "criterionId", payload: () => ({name: next(), description: ""})},
        rubric: {group: "rubricGroupId", id: "rubricId", payload: () => ({name: next(), description: "", minPoints: 0, maxPoints: 4})},
        assessment: {group: "assessmentGroupId", id: "assessmentId", payload: () => ({name: next(), description: ""})},
    };
    const create = async (kind, data = {}) => {
        const response = await call(admin, `${kind}Create`, {...ENTITIES[kind].payload(), ...data});
        expect(response.success).toBe(true);
        created[kind].push(response.data.id);
        return response.data;
    };
    const addVersion = async (kind, data) => {
        const response = await call(admin, `${kind}CreateVersion`, data);
        if (response.success) {
            created[kind].push(response.data.id);
        }
        return response;
    };
    const newVersion = async (kind, source, data = {}) => {
        const response = await addVersion(kind, {copyFromId: source.id, ...data});
        expect(response.success).toBe(true);
        return response.data;
    };
    const remove = async (kind, id) => {
        const response = await call(admin, `${kind}Delete`, {[ENTITIES[kind].id]: id});
        expect(response.success).toBe(true);
        return response.data;
    };
    const latest = async (kind) => {
        const response = await call(admin, `${kind}GetLatest`);
        expect(response.success).toBe(true);
        return response.data;
    };
    const latestOf = async (kind, group) => (await latest(kind)).find((row) => row[ENTITIES[kind].group] === group);
    const versionsOf = async (kind, group) => {
        const response = await call(admin, `${kind}GetVersions`, {[ENTITIES[kind].group]: group});
        expect(response.success).toBe(true);
        return response.data;
    };
    const numbers = (rows) => rows.map((row) => row.versionNumber);

    beforeAll(async () => {
        db = require("../db/index.js");
        server = new Server();
        server.start(PORT);
        admin = await getSocketClient(server, PORT, process.env.ADMIN_EMAIL, process.env.ADMIN_PWD);
        sockets.push(admin);

        const {genSalt, genPwdHash} = require("../webserver/auth/utils.js");
        const salt = genSalt();
        const user = await db.models.user.create({
            userName: `${tag}denied`, email: `${tag}denied@test.de`, firstName: "t", lastName: "u",
            passwordHash: await genPwdHash("testuser", salt), salt, acceptTerms: true, acceptStats: false, emailVerified: true,
        });
        created.users.push(user.id);
        denied = await getSocketClient(server, PORT, `${tag}denied`, "testuser");
        sockets.push(denied);
    });

    afterAll(async () => {
        sockets.forEach((socket) => socket.connected && socket.disconnect());
        for (const id of [...created.assessment].sort((a, b) => b - a)) {
            await db.models.assessment.destroy({where: {id}});
        }
        await db.models.rubric.destroy({where: {id: created.rubric}});
        await db.models.criterion.destroy({where: {id: created.criterion}});
        const query = (sql, replacements) => db.sequelize.query(sql, {replacements});
        await query('DELETE FROM "user_role_matching" WHERE "userId" IN (:ids)', {ids: created.users});
        // the logger writes the refused requests of these users to the log table asynchronously
        await new Promise((resolve) => setTimeout(resolve, 500));
        await query('DELETE FROM "log" WHERE "userId" IN (:ids)', {ids: created.users});
        await query('DELETE FROM "user" WHERE id IN (:ids)', {ids: created.users});
        server.stop();
    });

    describe.each(Object.keys(ENTITIES))("%s: automatic version numbers", (kind) => {
        const {group} = ENTITIES[kind];

        test("a new entity starts at version 1, every new version counts on by one", async () => {
            const v1 = await create(kind);
            expect(v1.versionNumber).toBe("1");
            const v2 = await newVersion(kind, v1);
            const v3 = await newVersion(kind, v2);
            expect(numbers([v2, v3])).toEqual(["2", "3"]);
            expect([v2[group], v3[group]]).toEqual([v1[group], v1[group]]);
        });

        test("the number never goes down: 1, 2, 3 with 3 deleted gives 4, and a deleted number is never reused", async () => {
            const v1 = await create(kind);
            const v2 = await newVersion(kind, v1);
            const v3 = await newVersion(kind, v2);
            await remove(kind, v3.id);
            const v4 = await newVersion(kind, v2);
            expect(v4.versionNumber).toBe("4");

            await remove(kind, v2.id);       // a number in the middle
            await remove(kind, v4.id);       // the newest again
            const v5 = await newVersion(kind, v1);
            expect(v5.versionNumber).toBe("5");
            expect(numbers(await versionsOf(kind, v1[group]))).toEqual(["5", "1"]);
        });

        test("older version labels stay as they are and count by their leading integer", async () => {
            const model = db.models[kind];
            const base = {name: next(), description: "", ...(kind === "rubric" ? {minPoints: 0, maxPoints: 1} : {})};
            const first = await model.create({...base, versionNumber: "1.2"});
            const second = await model.create({...base, versionNumber: "1.1", [group]: first[group], ...(kind === "assessment" ? {previousAssessmentVersionId: first.id} : {})});
            const odd = await model.create({...base, versionNumber: "v1-beta", [group]: first[group], ...(kind === "assessment" ? {previousAssessmentVersionId: second.id} : {})});
            created[kind].push(first.id, second.id, odd.id);

            // they are readable and listed as written
            expect(numbers(await versionsOf(kind, first[group]))).toEqual(["v1-beta", "1.1", "1.2"]);
            const added = await newVersion(kind, odd);
            expect(added.versionNumber).toBe("2");
            const again = await newVersion(kind, added);
            expect(again.versionNumber).toBe("3");
            expect((await model.getById(first.id)).versionNumber).toBe("1.2");   // nothing was renumbered

            // a high older label moves the counter past it
            const high = await model.create({...base, versionNumber: "7.3.1", [group]: first[group], ...(kind === "assessment" ? {previousAssessmentVersionId: again.id} : {})});
            created[kind].push(high.id);
            expect((await newVersion(kind, high)).versionNumber).toBe("8");
        });

        test("simultaneous requests never produce a duplicate or a gap", async () => {
            const v1 = await create(kind);
            const responses = await Promise.all(Array.from({length: 8}, () => call(admin, `${kind}CreateVersion`, {copyFromId: v1.id})));
            expect(responses.every((response) => response.success)).toBe(true);
            responses.forEach((response) => created[kind].push(response.data.id));

            const all = numbers(await versionsOf(kind, v1[group])).map(Number).sort((a, b) => a - b);
            expect(all).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        });

        test("a version number sent by a client is always refused and nothing is stored; without it everything works", async () => {
            const first = await create(kind);
            const name = next();
            expect(await call(admin, `${kind}Create`, {...ENTITIES[kind].payload(), name, versionNumber: "1"}))
                .toMatchObject({success: false, key: "errors.assessment.versionNumberNotAllowed"});
            expect(await call(admin, `${kind}CreateVersion`, {copyFromId: first.id, versionNumber: "9"}))
                .toMatchObject({success: false, key: "errors.assessment.versionNumberNotAllowed"});
            expect(await call(admin, `${kind}Create`, {...ENTITIES[kind].payload(), versionNumber: null}))
                .toMatchObject({success: false, key: "errors.assessment.versionNumberNotAllowed"});
            expect(await db.models[kind].count({where: {name}})).toBe(0);
            const second = await addVersion(kind, {copyFromId: first.id});
            expect(second.success).toBe(true);
            expect(second.data.versionNumber).toBe("2");
        });

    });

    describe.each(Object.keys(ENTITIES))("%s: latest versions and version history", (kind) => {
        const {group} = ENTITIES[kind];

        test("the latest list has one entry per group with the number of live versions, and no nested data", async () => {
            const v1 = await create(kind);
            const v2 = await newVersion(kind, v1);
            const v3 = await newVersion(kind, v2);
            const other = await create(kind, {name: v1.name});          // same name, other group

            const rows = await latest(kind);
            const entry = rows.find((row) => row[group] === v1[group]);
            expect(entry).toMatchObject({id: v3.id, versionNumber: "3", versionCount: 3, name: v1.name});
            expect(rows.filter((row) => row[group] === v1[group])).toHaveLength(1);
            expect(rows.find((row) => row[group] === other[group])).toMatchObject({id: other.id, versionCount: 1});
            for (const nested of ["scoringOptions", "criteria", "rubrics"]) {
                expect(entry).not.toHaveProperty(nested);
            }
            expect(entry.createdAt).toBeDefined();
        });

        test("deleting the latest version makes the previous one the latest and lowers the count; a group with no version left disappears", async () => {
            const v1 = await create(kind);
            const v2 = await newVersion(kind, v1);
            const v3 = await newVersion(kind, v2);

            expect((await remove(kind, v3.id)).latestVersionId).toBe(v2.id);
            expect(await latestOf(kind, v1[group])).toMatchObject({id: v2.id, versionNumber: "2", versionCount: 2});

            expect((await remove(kind, v1.id)).latestVersionId).toBe(v2.id);        // an older one: the latest stays
            expect(await latestOf(kind, v1[group])).toMatchObject({id: v2.id, versionCount: 1});

            expect((await remove(kind, v2.id)).latestVersionId).toBeNull();
            expect(await latestOf(kind, v1[group])).toBeUndefined();
            expect((await call(admin, `${kind}GetVersions`, {[group]: v1[group]})).key).toBe(`errors.assessment.${kind}.groupNotFound`);
        });

        test("the history lists only live versions, newest first, by group id and not by name", async () => {
            const v1 = await create(kind, {name: "Same name"});
            const v2 = await newVersion(kind, v1, {name: "Same name"});
            const stranger = await create(kind, {name: "Same name"});
            const v3 = await newVersion(kind, v2, {name: "A different name"});
            await remove(kind, v2.id);

            const history = await versionsOf(kind, v1[group]);
            expect(history.map((row) => row.id)).toEqual([v3.id, v1.id]);
            expect(history[0]).toEqual({id: v3.id, [group]: v1[group], versionNumber: "3", name: "A different name", createdAt: expect.any(String)});
            expect(history.some((row) => row.id === stranger.id)).toBe(false);
        });

        test("a deleted version is gone from every read and cannot be copied", async () => {
            const v1 = await create(kind);
            const v2 = await newVersion(kind, v1);
            await remove(kind, v2.id);
            expect((await call(admin, `${kind}Get`, {[ENTITIES[kind].id]: v2.id})).success).toBe(false);
            expect((await call(admin, `${kind}GetAll`)).data.some((row) => row.id === v2.id)).toBe(false);
            expect(await call(admin, `${kind}CreateVersion`, {copyFromId: v2.id})).toMatchObject({success: false, key: `errors.assessment.${kind}.notFound`});
            // deleting it again fails (not found, or disabled for assessments)
            expect((await call(admin, `${kind}Delete`, {[ENTITIES[kind].id]: v2.id})).success).toBe(false);
        });

        test.each([[0], [-1], ["abc"], [null], [999999999]])("history of group %p fails", async (groupId) => {
            expect(await call(admin, `${kind}GetVersions`, {[group]: groupId})).toMatchObject({success: false, key: `errors.assessment.${kind}.groupNotFound`});
        });

        test("the new events need the dashboard right", async () => {
            const row = await create(kind);
            for (const [event, payload] of [[`${kind}GetLatest`, {}], [`${kind}GetVersions`, {[group]: row[group]}]]) {
                expect(await call(denied, event, payload)).toMatchObject({success: false, key: "errors.assessment.accessDenied"});
            }
        });
    });

    describe("assessment: predecessor links through the socket", () => {
        test("the first version has none, new versions point at the latest live one, never at the copy source", async () => {
            const v1 = await create("assessment");
            expect(v1.previousAssessmentVersionId).toBeNull();
            const v2 = await newVersion("assessment", v1);
            const v3 = await newVersion("assessment", v2);
            const fromOld = await newVersion("assessment", v1);          // copies v1, but follows the latest, v3
            expect(v2.previousAssessmentVersionId).toBe(v1.id);
            expect(v3.previousAssessmentVersionId).toBe(v2.id);
            expect(fromOld.previousAssessmentVersionId).toBe(v3.id);
            expect((await latestOf("assessment", v1.assessmentGroupId)).previousAssessmentVersionId).toBe(v3.id);
        });

        test("chains of different assessments stay separate", async () => {
            const [a, b] = [await create("assessment"), await create("assessment")];
            const a2 = await newVersion("assessment", a);
            const b2 = await newVersion("assessment", b);
            expect([a2.previousAssessmentVersionId, b2.previousAssessmentVersionId]).toEqual([a.id, b.id]);
        });

        test("deleting the newest, an intermediate, the oldest and the only version through the socket event", async () => {
            const v1 = await create("assessment");
            const v2 = await newVersion("assessment", v1);
            const v3 = await newVersion("assessment", v2);
            const v4 = await newVersion("assessment", v3);
            const group = v1.assessmentGroupId;

            // intermediate: the successor is re-linked, the latest stays the same
            expect(await remove("assessment", v2.id)).toEqual({id: v2.id, assessmentGroupId: group, latestVersionId: v4.id});
            expect((await db.models.assessment.getById(v3.id)).previousAssessmentVersionId).toBe(v1.id);
            expect(numbers(await versionsOf("assessment", group))).toEqual(["4", "3", "1"]);
            expect(await latestOf("assessment", group)).toMatchObject({id: v4.id, versionCount: 3});

            // newest: the latest moves back, the count follows
            expect(await remove("assessment", v4.id)).toMatchObject({latestVersionId: v3.id});
            expect(await latestOf("assessment", group)).toMatchObject({id: v3.id, versionNumber: "3", versionCount: 2});

            // oldest: the next one becomes the start of the chain
            expect(await remove("assessment", v1.id)).toMatchObject({latestVersionId: v3.id});
            expect((await db.models.assessment.getById(v3.id)).previousAssessmentVersionId).toBeNull();

            // only version: the group is gone from the tables
            expect(await remove("assessment", v3.id)).toMatchObject({latestVersionId: null});
            expect(await latestOf("assessment", group)).toBeUndefined();
            expect(await call(admin, "assessmentGetVersions", {assessmentGroupId: group})).toMatchObject({success: false, key: "errors.assessment.assessment.groupNotFound"});

            // soft deleted: the rows stay, flagged, with their own predecessor links as history
            const kept = await db.models.assessment.findAll({where: {assessmentGroupId: group}, order: [["id", "ASC"]], raw: true});
            expect(kept.map((row) => [row.id, row.deleted])).toEqual([[v1.id, true], [v2.id, true], [v3.id, true], [v4.id, true]]);
        });

        test("a deleted version cannot be deleted again, and surviving versions keep their contents", async () => {
            const v1 = await create("assessment");
            const v2 = await newVersion("assessment", v1);
            const before = (await call(admin, "assessmentGet", {assessmentId: v1.id})).data;
            expect(await remove("assessment", v2.id)).toMatchObject({id: v2.id});
            expect(await call(admin, "assessmentDelete", {assessmentId: v2.id})).toMatchObject({success: false, key: "errors.assessment.assessment.notFound"});
            expect((await call(admin, "assessmentGet", {assessmentId: v1.id})).data).toEqual(before);
            // the group continues with the next free number, not with the deleted one
            expect((await newVersion("assessment", v1)).versionNumber).toBe("3");
        });

        test("the version-chain deletion re-links, reports the latest and respects references", async () => {
            const v1 = await create("assessment");
            const v2 = await newVersion("assessment", v1);
            const v3 = await newVersion("assessment", v2);
            const v4 = await newVersion("assessment", v3);

            const deleteVersion = (id) => db.sequelize.transaction((t) => softDeleteAssessmentVersion(db.sequelize, id, t));
            expect(await deleteVersion(v2.id)).toEqual({id: v2.id, assessmentGroupId: v1.assessmentGroupId, latestVersionId: v4.id});
            expect((await db.models.assessment.getById(v3.id)).previousAssessmentVersionId).toBe(v1.id);

            // a version a study step uses is refused and stays
            const [study] = (await db.sequelize.query(
                'INSERT INTO study (hash, template, "createdAt", "updatedAt") VALUES (:hash, false, now(), now()) RETURNING id',
                {replacements: {hash: next()}}))[0];
            const [workflowStep] = (await db.sequelize.query("SELECT id, name FROM workflow_step ORDER BY id LIMIT 1"))[0];
            const [step] = (await db.sequelize.query(
                `INSERT INTO study_step ("studyId", "workflowStepId", "stepType", configuration, "createdAt", "updatedAt")
                 VALUES (:study, :workflowStep, 1, CAST(:configuration AS jsonb), now(), now()) RETURNING id`,
                {replacements: {study: study.id, workflowStep: workflowStep.id, configuration: JSON.stringify({settings: {assessmentId: v4.id}})}}))[0];
            try {
                await expect(deleteVersion(v4.id)).rejects.toMatchObject({key: "errors.assessment.assessment.inUse", params: expect.objectContaining({name: v4.name, version: "4", count: 1, studySteps: `Study step #${step.id}`})});
                expect((await db.models.assessment.getById(v4.id)).deleted).toBe(false);
                await expect(deleteVersion(999999999)).rejects.toMatchObject({key: "errors.assessment.assessment.notFound"});
                await expect(deleteVersion(v2.id)).rejects.toMatchObject({key: "errors.assessment.assessment.notFound"});   // already deleted
            } finally {
                await db.sequelize.query("DELETE FROM study_step WHERE id = :id", {replacements: {id: step.id}});
                await db.sequelize.query("DELETE FROM study WHERE id = :id", {replacements: {id: study.id}});
            }
            // the chain is intact after the refusal, and the newest can go now
            expect((await deleteVersion(v4.id)).latestVersionId).toBe(v3.id);
            expect((await latestOf("assessment", v1.assessmentGroupId))).toMatchObject({id: v3.id, versionCount: 2});
        });
    });

    describe("rubric: optional bounds", () => {
        test("a rubric without minimum and/or maximum points is stored with NULL bounds and read back as null", async () => {
            const none = await create("rubric", {minPoints: undefined, maxPoints: undefined});
            const onlyMax = await create("rubric", {minPoints: null, maxPoints: -3.5});
            const onlyMin = await create("rubric", {minPoints: "2.25", maxPoints: undefined});
            expect([none.minPoints, none.maxPoints]).toEqual([null, null]);
            expect([onlyMax.minPoints, onlyMax.maxPoints]).toEqual([null, -3.5]);
            expect([onlyMin.minPoints, onlyMin.maxPoints]).toEqual([2.25, null]);

            const rows = await latest("rubric");
            expect(rows.find((row) => row.id === none.id)).toMatchObject({minPoints: null, maxPoints: null});
            expect(rows.find((row) => row.id === onlyMax.id)).toMatchObject({minPoints: null, maxPoints: -3.5});
        });

        test("a copy keeps an inactive bound, can switch one on or off, and min above max is still refused", async () => {
            const v1 = await create("rubric", {minPoints: null, maxPoints: 10});
            expect((await newVersion("rubric", v1)).minPoints).toBeNull();
            expect((await newVersion("rubric", v1, {minPoints: -5})).minPoints).toBe(-5);
            const off = await newVersion("rubric", v1, {maxPoints: null});
            expect([off.minPoints, off.maxPoints]).toEqual([null, null]);
            expect(await call(admin, "rubricCreate", {...ENTITIES.rubric.payload(), minPoints: 5, maxPoints: 1}))
                .toMatchObject({success: false, key: "errors.assessment.pointsRange"});
            expect((await call(admin, "rubricCreate", {...ENTITIES.rubric.payload(), minPoints: "x"})).key).toBe("errors.assessment.fieldInvalid");
        });

        test("legacy calculation values such as min (capped sum) are stored and read as they are", async () => {
            const row = await create("rubric", {calculation: "min"});
            expect(row.calculation).toBe("min");
            expect((await newVersion("rubric", row)).calculation).toBe("min");
        });
    });

    describe.each(["rubric", "criterion"])("%s: Advanced Settings", (kind) => {
        const settingsOf = async (id) => (await db.models[kind].getById(id)).settings;

        test("keys and values round trip with their types: text stays text, numbers and booleans stay what they are", async () => {
            const settings = {note: "true", flag: true, count: 3, ratio: -0.25, empty: "", "with space": "x y", unicode: "äöü€"};
            const row = await create(kind, {settings});
            expect(row.settings).toMatchObject(settings);
            expect(await settingsOf(row.id)).toEqual(settings);
            expect(typeof row.settings.note).toBe("string");
            expect(row.settings.flag).toBe(true);

            const copy = await newVersion(kind, row);
            expect(copy.settings).toEqual(settings);
            const changed = await newVersion(kind, row, {settings: {...settings, count: 4}});
            expect(changed.settings.count).toBe(4);
            expect(await settingsOf(row.id)).toEqual(settings);        // the original is untouched
            expect((await latestOf(kind, row[ENTITIES[kind].group])).settings.count).toBe(4);
        });

        test("settings replace the copied ones as a whole: a key that is not sent is removed", async () => {
            const row = await create(kind, {settings: {a: 1, b: 2}});
            expect((await newVersion(kind, row, {settings: {b: 2}})).settings).toEqual({b: 2});
            expect((await newVersion(kind, row, {settings: {}})).settings).toEqual({});
        });

        test("keys are stored trimmed", async () => {
            expect((await create(kind, {settings: {"  padded  ": 1}})).settings).toEqual({padded: 1});
        });

        test.each([
            ["an array", [1], "errors.assessment.settingsInvalid"],
            ["a string", "text", "errors.assessment.settingsInvalid"],
            ["null", null, "errors.assessment.settingsInvalid"],
            ["an empty key", {"": 1}, "errors.assessment.settingsKeyInvalid"],
            ["a blank key", {"   ": 1}, "errors.assessment.settingsKeyInvalid"],
            ["a key that is too long", {["k".repeat(256)]: 1}, "errors.assessment.settingsKeyInvalid"],
            ["keys that are the same after trimming", {a: 1, " a ": 2}, "errors.assessment.settingsKeyDuplicate"],
            ["a null value", {a: null}, "errors.assessment.settingsValueInvalid"],
            ["an object value", {a: {b: 1}}, "errors.assessment.settingsValueInvalid"],
            ["an array value", {a: [1]}, "errors.assessment.settingsValueInvalid"],
            ["a text value that is too long", {a: "v".repeat(10001)}, "errors.assessment.settingsValueInvalid"],
        ])("settings that are %s are rejected and nothing is stored", async (_label, settings, key) => {
            const name = next();
            const response = await call(admin, `${kind}Create`, {...ENTITIES[kind].payload(), name, settings});
            expect(response).toMatchObject({success: false, key});
            expect(await db.models[kind].count({where: {name}})).toBe(0);
        });

        test("100 entries are fine, 101 are not; a text value of 10 000 characters is fine", async () => {
            const entries = (n) => Object.fromEntries(Array.from({length: n}, (_, i) => [`key${i}`, i]));
            expect(Object.keys((await create(kind, {settings: entries(100)})).settings)).toHaveLength(100);
            expect(await call(admin, `${kind}Create`, {...ENTITIES[kind].payload(), settings: entries(101)}))
                .toMatchObject({success: false, key: "errors.assessment.settingsInvalid"});
            expect((await create(kind, {settings: {long: "v".repeat(10000)}})).settings.long).toHaveLength(10000);
        });

        test("keys that could reach the prototype are rejected, and nothing is polluted", async () => {
            // JSON.parse makes "__proto__" an own key, as a client's JSON does
            for (const text of ['{"__proto__": {"polluted": true}}', '{"constructor": 1}', '{"prototype": "x"}', '{" __proto__ ": 1}']) {
                const response = await call(admin, `${kind}Create`, {...ENTITIES[kind].payload(), settings: JSON.parse(text)});
                expect(response).toMatchObject({success: false, key: "errors.assessment.settingsKeyInvalid"});
            }
            expect({}.polluted).toBeUndefined();
            expect(Object.prototype.polluted).toBeUndefined();
            // ordinary names that merely look similar are fine
            expect((await create(kind, {settings: {proto: 1, constructors: 2, toString: 3}})).settings).toEqual({proto: 1, constructors: 2, toString: 3});
        });
    });

    describe("criterion: no settings key is special", () => {
        const columnsOf = async (id) => (await db.sequelize.query("SELECT * FROM criterion WHERE id = :id", {replacements: {id}}))[0][0];

        test("the removed columns do not exist; function, expertLevel and subjective are ordinary keys with any type", async () => {
            const row = await create("criterion", {settings: {function: 5, expertLevel: "high", subjective: "yes", other: 1.5}});
            expect(row.settings).toEqual({function: 5, expertLevel: "high", subjective: "yes", other: 1.5});
            const stored = await columnsOf(row.id);
            for (const column of ["function", "expertLevel", "subjective"]) {
                expect(stored).not.toHaveProperty(column);
            }
            expect(stored.settings).toEqual(row.settings);
        });

        test("top-level function, expertLevel and subjective in a request are not special: ignored, not stored in settings, not mirrored in the response", async () => {
            const row = await create("criterion", {function: "auto_grading", expertLevel: 0, subjective: false});
            expect(row.settings).toEqual({});
            for (const field of ["function", "expertLevel", "subjective"]) {
                expect(row).not.toHaveProperty(field);
            }
            const withSettings = await create("criterion", {settings: {function: "f"}});
            expect((await newVersion("criterion", withSettings, {expertLevel: 4})).settings).toEqual({function: "f"});
        });

        test("a key removed in a new version does not come back in a later copy", async () => {
            const old = await create("criterion", {settings: {function: "f", expertLevel: 2, subjective: true}});
            const edited = await newVersion("criterion", old, {settings: {function: "f"}});
            expect(edited.settings).toEqual({function: "f"});
            expect((await call(admin, "criterionGet", {criterionId: edited.id})).data.settings).toEqual({function: "f"});
            expect((await newVersion("criterion", edited)).settings).toEqual({function: "f"});
            expect((await newVersion("criterion", old, {settings: {}})).settings).toEqual({});
        });
    });

    describe("existing data stays readable", () => {
        test("a criterion written before this change is listed, found by id, in the history and the latest list", async () => {
            const {old, option} = await db.sequelize.transaction(async (transaction) => {
                const row = await db.models.criterion.create({versionNumber: "1.2", name: next(), description: "legacy", minPoints: 1, maxPoints: 3, settings: {function: "manual_grading", subjective: false, expertLevel: 1}}, {transaction});
                const created_option = await db.models.criterion_scoring_option.create({criterionId: row.id, points: 3, description: "top", position: 1}, {transaction});
                return {old: row, option: created_option};
            });
            created.criterion.push(old.id);
            expect(option.deleted).toBe(false);

            const fetched = (await call(admin, "criterionGet", {criterionId: old.id})).data;
            expect(fetched).toMatchObject({versionNumber: "1.2", minPoints: 1, maxPoints: 3, settings: {function: "manual_grading", subjective: false, expertLevel: 1}});
            expect(fetched.scoringOptions).toEqual([expect.objectContaining({points: 3, description: "top", position: 1, deleted: false})]);
            expect(await latestOf("criterion", old.criterionGroupId)).toMatchObject({id: old.id, versionNumber: "1.2", versionCount: 1});
            expect(numbers(await versionsOf("criterion", old.criterionGroupId))).toEqual(["1.2"]);
        });
    });
});
