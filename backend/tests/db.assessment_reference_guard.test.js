const assessmentReferences = require("../utils/helper/assessmentReferences.js");
const labels = require("../utils/helper/assessmentReferenceLabels.js");

/**
 * Database tests of the writer-side guard for assessment references (migration
 * 20261116120000-add-assessment-reference-guard.js): the SQL id extraction must agree with the JavaScript one and with
 * the jsonpath of the delete check, otherwise a writer could save a reference the delete does not see (or the other
 * way round). The concurrent delete / write scenarios are in socket.assessment.test.js.
 */
describe("Assessment reference guard (database)", () => {
    let db;
    const created = {assessment: [], study: [], study_step: []};
    let workflowStepId;

    const sqlIds = async (json) => (await db.sequelize.query(
        "SELECT id FROM assessment_json_reference_ids(CAST(:json AS jsonb)) AS t(id) ORDER BY id",
        {replacements: {json: JSON.stringify(json)}, type: db.sequelize.QueryTypes.SELECT})).map((row) => Number(row.id));

    beforeAll(async () => {
        db = require("../db/index.js");
        workflowStepId = (await db.sequelize.query("SELECT id FROM workflow_step ORDER BY id LIMIT 1", {type: db.sequelize.QueryTypes.SELECT}))[0].id;
    });

    afterAll(async () => {
        const remove = (sql, ids) => (ids.length ? db.sequelize.query(sql, {replacements: {ids}}) : null);
        await remove("DELETE FROM study_step WHERE id IN (:ids)", created.study_step);
        await remove("DELETE FROM study WHERE id IN (:ids)", created.study);
        for (const id of [...created.assessment].sort((a, b) => b - a)) {
            await db.models.assessment.destroy({where: {id}});
        }
    });

    const SHAPES = [
        [{settings: {assessmentId: 4}}, [4]],
        [{settings: {assessmentId: "5"}}, [5]],
        [{assessmentId: 6.0}, [6]],
        [{services: [{inputs: [{type: "assessment", assessmentId: 7}]}]}, [7]],
        [{m: {a: {table: "assessment", fileIds: [8, "9"]}}}, [8, 9]],
        [{m: {a: {table: "configuration", fileIds: [10]}}}, []],
        [{settings: {configurationId: 11}, configurationId: 12}, []],
        [{assessmentId: "007"}, []],
        [{assessmentId: "x"}, []],
        [{assessmentId: 0}, []],
        [{assessmentId: -3}, []],
        [{assessmentId: 1.5}, []],
        [{assessmentId: null}, []],
        [{assessmentId: {id: 3}}, []],
        [{assessmentId: [3]}, [3]],
        [{assessmentId: true}, []],
        [{a: {assessmentId: 2}, b: [{assessmentId: 1}, {assessmentId: 2}]}, [1, 2]],
        [[], []],
        [{}, []],
        [null, []],
    ];

    test.each(SHAPES)("the SQL extraction of %j agrees with the JavaScript one", async (json, expected) => {
        expect(await sqlIds(json)).toEqual(expected);
        // the JavaScript helper (writers) and the SQL function (guard) never disagree about a shape
        expect(assessmentReferences.collectAssessmentIds(json).sort((a, b) => a - b)).toEqual(expected);
    });

    test("everything the guard extracts is found by the delete check, and the other way round", async () => {
        const [row] = await db.sequelize.transaction(async (transaction) => [
            await db.models.assessment.create({versionNumber: "1", name: `guard-${Date.now()}`, description: ""}, {transaction}),
        ]);
        created.assessment.push(row.id);

        const configurations = [
            {settings: {assessmentId: row.id}},
            {settings: {assessmentId: String(row.id)}},
            {x: [{y: {assessmentId: row.id}}]},
            {m: {a: {table: "assessment", fileIds: [row.id]}}},
            {m: {a: {table: "assessment", fileIds: [String(row.id)]}}},
            {m: {a: {table: "configuration", fileIds: [row.id]}}},
            {settings: {configurationId: row.id}},
            {assessmentId: `0${row.id}`},
            {assessmentId: row.id + 0.5},
            {assessmentId: [row.id]},
            {assessmentId: [row.id, row.id]},
            {assessmentId: [[row.id]]},
        ];
        const [study] = await db.sequelize.query(
            'INSERT INTO study (name, hash, template, "createdAt", "updatedAt") VALUES (:name, :hash, false, now(), now()) RETURNING id',
            {replacements: {name: `guard-${Date.now()}`, hash: `guard-${Date.now()}`}, type: db.sequelize.QueryTypes.SELECT});
        created.study.push(study.id);

        for (const configuration of configurations) {
            // a step can only be saved when the guard saw the live version; the delete check then has to see it too
            const guardSees = (await sqlIds(configuration)).includes(row.id);
            const stepId = (await db.sequelize.query(
                `INSERT INTO study_step ("studyId", "workflowStepId", "stepType", configuration, "createdAt", "updatedAt")
                 VALUES (:studyId, :workflowStepId, 1, CAST(:configuration AS jsonb), now(), now()) RETURNING id`,
                {replacements: {studyId: study.id, workflowStepId, configuration: JSON.stringify(configuration)}, type: db.sequelize.QueryTypes.SELECT}))[0].id;
            created.study_step.push(stepId);

            const references = await db.sequelize.transaction((transaction) =>
                assessmentReferences.findAssessmentReferences(db.sequelize, row.id, transaction));
            const deleteSees = references.studySteps.includes(stepId);
            expect({configuration, deleteSees}).toEqual({configuration, deleteSees: guardSees});
            await db.sequelize.query("DELETE FROM study_step WHERE id = :stepId", {replacements: {stepId}});
        }
    });

    test("a missing version is refused with foreign_key_violation and a clear message", async () => {
        const [study] = await db.sequelize.query(
            'INSERT INTO study (name, hash, template, "createdAt", "updatedAt") VALUES (:name, :hash, false, now(), now()) RETURNING id',
            {replacements: {name: `guard2-${Date.now()}`, hash: `guard2-${Date.now()}`}, type: db.sequelize.QueryTypes.SELECT});
        created.study.push(study.id);
        const write = db.sequelize.query(
            `INSERT INTO study_step ("studyId", "workflowStepId", "stepType", configuration, "createdAt", "updatedAt")
             VALUES (:studyId, :workflowStepId, 1, CAST(:configuration AS jsonb), now(), now())`,
            {replacements: {studyId: study.id, workflowStepId, configuration: JSON.stringify({settings: {assessmentId: 2000000000}})}});
        await expect(write).rejects.toMatchObject({original: {code: "23503"}});
        await expect(write).rejects.toThrow(/Assessment version 2000000000 does not exist or was deleted, so study_step cannot reference it/);
    });

    describe("matrix: every holder x every operation x every shape, guard versus delete check", () => {
        const Q = () => db.sequelize.QueryTypes.SELECT;
        let live;
        let gone;
        let ctx;
        let studyId;

        beforeAll(async () => {
            const make = async (name) => {
                const row = await db.models.assessment.create({versionNumber: "1", name, description: ""});
                created.assessment.push(row.id);
                return row.id;
            };
            live = await make(`matrix-live-${Date.now()}`);
            gone = await make(`matrix-gone-${Date.now()}`);
            await db.sequelize.query("UPDATE assessment SET deleted = true WHERE id = :gone", {replacements: {gone}});
            const one = async (sql) => (await db.sequelize.query(sql, {type: Q()}))[0].id;
            ctx = {
                eventId: await one("SELECT id FROM trigger_event ORDER BY id LIMIT 1"),
                actionId: await one("SELECT id FROM trigger_action ORDER BY id LIMIT 1"),
                userId: await one('SELECT id FROM "user" ORDER BY id LIMIT 1'),
            };
            studyId = (await db.sequelize.query(
                'INSERT INTO study (name, hash, template, "createdAt", "updatedAt") VALUES (:name, :hash, false, now(), now()) RETURNING id',
                {replacements: {name: `matrix-${Date.now()}`, hash: `matrix-${Date.now()}`}, type: Q()}))[0].id;
            created.study.push(studyId);
        });

        const shapes = (id) => ({
            "settings.assessmentId": {settings: {assessmentId: id}},
            "string id": {settings: {assessmentId: String(id)}},
            "deep path": {services: [{inputs: [{type: "assessment", assessmentId: id}]}]},
            "table mapping": {m: {a: {table: "assessment", fileIds: [id]}}},
            "legacy configurationId": {settings: {configurationId: id}},
            "other table mapping": {m: {a: {table: "configuration", fileIds: [id]}}},
        });
        const RECOGNISED = new Set(["settings.assessmentId", "string id", "deep path", "table mapping"]);

        const newTrigger = async (tx) => (await db.sequelize.query(
            `INSERT INTO "trigger" (name, "userId", "triggerEventId", "triggerActionId", configuration)
             VALUES (:name, :userId, :eventId, :actionId, '{}') RETURNING id`,
            {replacements: {name: `m-${Date.now()}`, ...ctx}, transaction: tx, type: Q()}))[0].id;

        // how to insert a row with a configuration, where the delete check reports it, and the table to update
        const holders = {
            study_step: {
                key: "studySteps", table: "study_step",
                insert: async (tx, configuration) => (await db.sequelize.query(
                    `INSERT INTO study_step ("studyId", "workflowStepId", "stepType", configuration, "createdAt", "updatedAt")
                     VALUES (:studyId, :workflowStepId, 1, CAST(:configuration AS jsonb), now(), now()) RETURNING id`,
                    {replacements: {studyId, workflowStepId, configuration: JSON.stringify(configuration)}, transaction: tx, type: Q()}))[0].id,
            },
            trigger: {
                key: "triggers", table: "\"trigger\"",
                insert: async (tx, configuration) => (await db.sequelize.query(
                    `INSERT INTO "trigger" (name, "userId", "triggerEventId", "triggerActionId", configuration)
                     VALUES (:name, :userId, :eventId, :actionId, CAST(:configuration AS jsonb)) RETURNING id`,
                    {replacements: {name: `m-${Date.now()}`, ...ctx, configuration: JSON.stringify(configuration)}, transaction: tx, type: Q()}))[0].id,
            },
            trigger_action: {
                key: "triggerActions", table: "trigger_action",
                insert: async (tx, configuration) => (await db.sequelize.query(
                    "INSERT INTO trigger_action (name, configuration) VALUES (:name, CAST(:configuration AS jsonb)) RETURNING id",
                    {replacements: {name: `m-${Date.now()}`, configuration: JSON.stringify(configuration)}, transaction: tx, type: Q()}))[0].id,
            },
            trigger_queue: {
                key: "queuedRuns", table: "trigger_queue",
                insert: async (tx, configuration) => (await db.sequelize.query(
                    'INSERT INTO trigger_queue ("triggerId", status, configuration) VALUES (:triggerId, 0, CAST(:configuration AS jsonb)) RETURNING id',
                    {replacements: {triggerId: await newTrigger(tx), configuration: JSON.stringify(configuration)}, transaction: tx, type: Q()}))[0].id,
            },
        };

        /** runs fn in a transaction that is always rolled back; resolves with its result or the refusal */
        const attempt = async (fn) => {
            const tx = await db.sequelize.transaction();
            try {
                return {value: await fn(tx)};
            } catch (error) {
                return {error};
            } finally {
                await tx.rollback();
            }
        };
        const setConfiguration = (def, tx, id, configuration) => db.sequelize.query(
            `UPDATE ${def.table} SET configuration = CAST(:configuration AS jsonb) WHERE id = :id`,
            {replacements: {configuration: JSON.stringify(configuration), id}, transaction: tx});
        const seenByDelete = async (def, tx, id) => (await assessmentReferences.findAssessmentReferences(db.sequelize, live, tx))[def.key].includes(id);

        for (const [holder, def] of Object.entries(holders)) {
            test(`${holder}: INSERT and UPDATE of a reference agree with the delete check for every shape`, async () => {
                for (const [label, configuration] of Object.entries(shapes(live))) {
                    // live version: the write goes through, and the delete check sees exactly the recognised shapes
                    const inserted = await attempt(async (tx) => seenByDelete(def, tx, await def.insert(tx, configuration)));
                    expect({holder, label, error: inserted.error?.message}).toEqual({holder, label, error: undefined});
                    expect({holder, label, seen: inserted.value}).toEqual({holder, label, seen: RECOGNISED.has(label)});

                    // an UPDATE that introduces the reference behaves like the INSERT
                    const updated = await attempt(async (tx) => {
                        const id = await def.insert(tx, {});
                        await setConfiguration(def, tx, id, configuration);
                        return seenByDelete(def, tx, id);
                    });
                    expect({holder, label, error: updated.error?.message}).toEqual({holder, label, error: undefined});
                    expect({holder, label, seen: updated.value}).toEqual({holder, label, seen: RECOGNISED.has(label)});
                }
                for (const [label, configuration] of Object.entries(shapes(gone))) {
                    // deleted version: exactly the recognised shapes are refused, on INSERT and on UPDATE
                    const inserted = await attempt((tx) => def.insert(tx, configuration));
                    expect({holder, label, refused: Boolean(inserted.error)}).toEqual({holder, label, refused: RECOGNISED.has(label)});
                    if (inserted.error) {
                        expect(inserted.error.original.code).toBe("23503");
                    }
                    const updated = await attempt(async (tx) => setConfiguration(def, tx, await def.insert(tx, {}), configuration));
                    expect({holder, label, refused: Boolean(updated.error)}).toEqual({holder, label, refused: RECOGNISED.has(label)});
                }
            });
        }
    });

    describe("message helpers", () => {
        test("names are cleaned, shortened and joined; a long list is cut", () => {
            expect(labels.cleanName("  a \n\t b\u0000c  ")).toBe("a b c");
            expect(labels.cleanName("x".repeat(80))).toHaveLength(60);
            expect(labels.cleanName(null)).toBe("");
            expect(labels.joinEntries([])).toBe("-");
            expect(labels.joinEntries(["1", "2", "3", "4", "5"])).toBe("1, 2, 3, 4, 5");
            expect(labels.joinEntries(["1", "2", "3", "4", "5", "6", "7"])).toBe("1, 2, 3, 4, 5, … (+2)");
        });

        test("version entries show the group only when equal names would be ambiguous", () => {
            expect(labels.versionEntries([
                {name: "A", versionNumber: "1", groupId: 1},
                {name: "A", versionNumber: "2", groupId: 1},
                {name: "B", versionNumber: "1", groupId: 2},
            ])).toEqual(["'A' (v1)", "'A' (v2)", "'B' (v1)"]);
            expect(labels.versionEntries([
                {name: "A", versionNumber: "1", groupId: 1},
                {name: "A", versionNumber: "1", groupId: 7},
            ])).toEqual(["'A' (v1, #1)", "'A' (v1, #7)"]);
        });

        test("parameters carry names and version numbers, never ids", () => {
            expect(labels.inUseParams({name: "C", versionNumber: "3", id: 99}, [{name: "R", versionNumber: "1", groupId: 5, id: 77}]))
                .toEqual({name: "C", version: "3", count: 1, references: "'R' (v1)"});
        });
    });
});
