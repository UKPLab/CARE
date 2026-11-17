const db = require("../db/index.js");
const {ForeignKeyConstraintError, DatabaseError} = require("sequelize");

/**
 * Lifecycle tests for the six versioned assessment tables on a real PostgreSQL database: soft-delete columns,
 * content immutability with allowed lifecycle updates, soft deletion of versions and their children, reference
 * protection (and the races around it) and the assessment predecessor chain.
 * They talk to the models and to SQL directly, no server or sockets involved.
 */
describe("Assessment versioning lifecycle", () => {
    const {assessment, rubric, criterion, assessment_rubric, rubric_criterion, criterion_scoring_option} = db.models;
    const {QueryTypes} = db.sequelize;
    const created = {assessment: [], rubric: [], criterion: []};

    const tag = `t${Date.now()}`;
    let counter = 0;
    const next = () => `${tag}-${++counter}`;
    const tx = (work) => db.sequelize.transaction(work);
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const select = (sql, replacements, transaction) =>
        db.sequelize.query(sql, {replacements, transaction, type: QueryTypes.SELECT});
    // resolves true when the promise has not settled after a moment (it waits for a lock)
    const waits = (promise) => Promise.race([promise.then(() => false, () => false), sleep(400).then(() => true)]);

    const latestLive = async (group, transaction) =>
        (await select('SELECT MAX(id) AS "latest" FROM assessment WHERE "assessmentGroupId" = :group AND deleted = false', {group}, transaction))[0].latest;

    /** A new assessment version; a version of an existing group points at the group's latest live version. */
    const newAssessment = async (data = {}, transaction) => {
        const previous = data.assessmentGroupId ? await latestLive(data.assessmentGroupId, transaction) : null;
        const row = await assessment.create(
            {versionNumber: "1", name: next(), description: "", previousAssessmentVersionId: previous, ...data}, {transaction});
        created.assessment.push(row.id);
        return row;
    };
    const newRubric = async (data = {}, transaction) => {
        const row = await rubric.create({versionNumber: "1", name: next(), description: "", minPoints: 0, maxPoints: 4, ...data}, {transaction});
        created.rubric.push(row.id);
        return row;
    };
    const newCriterion = async (data = {}, transaction) => {
        const row = await criterion.create({versionNumber: "1", name: next(), description: "", ...data}, {transaction});
        created.criterion.push(row.id);
        return row;
    };
    const linkRubric = (assessmentId, rubricId, position, transaction) =>
        assessment_rubric.create({assessmentId, rubricId, rubricPositionInAssessment: position}, {transaction});
    const linkCriterion = (rubricId, criterionId, position, transaction) =>
        rubric_criterion.create({rubricId, criterionId, criterionPositionInRubric: position}, {transaction});
    const addOption = (criterionId, points, position, transaction) =>
        criterion_scoring_option.create({criterionId, points, description: `option ${points}`, position}, {transaction});
    const softDelete = (model, id, transaction) => model.update({deleted: true, deletedAt: new Date()}, {where: {id}, transaction});

    /** A chain of n live versions of one new assessment group, one transaction each. */
    const newChain = async (n) => {
        const first = await newAssessment({versionNumber: "1"});
        const chain = [first];
        for (let i = 2; i <= n; i++) {
            chain.push(await newAssessment({versionNumber: String(i), assessmentGroupId: first.assessmentGroupId}));
        }
        return chain;
    };
    const rowOf = (id) => assessment.getById(id, {}, true);
    const previousOf = async (id) => (await rowOf(id)).previousAssessmentVersionId;
    /** Invariant: every live version points at the live version just before it (NULL for the first). */
    const expectChainValid = async (group) => {
        const live = await select('SELECT id, "previousAssessmentVersionId" AS prev FROM assessment WHERE "assessmentGroupId" = :group AND deleted = false ORDER BY id', {group});
        live.forEach((row, index) => expect(row.prev).toBe(index === 0 ? null : live[index - 1].id));
        return live.map((row) => row.id);
    };

    afterAll(async () => {
        for (const id of [...created.assessment].sort((a, b) => b - a)) {
            await assessment.destroy({where: {id}});
        }
        await rubric.destroy({where: {id: created.rubric}});
        await criterion.destroy({where: {id: created.criterion}});
        await db.sequelize.close();
    });

    describe("lifecycle columns", () => {
        test.each([
            ["assessment", () => assessment],
            ["rubric", () => rubric],
            ["criterion", () => criterion],
            ["assessment_rubric", () => assessment_rubric],
            ["rubric_criterion", () => rubric_criterion],
            ["criterion_scoring_option", () => criterion_scoring_option],
        ])("%s has deleted, deletedAt, createdAt and updatedAt with the CARE defaults", async (table) => {
            const columns = await db.sequelize.getQueryInterface().describeTable(table);
            expect(columns.deleted).toMatchObject({type: "BOOLEAN", allowNull: false, defaultValue: false});
            expect(columns.deletedAt).toMatchObject({allowNull: true});
            expect(columns.createdAt).toMatchObject({allowNull: false});
            expect(columns.updatedAt).toMatchObject({allowNull: false});
        });

        test("a new row is live, has no deletion time and has both timestamps", async () => {
            const {parent, link, occurrence, option} = await tx(async (t) => {
                const parent = await newAssessment({}, t);
                const middle = await newRubric({}, t);
                const leaf = await newCriterion({}, t);
                return {
                    parent,
                    link: await linkRubric(parent.id, middle.id, 1, t),
                    occurrence: await linkCriterion(middle.id, leaf.id, 1, t),
                    option: await addOption(leaf.id, 1, 1, t),
                };
            });
            for (const row of [parent, link, occurrence, option]) {
                const fresh = await row.constructor.getById(row.id);
                expect(fresh.deleted).toBe(false);
                expect(fresh.deletedAt).toBeNull();
                expect(fresh.createdAt).toBeInstanceOf(Date);
                expect(fresh.updatedAt).toBeInstanceOf(Date);
            }
        });

        test("rubric and criterion have a settings object that defaults to {}; the other tables have none", async () => {
            expect((await newRubric()).settings).toEqual({});
            expect((await newCriterion()).settings).toEqual({});
            for (const table of ["assessment", "assessment_rubric", "rubric_criterion", "criterion_scoring_option"]) {
                expect(Object.keys(await db.sequelize.getQueryInterface().describeTable(table))).not.toContain("settings");
            }
        });
    });

    describe("content immutability and the allowed lifecycle updates", () => {
        test.each([
            ["assessment", newAssessment, {name: "changed"}],
            ["assessment", newAssessment, {versionNumber: "9"}],
            ["rubric", newRubric, {name: "changed"}],
            ["rubric", newRubric, {minPoints: 1}],
            ["rubric", newRubric, {settings: {a: 1}}],
            ["criterion", newCriterion, {description: "changed"}],
            ["criterion", newCriterion, {settings: {expertLevel: 2}}],
            ["criterion", newCriterion, {name: "changed"}],
        ])("%s: changing %j is rejected, also mixed with a lifecycle change", async (table, create, change) => {
            const row = await create();
            const model = db.models[table];
            await expect(model.update(change, {where: {id: row.id}})).rejects.toThrow(/immutable/);
            await expect(model.update({...change, deleted: true}, {where: {id: row.id}})).rejects.toThrow(/immutable/);
            await expect(db.sequelize.query(`UPDATE "${table}" SET "createdAt" = now() WHERE id = ${row.id}`)).rejects.toThrow(/immutable/);
            expect((await model.getById(row.id)).deleted).toBe(false);
        });

        test("lifecycle columns can change: updatedAt always, deleted and deletedAt together", async () => {
            const row = await newRubric();
            const later = new Date(Date.now() + 60000);
            await db.sequelize.query(`UPDATE rubric SET "updatedAt" = :later WHERE id = ${row.id}`, {replacements: {later}});
            expect((await rubric.getById(row.id)).updatedAt.getTime()).toBe(later.getTime());

            await softDelete(rubric, row.id);
            const kept = await rubric.getById(row.id, {}, true);
            expect(kept.deleted).toBe(true);
            expect(kept.deletedAt).toBeInstanceOf(Date);
            // content survived untouched
            expect({name: kept.name, versionNumber: kept.versionNumber, minPoints: kept.minPoints}).toEqual({name: row.name, versionNumber: "1", minPoints: "0"});
        });

        test("the database fills deletedAt when deleted is set without it", async () => {
            const row = await newCriterion();
            await db.sequelize.query(`UPDATE criterion SET deleted = true WHERE id = ${row.id}`);
            expect((await criterion.getById(row.id, {}, true)).deletedAt).toBeInstanceOf(Date);
        });

        test("the lifecycle is one-way: no restore, no change of the deletion time, no deletion time on a live row", async () => {
            const row = await newCriterion();
            await expect(criterion.update({deletedAt: new Date()}, {where: {id: row.id}})).rejects.toThrow(/only set on deleted/);
            await softDelete(criterion, row.id);
            await expect(criterion.update({deleted: false}, {where: {id: row.id}})).rejects.toThrow(/cannot be restored/);
            await expect(criterion.update({deleted: false, deletedAt: null}, {where: {id: row.id}})).rejects.toThrow(/cannot be restored/);
            await expect(criterion.update({deletedAt: new Date(0)}, {where: {id: row.id}})).rejects.toThrow(/cannot change/);
            expect((await criterion.getById(row.id, {}, true)).deleted).toBe(true);
        });
    });

    describe("soft deletion keeps history", () => {
        test("deleting a criterion version flags its options but keeps every value", async () => {
            const leaf = await tx(async (t) => {
                const row = await newCriterion({minPoints: -1, maxPoints: 2}, t);
                await addOption(row.id, -1, 1, t);
                await addOption(row.id, 0.5, 2, t);
                await addOption(row.id, 2, 3, t);
                return row;
            });
            await softDelete(criterion, leaf.id);

            const options = await criterion_scoring_option.findAll({where: {criterionId: leaf.id}, order: [["position", "ASC"]]});
            expect(options.map((o) => [o.position, Number(o.points), o.description, o.deleted])).toEqual([
                [1, -1, "option -1", true], [2, 0.5, "option 0.5", true], [3, 2, "option 2", true],
            ]);
            expect(options.every((o) => o.deletedAt instanceof Date)).toBe(true);
            // hidden from the default reads
            expect(await criterion.getById(leaf.id)).toBeNull();
            expect(await criterion_scoring_option.getAllByKey("criterionId", leaf.id)).toHaveLength(0);
        });

        test("deleting a rubric version flags its links, deleting an assessment version flags its rubric links", async () => {
            const {parent, middle, leaf} = await tx(async (t) => {
                const parent = await newAssessment({}, t);
                const middle = await newRubric({}, t);
                const leaf = await newCriterion({}, t);
                await linkRubric(parent.id, middle.id, 1, t);
                await linkCriterion(middle.id, leaf.id, 1, t);
                return {parent, middle, leaf};
            });
            await softDelete(assessment, parent.id);
            expect(await assessment_rubric.count({where: {assessmentId: parent.id, deleted: true}})).toBe(1);
            // the rubric is free now, and its own links follow when it is deleted
            await softDelete(rubric, middle.id);
            expect(await rubric_criterion.count({where: {rubricId: middle.id, deleted: true}})).toBe(1);
            await softDelete(criterion, leaf.id);
            expect((await criterion.getById(leaf.id, {}, true)).deleted).toBe(true);
        });

        test("only the children of the deleted version are flagged, other versions keep theirs", async () => {
            const leaf = await newCriterion();
            const [first, second] = await tx(async (t) => {
                const a = await newRubric({versionNumber: "1"}, t);
                const b = await newRubric({versionNumber: "2", rubricGroupId: a.rubricGroupId}, t);
                await linkCriterion(a.id, leaf.id, 1, t);
                await linkCriterion(b.id, leaf.id, 1, t);
                return [a, b];
            });
            await softDelete(rubric, first.id);
            expect(await rubric_criterion.count({where: {rubricId: first.id, deleted: true}})).toBe(1);
            expect(await rubric_criterion.count({where: {rubricId: second.id, deleted: false}})).toBe(1);
        });

        test("a single link or option row cannot be flagged on its own", async () => {
            const {link, occurrence, option} = await tx(async (t) => {
                const parent = await newAssessment({}, t);
                const middle = await newRubric({}, t);
                const leaf = await newCriterion({}, t);
                return {
                    link: await linkRubric(parent.id, middle.id, 1, t),
                    occurrence: await linkCriterion(middle.id, leaf.id, 1, t),
                    option: await addOption(leaf.id, 1, 1, t),
                };
            });
            for (const [model, row] of [[assessment_rubric, link], [rubric_criterion, occurrence], [criterion_scoring_option, option]]) {
                await expect(model.update({deleted: true}, {where: {id: row.id}})).rejects.toThrow(/together with their version/);
                await expect(db.sequelize.query(`UPDATE "${model.tableName}" SET deleted = true WHERE id = ${row.id}`)).rejects.toThrow(/together with their version/);
                expect((await model.getById(row.id)).deleted).toBe(false);
            }
        });

        test("rows cannot be added to a deleted version", async () => {
            const {leaf, middle, top} = await tx(async (t) => {
                const leaf = await newCriterion({}, t);
                const middle = await newRubric({}, t);
                const top = await newAssessment({}, t);
                return {leaf, middle, top};
            });
            const otherCriterion = await newCriterion();
            const otherRubric = await newRubric();
            await softDelete(criterion, leaf.id);
            await softDelete(rubric, middle.id);
            await softDelete(assessment, top.id);
            await expect(tx((t) => addOption(leaf.id, 1, 1, t))).rejects.toThrow(/deleted version|while the version is created/);
            await expect(tx((t) => linkCriterion(middle.id, otherCriterion.id, 1, t))).rejects.toThrow(/deleted version|while the version is created/);
            await expect(tx((t) => linkRubric(top.id, otherRubric.id, 1, t))).rejects.toThrow(/deleted version|while the version is created/);
        });

        test("a version deleted inside the transaction that created it still takes no more rows afterwards", async () => {
            await expect(tx(async (t) => {
                const leaf = await newCriterion({}, t);
                await softDelete(criterion, leaf.id, t);
                await addOption(leaf.id, 1, 1, t);
            })).rejects.toThrow(/deleted version/);
        });
    });

    describe("rows can only be added to a version created in the same transaction", () => {
        const refused = /while the version is created/;
        /** One committed version of each kind, and one more committed target of each kind to link to. */
        const committed = async () => tx(async (t) => ({
            leaf: await newCriterion({}, t), middle: await newRubric({}, t), top: await newAssessment({}, t),
            otherCriterion: await newCriterion({}, t), otherRubric: await newRubric({}, t),
        }));
        const lateInserts = (c, t) => [
            ["criterion_scoring_option", () => addOption(c.leaf.id, 1, 1, t)],
            ["rubric_criterion", () => linkCriterion(c.middle.id, c.otherCriterion.id, 1, t)],
            ["assessment_rubric", () => linkRubric(c.top.id, c.otherRubric.id, 1, t)],
        ];
        const parentTable = {criterion_scoring_option: "criterion", rubric_criterion: "rubric", assessment_rubric: "assessment"};
        const parentId = (c) => ({criterion_scoring_option: c.leaf.id, rubric_criterion: c.middle.id, assessment_rubric: c.top.id});

        test("a committed version takes no more rows: options, criterion links and rubric links", async () => {
            const c = await committed();
            for (let index = 0; index < 3; index++) {
                await expect(tx((t) => lateInserts(c, t)[index][1]())).rejects.toThrow(refused);
            }
            expect(await select("SELECT count(*)::int AS n FROM criterion_scoring_option WHERE \"criterionId\" = :id", {id: c.leaf.id})).toEqual([{n: 0}]);
        });

        test.each([
            ["a lifecycle update of updatedAt", (table, id) => `UPDATE "${table}" SET "updatedAt" = now() WHERE id = ${id}`],
            ["an update that changes nothing", (table, id) => `UPDATE "${table}" SET "updatedAt" = "updatedAt" WHERE id = ${id}`],
            ["a row lock FOR UPDATE", (table, id) => `SELECT 1 FROM "${table}" WHERE id = ${id} FOR UPDATE`],
            ["a row lock FOR NO KEY UPDATE", (table, id) => `SELECT 1 FROM "${table}" WHERE id = ${id} FOR NO KEY UPDATE`],
            ["a row lock FOR SHARE", (table, id) => `SELECT 1 FROM "${table}" WHERE id = ${id} FOR SHARE`],
        ])("touching the committed parent first (%s) does not reopen it, for every child table", async (_label, statement) => {
            const c = await committed();
            for (let index = 0; index < 3; index++) {
                // the same transaction first touches the parent (its xmin changes with an UPDATE), then inserts
                await expect(tx(async (t) => {
                    const [name, insert] = lateInserts(c, t)[index];
                    await db.sequelize.query(statement(parentTable[name], parentId(c)[name]), {transaction: t});
                    await insert();
                })).rejects.toThrow(refused);
            }
        });

        test("touching the parent in a transaction that has more steps in between (savepoint, several updates) still refuses", async () => {
            const c = await committed();
            await expect(tx(async (t) => {
                await db.sequelize.query(`UPDATE "criterion" SET "updatedAt" = now() WHERE id = ${c.leaf.id}`, {transaction: t});
                await db.sequelize.query("SAVEPOINT touched", {transaction: t});
                await db.sequelize.query(`UPDATE "criterion" SET "updatedAt" = now() WHERE id = ${c.leaf.id}`, {transaction: t});
                await db.sequelize.query("RELEASE SAVEPOINT touched", {transaction: t});
                await addOption(c.leaf.id, 1, 1, t);
            })).rejects.toThrow(refused);
        });

        test("the re-linking of an assessment's successor by a soft delete does not reopen the successor", async () => {
            const [v1, v2] = await newChain(2);
            const rubricToLink = await newRubric();
            await expect(tx(async (t) => {
                await softDelete(assessment, v1.id, t);           // the trigger re-links v2: v2 gets a new row version
                const [relinked] = await select('SELECT "previousAssessmentVersionId" AS prev FROM assessment WHERE id = :id', {id: v2.id}, t);
                expect(relinked.prev).toBeNull();                 // visible inside this transaction only
                await linkRubric(v2.id, rubricToLink.id, 1, t);   // ... but it is still a committed version
            })).rejects.toThrow(refused);
            expect(await select('SELECT count(*)::int AS n FROM assessment_rubric WHERE "assessmentId" = :id', {id: v2.id})).toEqual([{n: 0}]);
        });

        test("the registration is per table: a criterion created here does not open a rubric of the same id", async () => {
            const c = await committed();
            await expect(tx(async (t) => {
                await db.sequelize.query("SELECT set_config('assessment_versioning.created_criterion', :value, true)", {replacements: {value: `|${c.middle.id}|`}, transaction: t});
                await linkCriterion(c.middle.id, c.otherCriterion.id, 1, t);
            })).rejects.toThrow(refused);
        });

        test("a transaction does not carry its registrations to the next one on the same connection", async () => {
            for (let round = 0; round < 4; round++) {
                const c = await tx(async (t) => {
                    const leaf = await newCriterion({}, t);
                    await addOption(leaf.id, 1, 1, t);
                    return {leaf};
                });
                await expect(tx((t) => addOption(c.leaf.id, 2, 2, t))).rejects.toThrow(refused);
            }
        });

        test("creating a version works: the version and all its rows in one transaction, in any order of statements", async () => {
            const {leaf, middle, top, second} = await tx(async (t) => {
                const otherLeaf = await newCriterion({}, t);
                const leaf = await newCriterion({}, t);
                const middle = await newRubric({}, t);
                const top = await newAssessment({}, t);
                await addOption(leaf.id, 1, 1, t);
                await linkCriterion(middle.id, leaf.id, 1, t);
                await linkRubric(top.id, middle.id, 1, t);
                // the rows of several versions of the same kind, interleaved
                await criterion_scoring_option.bulkCreate([
                    {criterionId: leaf.id, points: 2, description: "two", position: 2},
                    {criterionId: otherLeaf.id, points: 1, description: "one", position: 1},
                    {criterionId: leaf.id, points: 3, description: "three", position: 3},
                ], {transaction: t});
                await linkCriterion(middle.id, otherLeaf.id, 2, t);
                return {leaf, middle, top, second: otherLeaf};
            });
            expect(await select('SELECT count(*)::int AS n FROM criterion_scoring_option WHERE "criterionId" = :id', {id: leaf.id})).toEqual([{n: 3}]);
            expect(await select('SELECT count(*)::int AS n FROM criterion_scoring_option WHERE "criterionId" = :id', {id: second.id})).toEqual([{n: 1}]);
            expect(await select('SELECT count(*)::int AS n FROM rubric_criterion WHERE "rubricId" = :id', {id: middle.id})).toEqual([{n: 2}]);
            expect(await select('SELECT count(*)::int AS n FROM assessment_rubric WHERE "assessmentId" = :id', {id: top.id})).toEqual([{n: 1}]);
        });

        test("touching the version after creating it in the same transaction is fine; rows can still be added until it commits", async () => {
            const {leaf, middle} = await tx(async (t) => {
                const leaf = await newCriterion({}, t);
                const middle = await newRubric({}, t);
                await db.sequelize.query(`UPDATE "criterion" SET "updatedAt" = now() WHERE id = ${leaf.id}`, {transaction: t});
                await db.sequelize.query(`UPDATE "rubric" SET "updatedAt" = now() WHERE id = ${middle.id}`, {transaction: t});
                await addOption(leaf.id, 1, 1, t);
                await linkCriterion(middle.id, leaf.id, 1, t);
                return {leaf, middle};
            });
            expect(await select('SELECT count(*)::int AS n FROM criterion_scoring_option WHERE "criterionId" = :id', {id: leaf.id})).toEqual([{n: 1}]);
            expect(await select('SELECT count(*)::int AS n FROM rubric_criterion WHERE "rubricId" = :id', {id: middle.id})).toEqual([{n: 1}]);
        });

        test("after a rollback to a savepoint the outer version is still registered and takes its rows", async () => {
            const leaf = await tx(async (t) => {
                const outer = await newCriterion({}, t);
                await db.sequelize.query("SAVEPOINT s", {transaction: t});
                await newCriterion({}, t);
                await db.sequelize.query("ROLLBACK TO SAVEPOINT s", {transaction: t});
                await addOption(outer.id, 1, 1, t);
                return outer;
            });
            expect(await select('SELECT count(*)::int AS n FROM criterion_scoring_option WHERE "criterionId" = :id', {id: leaf.id})).toEqual([{n: 1}]);
        });
    });

    describe("reference protection", () => {
        test("a rubric version used by a live assessment cannot be soft-deleted, even with raw SQL; it can once the assessment is deleted", async () => {
            const used = await newRubric();
            const user = await tx(async (t) => {
                const parent = await newAssessment({}, t);
                await linkRubric(parent.id, used.id, 1, t);
                return parent;
            });

            await expect(softDelete(rubric, used.id)).rejects.toBeInstanceOf(ForeignKeyConstraintError);
            await expect(db.sequelize.query(`UPDATE rubric SET deleted = true WHERE id = ${used.id}`)).rejects.toThrow(/still referenced/);
            expect((await rubric.getById(used.id)).deleted).toBe(false);

            await softDelete(assessment, user.id);
            await expect(softDelete(rubric, used.id)).resolves.toBeDefined();
        });

        test("a criterion version used by a live rubric cannot be soft-deleted; it can once the rubric is deleted", async () => {
            const used = await newCriterion();
            const user = await tx(async (t) => {
                const parent = await newRubric({}, t);
                await linkCriterion(parent.id, used.id, 1, t);
                return parent;
            });
            await expect(softDelete(criterion, used.id)).rejects.toBeInstanceOf(ForeignKeyConstraintError);
            await softDelete(rubric, user.id);
            await expect(softDelete(criterion, used.id)).resolves.toBeDefined();
        });

        test("a link to a deleted rubric or criterion version is refused", async () => {
            const gone = await newRubric();
            const goneLeaf = await newCriterion();
            await softDelete(rubric, gone.id);
            await softDelete(criterion, goneLeaf.id);
            await expect(tx(async (t) => linkRubric((await newAssessment({}, t)).id, gone.id, 1, t))).rejects.toBeInstanceOf(ForeignKeyConstraintError);
            await expect(tx(async (t) => linkCriterion((await newRubric({}, t)).id, goneLeaf.id, 1, t))).rejects.toBeInstanceOf(ForeignKeyConstraintError);
        });

        test("a hard delete of a referenced version is still stopped by the foreign key (administrator path)", async () => {
            const used = await newRubric();
            await tx(async (t) => linkRubric((await newAssessment({}, t)).id, used.id, 1, t));
            await expect(rubric.destroy({where: {id: used.id}})).rejects.toThrow(/violates RESTRICT setting of foreign key/);
        });

        describe("races between a delete and a new reference", () => {
            test("the reference is written first: the delete waits for it, then sees it and fails", async () => {
                const target = await newRubric();
                const writer = await db.sequelize.transaction();
                const deleter = await db.sequelize.transaction();
                try {
                    const parent = await newAssessment({}, writer);
                    await linkRubric(parent.id, target.id, 1, writer);        // holds a key-share lock on the rubric

                    const deleting = softDelete(rubric, target.id, deleter).then(() => "deleted", (error) => error);
                    expect(await waits(deleting)).toBe(true);                // waiting for the writer

                    await writer.commit();
                    expect(await deleting).toBeInstanceOf(ForeignKeyConstraintError);
                } finally {
                    await deleter.rollback();
                    await writer.rollback().catch(() => {});
                }
                expect((await rubric.getById(target.id)).deleted).toBe(false);
                expect(await assessment_rubric.count({where: {rubricId: target.id, deleted: false}})).toBe(1);
            });

            test("the delete runs first: the writer waits for it, then finds the version deleted and fails", async () => {
                const target = await newRubric();
                const deleter = await db.sequelize.transaction();
                const writer = await db.sequelize.transaction();
                try {
                    await softDelete(rubric, target.id, deleter);            // holds the row, nothing references it yet

                    const linking = (async () => {
                        const parent = await newAssessment({}, writer);
                        await linkRubric(parent.id, target.id, 1, writer);
                    })().then(() => "linked", (error) => error);
                    expect(await waits(linking)).toBe(true);                 // waiting for the delete

                    await deleter.commit();
                    expect(await linking).toBeInstanceOf(ForeignKeyConstraintError);
                } finally {
                    await writer.rollback();
                    await deleter.rollback().catch(() => {});
                }
                expect(await assessment_rubric.count({where: {rubricId: target.id}})).toBe(0);
                expect((await rubric.getById(target.id, {}, true)).deleted).toBe(true);
            });

            test("the same holds for a criterion version and its rubric links", async () => {
                const target = await newCriterion();
                const writer = await db.sequelize.transaction();
                const deleter = await db.sequelize.transaction();
                try {
                    const parent = await newRubric({}, writer);
                    await linkCriterion(parent.id, target.id, 1, writer);
                    const deleting = softDelete(criterion, target.id, deleter).then(() => "deleted", (error) => error);
                    expect(await waits(deleting)).toBe(true);
                    await writer.commit();
                    expect(await deleting).toBeInstanceOf(ForeignKeyConstraintError);
                } finally {
                    await deleter.rollback();
                    await writer.rollback().catch(() => {});
                }
                expect((await criterion.getById(target.id)).deleted).toBe(false);
            });
        });
    });

    describe("assessment predecessor chain", () => {
        test("the first version has no predecessor and every new version points at the latest live one", async () => {
            const [v1, v2, v3] = await newChain(3);
            expect(v1.previousAssessmentVersionId).toBeNull();
            expect(await previousOf(v2.id)).toBe(v1.id);
            expect(await previousOf(v3.id)).toBe(v2.id);
            await expectChainValid(v1.assessmentGroupId);
        });

        test("a chain never crosses groups", async () => {
            const [a1, a2] = await newChain(2);
            const [b1, b2] = await newChain(2);
            expect(await previousOf(a2.id)).toBe(a1.id);
            expect(await previousOf(b2.id)).toBe(b1.id);
            expect(b1.previousAssessmentVersionId).toBeNull();
            // a version cannot point into another group
            await expect(newAssessment({assessmentGroupId: a1.assessmentGroupId, previousAssessmentVersionId: b2.id})).rejects.toThrow(/latest active version of its group/);
        });

        test("a new version must point at the latest live version of its group, nothing else", async () => {
            const [v1, v2, v3] = await newChain(3);
            const group = v1.assessmentGroupId;
            for (const previous of [null, v1.id, v2.id, 2147483000]) {
                await expect(newAssessment({versionNumber: "9", assessmentGroupId: group, previousAssessmentVersionId: previous}))
                    .rejects.toThrow(/latest active version of its group|foreign key/i);
            }
            const ok = await newAssessment({versionNumber: "4", assessmentGroupId: group, previousAssessmentVersionId: v3.id});
            expect(ok.previousAssessmentVersionId).toBe(v3.id);
            await expectChainValid(group);
        });

        test("a deleted version cannot be a predecessor", async () => {
            const [v1, v2] = await newChain(2);
            await softDelete(assessment, v2.id);
            await expect(newAssessment({versionNumber: "3", assessmentGroupId: v1.assessmentGroupId, previousAssessmentVersionId: v2.id}))
                .rejects.toThrow(/latest active version of its group/);
        });

        test("the link of an existing version cannot be altered: no skipping, no other group, no self, no NULL, no later version", async () => {
            const [v1, v2, v3, v4] = await newChain(4);
            const [other] = await newChain(1);
            const attempts = [
                [v4.id, v2.id],      // skips the active version v3
                [v3.id, v1.id],      // skips the active version v2
                [v2.id, null],       // makes a second "first" version
                [v3.id, v3.id],      // itself
                [v2.id, v3.id],      // a later version (cycle)
                [v3.id, other.id],   // another group
                [v3.id, 2147483000], // nothing
            ];
            for (const [id, previous] of attempts) {
                await expect(assessment.update({previousAssessmentVersionId: previous}, {where: {id}}))
                    .rejects.toThrow(/active version just before it|foreign key/i);
                await expect(db.sequelize.query(`UPDATE assessment SET "previousAssessmentVersionId" = ${previous} WHERE id = ${id}`))
                    .rejects.toThrow(/active version just before it|foreign key/i);
            }
            await expectChainValid(v1.assessmentGroupId);
            // setting it to what it already is is harmless
            await expect(assessment.update({previousAssessmentVersionId: v3.id}, {where: {id: v4.id}})).resolves.toBeDefined();
        });

        test("the link of a deleted version is kept as history and cannot be changed", async () => {
            const [v1, v2, v3] = await newChain(3);
            await softDelete(assessment, v2.id);
            expect(await previousOf(v2.id)).toBe(v1.id);
            await expect(assessment.update({previousAssessmentVersionId: null}, {where: {id: v2.id}})).rejects.toThrow(/kept as history/);
            expect(await previousOf(v3.id)).toBe(v1.id);
        });

        describe("soft deletion re-links the chain in the same transaction", () => {
            test("an intermediate version: V1 <- V2 <- V3 <- V4 becomes V1 <- V3 <- V4", async () => {
                const [v1, v2, v3, v4] = await newChain(4);
                await softDelete(assessment, v2.id);

                expect(await previousOf(v3.id)).toBe(v1.id);
                expect(await previousOf(v4.id)).toBe(v3.id);
                expect(await previousOf(v1.id)).toBeNull();
                const deleted = await rowOf(v2.id);
                expect(deleted.deleted).toBe(true);
                expect(deleted.deletedAt).toBeInstanceOf(Date);
                expect(deleted.previousAssessmentVersionId).toBe(v1.id);   // audit: where it used to sit
                expect(await expectChainValid(v1.assessmentGroupId)).toEqual([v1.id, v3.id, v4.id]);
            });

            test("the oldest version: its successor becomes the first", async () => {
                const [v1, v2, v3] = await newChain(3);
                await softDelete(assessment, v1.id);
                expect(await previousOf(v2.id)).toBeNull();
                expect(await previousOf(v3.id)).toBe(v2.id);
                expect(await expectChainValid(v1.assessmentGroupId)).toEqual([v2.id, v3.id]);
            });

            test("the newest version: nothing to re-link, the next new version points at the previous one", async () => {
                const [v1, v2, v3] = await newChain(3);
                await softDelete(assessment, v3.id);
                expect(await previousOf(v2.id)).toBe(v1.id);
                const next4 = await newAssessment({versionNumber: "4", assessmentGroupId: v1.assessmentGroupId});
                expect(next4.previousAssessmentVersionId).toBe(v2.id);
                expect(await expectChainValid(v1.assessmentGroupId)).toEqual([v1.id, v2.id, next4.id]);
            });

            test("several deletions in a row, in any order, keep the chain valid; the last live version has no predecessor", async () => {
                const chain = await newChain(5);
                const group = chain[0].assessmentGroupId;
                for (const index of [2, 0, 3, 1]) {
                    await softDelete(assessment, chain[index].id);
                    await expectChainValid(group);
                }
                expect(await expectChainValid(group)).toEqual([chain[4].id]);
                expect(await previousOf(chain[4].id)).toBeNull();
            });

            test("deleting never touches content, version numbers, or other versions", async () => {
                const [v1, v2, v3] = await newChain(3);
                const before = await Promise.all([v1, v2, v3].map((row) => rowOf(row.id)));
                await softDelete(assessment, v2.id);
                const after = await Promise.all([v1, v2, v3].map((row) => rowOf(row.id)));
                for (const [index, row] of after.entries()) {
                    expect([row.name, row.description, row.versionNumber, row.assessmentGroupId, row.createdAt.getTime()])
                        .toEqual([before[index].name, before[index].description, before[index].versionNumber, before[index].assessmentGroupId, before[index].createdAt.getTime()]);
                }
                expect(after.map((row) => row.deleted)).toEqual([false, true, false]);
            });

            test("the deleted version's rubric links are flagged, not removed", async () => {
                const shared = await newRubric();
                const first = await tx(async (t) => {
                    const row = await newAssessment({}, t);
                    await linkRubric(row.id, shared.id, 1, t);
                    return row;
                });
                const second = await tx(async (t) => {
                    const row = await newAssessment({versionNumber: "2", assessmentGroupId: first.assessmentGroupId}, t);
                    await linkRubric(row.id, shared.id, 1, t);
                    return row;
                });
                await softDelete(assessment, first.id);
                expect(await assessment_rubric.count({where: {assessmentId: first.id, deleted: true}})).toBe(1);
                expect(await assessment_rubric.count({where: {assessmentId: second.id, deleted: false}})).toBe(1);
                expect(await previousOf(second.id)).toBeNull();
            });

            test("a group whose versions are all deleted starts over without a predecessor, numbers are not reused by the id", async () => {
                const [v1, v2] = await newChain(2);
                await softDelete(assessment, v1.id);
                await softDelete(assessment, v2.id);
                expect(await latestLive(v1.assessmentGroupId)).toBeNull();
                const restart = await newAssessment({versionNumber: "3", assessmentGroupId: v1.assessmentGroupId});
                expect(restart.previousAssessmentVersionId).toBeNull();
                expect(restart.id).toBeGreaterThan(v2.id);
            });
        });

        describe("concurrency", () => {
            test("two creators cannot both extend the same version: the second waits, then must point at the first", async () => {
                const [v1] = await newChain(1);
                const group = v1.assessmentGroupId;
                const first = await db.sequelize.transaction();
                const second = await db.sequelize.transaction();
                try {
                    const a = await newAssessment({versionNumber: "2", assessmentGroupId: group}, first);   // uncommitted

                    // the second creator also read v1 as the latest and tries to extend it
                    const b = assessment.create(
                        {versionNumber: "3", name: next(), description: "", assessmentGroupId: group, previousAssessmentVersionId: v1.id},
                        {transaction: second}).then((row) => row, (error) => error);
                    expect(await waits(b)).toBe(true);

                    await first.commit();
                    const outcome = await b;
                    expect(outcome).toBeInstanceOf(DatabaseError);
                    expect(outcome.message).toMatch(/latest active version of its group|retry/);
                    expect(a.previousAssessmentVersionId).toBe(v1.id);
                } finally {
                    await second.rollback();
                    await first.rollback().catch(() => {});
                }
                expect(await select('SELECT count(*)::int AS "count" FROM assessment WHERE "previousAssessmentVersionId" = :id', {id: v1.id}))
                    .toEqual([{count: 1}]);
                await expectChainValid(group);
            });

            test("a delete and a new version in the same group are serialised and leave a valid chain", async () => {
                const [v1, v2, v3] = await newChain(3);
                const group = v1.assessmentGroupId;
                const deleter = await db.sequelize.transaction();
                try {
                    await softDelete(assessment, v3.id, deleter);                       // newest version, uncommitted
                    const creating = newAssessment({versionNumber: "4", assessmentGroupId: group, previousAssessmentVersionId: v3.id})
                        .then((row) => row, (error) => error);
                    expect(await waits(creating)).toBe(true);                          // the group lock is held by the delete
                    await deleter.commit();
                    expect(await creating).toBeInstanceOf(DatabaseError);              // v3 is gone: its successor must not point at it
                } finally {
                    await deleter.rollback().catch(() => {});
                }
                const retry = await newAssessment({versionNumber: "4", assessmentGroupId: group});
                expect(retry.previousAssessmentVersionId).toBe(v2.id);
                await expectChainValid(group);
            });
        });
    });
});
