const db = require("../db/index.js");
const {UniqueConstraintError, ForeignKeyConstraintError, DatabaseError} = require("sequelize");

/**
 * Schema tests for the versioned assessment tables (assessment, rubric, criterion and their link tables).
 * They talk to the models directly, no server or sockets involved.
 *
 * A version and its link / option rows are created in ONE transaction; once that transaction has
 * committed the version is final (database triggers reject further rows and content updates). Deleting is a
 * soft delete (lifecycle columns); see db.assessment_lifecycle.test.js for the lifecycle, chain and race tests.
 */
describe("Assessment versioning schema", () => {
    const {assessment, rubric, criterion, assessment_rubric, rubric_criterion, criterion_scoring_option} = db.models;
    const created = {assessment: [], rubric: [], criterion: []};

    // unique suffix so reruns never collide with leftovers
    const tag = `t${Date.now()}`;
    let counter = 0;
    const next = () => `${tag}-${++counter}`;
    const tx = (work) => db.sequelize.transaction(work);

    // Row factories; pass the transaction to create a version together with its rows.
    // a new version of an existing group points at the latest live version of that group (the database requires it)
    const latestLiveAssessment = async (group, transaction) => {
        const [row] = await db.sequelize.query(
            'SELECT MAX(id) AS "latest" FROM "assessment" WHERE "assessmentGroupId" = :group AND "deleted" = false',
            {replacements: {group}, transaction, type: db.sequelize.QueryTypes.SELECT});
        return row.latest;
    };
    const newAssessment = async (data = {}, transaction) => {
        const previousAssessmentVersionId = data.assessmentGroupId ? await latestLiveAssessment(data.assessmentGroupId, transaction) : null;
        const row = await assessment.create(
            {versionNumber: "1", name: next(), description: "", previousAssessmentVersionId, ...data}, {transaction});
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
    const addOption = (criterionId, points, position, transaction, description = "") =>
        criterion_scoring_option.create({criterionId, points, description, position}, {transaction});

    afterAll(async () => {
        // children cascade; delete in reference order so RESTRICT keys never block the cleanup
        // (newest assessment first: a version is referenced by its successor's predecessor link)
        for (const id of [...created.assessment].sort((a, b) => b - a)) {
            await assessment.destroy({where: {id}});
        }
        await rubric.destroy({where: {id: created.rubric}});
        await criterion.destroy({where: {id: created.criterion}});
        await db.sequelize.close();
    });

    describe("tables", () => {
        test("all six tables exist with the expected columns", async () => {
            const columns = async (model) => Object.keys(await db.sequelize.getQueryInterface().describeTable(model.tableName)).sort();

            const lifecycle = ["createdAt", "deleted", "deletedAt", "updatedAt"];
            expect(await columns(assessment)).toEqual([...lifecycle, "assessmentGroupId", "description", "id", "name", "previousAssessmentVersionId", "versionNumber"].sort());
            expect(await columns(rubric)).toEqual([...lifecycle, "calculation", "defaultPoints", "description", "id", "isBonus", "maxPoints", "minPoints", "name", "rubricGroupId", "settings", "versionNumber"].sort());
            expect(await columns(criterion)).toEqual([...lifecycle, "criterionGroupId", "description", "id", "maxPoints", "minPoints", "name", "settings", "versionNumber"].sort());
            expect(await columns(assessment_rubric)).toEqual([...lifecycle, "assessmentId", "id", "rubricId", "rubricPositionInAssessment"].sort());
            expect(await columns(rubric_criterion)).toEqual([...lifecycle, "criterionId", "criterionPositionInRubric", "id", "rubricId"].sort());
            expect(await columns(criterion_scoring_option)).toEqual([...lifecycle, "criterionId", "description", "id", "points", "position"].sort());
        });

        test("every model attribute matches the column of its table (name, nullability, JSON/boolean/numeric type) and vice versa", async () => {
            const expectedType = (type) => type.key === "DECIMAL" ? "numeric" : type.key === "JSONB" ? "jsonb"
                : type.key === "BOOLEAN" ? "boolean" : type.key === "DATE" ? "timestamp with time zone"
                    : type.key === "INTEGER" ? "integer" : type.key === "TEXT" ? "text" : "character varying";
            for (const model of [assessment, rubric, criterion, assessment_rubric, rubric_criterion, criterion_scoring_option]) {
                const [rows] = await db.sequelize.query(
                    "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = :table",
                    {replacements: {table: model.tableName}});
                const columns = Object.fromEntries(rows.map((row) => [row.column_name, row.data_type]));
                const attributes = model.getAttributes();
                expect(Object.keys(columns).sort()).toEqual(Object.keys(attributes).sort());
                for (const [name, attribute] of Object.entries(attributes)) {
                    expect([model.tableName, name, columns[name]]).toEqual([model.tableName, name, expectedType(attribute.type)]);
                }
            }
        });

        test("the configuration table is untouched", async () => {
            const columns = Object.keys(await db.sequelize.getQueryInterface().describeTable("configuration"));
            expect(columns).toEqual(expect.arrayContaining(["id", "name", "type", "content"]));
        });
    });

    describe.each([
        ["assessment", () => assessment, "assessmentGroupId", newAssessment],
        ["rubric", () => rubric, "rubricGroupId", newRubric],
        ["criterion", () => criterion, "criterionGroupId", newCriterion],
    ])("%s versions and groups", (_name, model, groupKey, create) => {
        test("a new group id is generated, versions share it when it is passed", async () => {
            const first = await create({versionNumber: "1.0"});
            const other = await create({versionNumber: "1.0"});
            const second = await create({versionNumber: "2.0", [groupKey]: first[groupKey]});

            expect(Number.isInteger(first[groupKey])).toBe(true);
            expect(other[groupKey]).not.toBe(first[groupKey]);
            expect(second[groupKey]).toBe(first[groupKey]);
            expect(second.id).not.toBe(first.id);
        });

        test("the same version number is allowed in different groups, not twice in one group", async () => {
            const first = await create({versionNumber: "7"});
            await expect(create({versionNumber: "7"})).resolves.toBeDefined();
            await expect(create({versionNumber: "7", [groupKey]: first[groupKey]})).rejects.toBeInstanceOf(UniqueConstraintError);
        });

        test("deleting the first version keeps the group usable and its id is never reused", async () => {
            const first = await create({versionNumber: "1"});
            const second = await create({versionNumber: "2", [groupKey]: first[groupKey]});

            await model().deleteById(first.id);

            const third = await create({versionNumber: "3", [groupKey]: first[groupKey]});
            const fresh = await create({versionNumber: "1"});
            expect(third[groupKey]).toBe(second[groupKey]);
            expect(fresh[groupKey]).toBeGreaterThan(first[groupKey]);
            // the deleted version is still in the table, flagged
            expect((await model().getById(first.id, {}, true)).deleted).toBe(true);
        });

        test("version number, name and description are required", async () => {
            await expect(model().create({name: next(), description: ""})).rejects.toThrow();
            await expect(model().create({versionNumber: "1", description: ""})).rejects.toThrow();
            await expect(model().create({versionNumber: "1", name: next()})).rejects.toThrow();
        });

        test("rows are immutable through every normal write path", async () => {
            const row = await create();
            const instance = await model().findByPk(row.id);
            const full = {...row.get({plain: true}), name: "changed"};

            await expect(model().updateById(row.id, {name: "changed"})).rejects.toThrow(/immutable/);
            await expect(model().update({name: "changed"}, {where: {id: row.id}})).rejects.toThrow(/immutable/);
            await expect(instance.update({name: "changed"})).rejects.toThrow(/immutable/);
            // (an assessment insert is refused earlier, by its predecessor rule)
            await expect(model().upsert(full)).rejects.toThrow(/immutable|predecessor/);
            await expect(model().bulkCreate([full], {updateOnDuplicate: ["name"]})).rejects.toThrow(/immutable|predecessor/);
            await expect(db.sequelize.query(`UPDATE "${model().tableName}" SET "name" = 'changed' WHERE id = ${row.id}`))
                .rejects.toThrow(/immutable/);
            expect((await model().getById(row.id)).name).toBe(row.name);
        });
    });

    describe("creating a version with its rows", () => {
        test("a version and its initial rows are created in one transaction, reusing existing versions", async () => {
            // earlier, finished versions to reuse
            const reusedCriterion = await tx(async (t) => {
                const row = await newCriterion({}, t);
                await addOption(row.id, 0, 1, t);
                return row;
            });
            const reusedRubric = await tx(async (t) => {
                const row = await newRubric({}, t);
                await linkCriterion(row.id, reusedCriterion.id, 1, t);
                return row;
            });

            // new versions that contain them next to brand-new children
            const ids = await tx(async (t) => {
                const freshCriterion = await newCriterion({minPoints: -1, maxPoints: 1}, t);
                await addOption(freshCriterion.id, -1, 1, t);
                await addOption(freshCriterion.id, 1, 2, t);
                const newerRubric = await newRubric({}, t);
                await linkCriterion(newerRubric.id, reusedCriterion.id, 1, t);
                await linkCriterion(newerRubric.id, freshCriterion.id, 2, t);
                const parent = await newAssessment({}, t);
                await linkRubric(parent.id, reusedRubric.id, 1, t);
                await linkRubric(parent.id, newerRubric.id, 2, t);
                return {freshCriterion, newerRubric, parent};
            });

            expect(await criterion_scoring_option.count({where: {criterionId: ids.freshCriterion.id}})).toBe(2);
            expect(await rubric_criterion.count({where: {rubricId: ids.newerRubric.id}})).toBe(2);
            expect(await assessment_rubric.count({where: {assessmentId: ids.parent.id}})).toBe(2);
            // the reused versions are unchanged
            expect(await rubric_criterion.count({where: {rubricId: reusedRubric.id}})).toBe(1);
            expect(await criterion_scoring_option.count({where: {criterionId: reusedCriterion.id}})).toBe(1);
        });

        test("a failed creation leaves no version and no rows behind", async () => {
            const marker = next();
            await expect(tx(async (t) => {
                const row = await newRubric({name: marker}, t);
                const leaf = await newCriterion({}, t);
                await linkCriterion(row.id, leaf.id, 1, t);
                await linkCriterion(row.id, leaf.id, 2, t); // same criterion twice
            })).rejects.toBeInstanceOf(UniqueConstraintError);

            expect(await rubric.count({where: {name: marker}})).toBe(0);
        });

        test("rows cannot be added to a finished version", async () => {
            const done = await tx(async (t) => {
                const leaf = await newCriterion({}, t);
                await addOption(leaf.id, 0, 1, t);
                const middle = await newRubric({}, t);
                await linkCriterion(middle.id, leaf.id, 1, t);
                const top = await newAssessment({}, t);
                await linkRubric(top.id, middle.id, 1, t);
                return {leaf, middle, top};
            });
            const extraCriterion = await newCriterion();
            const extraRubric = await newRubric();

            // by model, inside another transaction, and by raw SQL
            const attempts = [
                (t) => addOption(done.leaf.id, 1, 2, t),
                (t) => linkCriterion(done.middle.id, extraCriterion.id, 2, t),
                (t) => linkRubric(done.top.id, extraRubric.id, 2, t),
            ];
            for (const attempt of attempts) {
                await expect(attempt()).rejects.toThrow(/while the version is created/);
                await expect(tx(attempt)).rejects.toThrow(/while the version is created/);
            }
            for (const sql of [
                `INSERT INTO criterion_scoring_option ("criterionId", points, description, position) VALUES (${done.leaf.id}, 1, '', 3)`,
                `INSERT INTO rubric_criterion ("rubricId", "criterionId", "criterionPositionInRubric") VALUES (${done.middle.id}, ${extraCriterion.id}, 3)`,
                `INSERT INTO assessment_rubric ("assessmentId", "rubricId", "rubricPositionInAssessment") VALUES (${done.top.id}, ${extraRubric.id}, 3)`,
            ]) {
                await expect(db.sequelize.query(sql)).rejects.toThrow(/while the version is created/);
            }

            expect(await criterion_scoring_option.count({where: {criterionId: done.leaf.id}})).toBe(1);
            expect(await rubric_criterion.count({where: {rubricId: done.middle.id}})).toBe(1);
            expect(await assessment_rubric.count({where: {assessmentId: done.top.id}})).toBe(1);
        });

        test("a finished version is not changed by creating a newer version of it", async () => {
            const v1 = await tx(async (t) => {
                const leaf = await newCriterion({versionNumber: "1"}, t);
                await addOption(leaf.id, 0, 1, t);
                await addOption(leaf.id, 1, 2, t);
                const middle = await newRubric({versionNumber: "1"}, t);
                await linkCriterion(middle.id, leaf.id, 1, t);
                return {leaf, middle};
            });

            // "edit" = a new version of the criterion with its own options, a new rubric version that swaps it in
            const v2 = await tx(async (t) => {
                const leaf = await newCriterion({versionNumber: "2", criterionGroupId: v1.leaf.criterionGroupId}, t);
                await addOption(leaf.id, 0, 1, t);
                await addOption(leaf.id, 2, 2, t);
                await addOption(leaf.id, 4, 3, t);
                const middle = await newRubric({versionNumber: "2", rubricGroupId: v1.middle.rubricGroupId}, t);
                await linkCriterion(middle.id, leaf.id, 1, t);
                return {leaf, middle};
            });

            expect(v2.leaf.criterionGroupId).toBe(v1.leaf.criterionGroupId);
            const optionPoints = async (id) => (await criterion_scoring_option.findAll({where: {criterionId: id}, order: [["position", "ASC"]]})).map((o) => Number(o.points));
            expect(await optionPoints(v1.leaf.id)).toEqual([0, 1]);
            expect(await optionPoints(v2.leaf.id)).toEqual([0, 2, 4]);
            expect((await rubric_criterion.findAll({where: {rubricId: v1.middle.id}})).map((r) => r.criterionId)).toEqual([v1.leaf.id]);
            expect((await rubric_criterion.findAll({where: {rubricId: v2.middle.id}})).map((r) => r.criterionId)).toEqual([v2.leaf.id]);
        });

        test("a missing parent is reported by the foreign key", async () => {
            await expect(linkCriterion(2147483000, 2147483000, 1)).rejects.toBeInstanceOf(ForeignKeyConstraintError);
            await expect(addOption(2147483000, 1, 1)).rejects.toBeInstanceOf(ForeignKeyConstraintError);
        });
    });

    describe("link and option rows", () => {
        test("cannot be changed or removed one by one, only together with their parent version", async () => {
            const {parentAssessment, parentRubric, parentCriterion, link, occurrence, option} = await tx(async (t) => {
                const parentAssessment = await newAssessment({}, t);
                const parentRubric = await newRubric({}, t);
                const parentCriterion = await newCriterion({}, t);
                return {
                    parentAssessment, parentRubric, parentCriterion,
                    link: await linkRubric(parentAssessment.id, parentRubric.id, 1, t),
                    occurrence: await linkCriterion(parentRubric.id, parentCriterion.id, 1, t),
                    option: await addOption(parentCriterion.id, 1, 1, t),
                };
            });

            for (const [model, row, column] of [
                [assessment_rubric, link, "rubricPositionInAssessment"],
                [rubric_criterion, occurrence, "criterionPositionInRubric"],
                [criterion_scoring_option, option, "points"],
            ]) {
                await expect(model.updateById(row.id, {[column]: 9})).rejects.toThrow(/immutable/);
                await expect(model.update({[column]: 9}, {where: {id: row.id}})).rejects.toThrow(/immutable/);
                await expect((await model.findByPk(row.id)).increment(column, {by: 1})).rejects.toThrow(/immutable/);
                await expect(model.deleteById(row.id)).rejects.toThrow(/together with their version/);
                await expect(model.update({deleted: true}, {where: {id: row.id}})).rejects.toThrow(/together with their version/);
                await expect(model.destroy({where: {id: row.id}})).rejects.toThrow(/immutable/);
                await expect(db.sequelize.query(`DELETE FROM "${model.tableName}" WHERE id = ${row.id}`)).rejects.toThrow(/immutable/);
                expect(await model.getById(row.id)).not.toBeNull();
            }

            // deleting the parent versions flags the children (they are kept, hidden from the default reads)
            await assessment.deleteById(parentAssessment.id);
            await rubric.deleteById(parentRubric.id);
            await criterion.deleteById(parentCriterion.id);
            expect(await assessment_rubric.getById(link.id)).toBeNull();
            expect(await rubric_criterion.getById(occurrence.id)).toBeNull();
            expect(await criterion_scoring_option.getById(option.id)).toBeNull();
            for (const [model, row] of [[assessment_rubric, link], [rubric_criterion, occurrence], [criterion_scoring_option, option]]) {
                const kept = await model.getById(row.id, {}, true);
                expect(kept.deleted).toBe(true);
                expect(kept.deletedAt).toBeInstanceOf(Date);
            }
        });
    });

    describe("MetaModel", () => {
        test("getById, getAllByKey and getAll work", async () => {
            const row = await newAssessment({versionNumber: "meta"});

            expect((await assessment.getById(row.id)).name).toBe(row.name);
            expect(await assessment.getAllByKey("assessmentGroupId", row.assessmentGroupId)).toHaveLength(1);
            expect((await assessment.getAll()).some((r) => r.id === row.id)).toBe(true);
        });

        test("deleteById soft-deletes: the row is hidden from the default reads and kept with its deletion time", async () => {
            const row = await newAssessment();
            await assessment.deleteById(row.id);
            expect(await assessment.getById(row.id)).toBeNull();
            expect((await assessment.getAll()).some((r) => r.id === row.id)).toBe(false);
            const kept = await assessment.getById(row.id, {}, true);
            expect(kept.deleted).toBe(true);
            expect(kept.deletedAt).toBeInstanceOf(Date);
            expect(kept.name).toBe(row.name);
        });

        test("add returns the created row", async () => {
            const row = await assessment.add({versionNumber: "added", name: next(), description: ""});
            created.assessment.push(row.id);
            expect(row.assessmentGroupId).toBeGreaterThan(0);
            expect(row.createdAt).toBeInstanceOf(Date);
        });
    });

    describe("rubric", () => {
        test("optional properties of the existing JSON are stored as NULL / false", async () => {
            const row = await newRubric();
            expect(row.calculation).toBeNull();
            expect(row.defaultPoints).toBeNull();
            expect(row.isBonus).toBe(false);

            const deduction = await newRubric({calculation: "max", defaultPoints: 4});
            const bonus = await newRubric({isBonus: true, minPoints: -2, maxPoints: 2});
            expect(Number(deduction.defaultPoints)).toBe(4);
            expect(bonus.isBonus).toBe(true);
        });

        test.each(["sum", "min", "max", "anything else"])("calculation %s is stored as given", async (calculation) => {
            expect((await newRubric({calculation})).calculation).toBe(calculation);
        });

        test("min above max is rejected, equal is fine", async () => {
            await expect(newRubric({minPoints: 5, maxPoints: 1})).rejects.toBeInstanceOf(DatabaseError);
            await expect(newRubric({minPoints: 2, maxPoints: 2})).resolves.toBeDefined();
        });

        test("min and max points are optional: NULL means the bound is not active", async () => {
            const onlyMax = await rubric.create({versionNumber: "1", name: next(), description: "", maxPoints: 1});
            const onlyMin = await rubric.create({versionNumber: "1", name: next(), description: "", minPoints: 0});
            const neither = await rubric.create({versionNumber: "1", name: next(), description: ""});
            created.rubric.push(onlyMax.id, onlyMin.id, neither.id);
            expect(onlyMax.minPoints).toBeNull();
            expect(onlyMin.maxPoints).toBeNull();
            expect([neither.minPoints, neither.maxPoints]).toEqual([null, null]);
            expect(neither.settings).toEqual({});
        });
    });

    describe("criterion", () => {
        test("points are optional and settings default to an empty object", async () => {
            const bare = await newCriterion();
            expect(bare.minPoints).toBeNull();
            expect(bare.maxPoints).toBeNull();

            const full = await newCriterion({minPoints: -2, maxPoints: 0, settings: {function: "manual_grading", expertLevel: 2}});
            expect(Number(full.minPoints)).toBe(-2);
            expect(full.settings).toEqual({function: "manual_grading", expertLevel: 2});

            const plain = await criterion.create({versionNumber: "1", name: next(), description: ""});
            created.criterion.push(plain.id);
            expect(plain.settings).toEqual({});
        });

        test("min above max is rejected", async () => {
            await expect(newCriterion({minPoints: 3, maxPoints: 1})).rejects.toBeInstanceOf(DatabaseError);
        });
    });

    describe("assessment_rubric", () => {
        test("a rubric version can be reused across assessment versions", async () => {
            const shared = await newRubric();
            const v1 = await tx(async (t) => {
                const row = await newAssessment({versionNumber: "1"}, t);
                await linkRubric(row.id, shared.id, 1, t);
                return row;
            });
            await tx(async (t) => {
                const row = await newAssessment({versionNumber: "2", assessmentGroupId: v1.assessmentGroupId}, t);
                await linkRubric(row.id, shared.id, 1, t);
            });

            expect(await assessment_rubric.count({where: {rubricId: shared.id}})).toBe(2);
        });

        test("a rubric appears once per assessment and each position once", async () => {
            const [a, b] = [await newRubric(), await newRubric()];
            const attempt = (second) => tx(async (t) => {
                const target = await newAssessment({}, t);
                await linkRubric(target.id, a.id, 1, t);
                await second(target, t);
            });

            await expect(attempt((target, t) => linkRubric(target.id, a.id, 2, t))).rejects.toBeInstanceOf(UniqueConstraintError);
            await expect(attempt((target, t) => linkRubric(target.id, b.id, 1, t))).rejects.toBeInstanceOf(UniqueConstraintError);
            await expect(attempt((target, t) => linkRubric(target.id, b.id, 2, t))).resolves.toBeUndefined();
        });

        test("foreign keys must point at existing rows", async () => {
            await expect(tx(async (t) => {
                const target = await newAssessment({}, t);
                await linkRubric(target.id, 2147483000, 1, t);
            })).rejects.toBeInstanceOf(ForeignKeyConstraintError);
        });

        test("a rubric used by an assessment cannot be deleted, an unused one can", async () => {
            const used = await newRubric();
            const unused = await newRubric();
            await tx(async (t) => linkRubric((await newAssessment({}, t)).id, used.id, 1, t));

            await expect(rubric.deleteById(used.id)).rejects.toThrow(/still referenced/);
            expect(await rubric.getById(used.id)).not.toBeNull();

            await rubric.deleteById(unused.id);
            expect(await rubric.getById(unused.id)).toBeNull();
        });

        test("deleting an assessment frees its rubrics", async () => {
            const row = await newRubric();
            const target = await tx(async (t) => {
                const parent = await newAssessment({}, t);
                await linkRubric(parent.id, row.id, 1, t);
                return parent;
            });

            await assessment.deleteById(target.id);

            // the link row is kept (flagged), it no longer counts as a reference
            expect(await assessment_rubric.count({where: {assessmentId: target.id}})).toBe(1);
            expect(await assessment_rubric.count({where: {assessmentId: target.id, deleted: false}})).toBe(0);
            await rubric.deleteById(row.id);
            expect(await rubric.getById(row.id)).toBeNull();
        });
    });

    describe("rubric_criterion", () => {
        test("a criterion version can be reused across rubric versions, with distinct occurrence ids", async () => {
            const shared = await newCriterion();
            const make = (data, position) => tx(async (t) => {
                const row = await newRubric(data, t);
                return {row, link: await linkCriterion(row.id, shared.id, position, t)};
            });
            const v1 = await make({versionNumber: "1"}, 1);
            const v2 = await make({versionNumber: "2", rubricGroupId: v1.row.rubricGroupId}, 3);

            expect(v1.link.id).not.toBe(v2.link.id);
            expect(await rubric_criterion.count({where: {criterionId: shared.id}})).toBe(2);
        });

        test("a criterion appears once per rubric and each position once", async () => {
            const [a, b] = [await newCriterion(), await newCriterion()];
            const attempt = (second) => tx(async (t) => {
                const target = await newRubric({}, t);
                await linkCriterion(target.id, a.id, 1, t);
                await second(target, t);
            });

            await expect(attempt((target, t) => linkCriterion(target.id, a.id, 2, t))).rejects.toBeInstanceOf(UniqueConstraintError);
            await expect(attempt((target, t) => linkCriterion(target.id, b.id, 1, t))).rejects.toBeInstanceOf(UniqueConstraintError);
        });

        test("a criterion used by a rubric cannot be deleted, an unused one can", async () => {
            const used = await newCriterion();
            const unused = await newCriterion();
            await tx(async (t) => linkCriterion((await newRubric({}, t)).id, used.id, 1, t));

            await expect(criterion.deleteById(used.id)).rejects.toThrow(/still referenced/);
            await criterion.deleteById(unused.id);
            expect(await criterion.getById(unused.id)).toBeNull();
        });

        test("deleting an unreferenced rubric flags its criterion links and keeps the criteria", async () => {
            const row = await newCriterion();
            const target = await tx(async (t) => {
                const parent = await newRubric({}, t);
                await linkCriterion(parent.id, row.id, 1, t);
                return parent;
            });

            await rubric.deleteById(target.id);

            expect(await rubric_criterion.count({where: {rubricId: target.id}})).toBe(1);
            expect(await rubric_criterion.count({where: {rubricId: target.id, deleted: false}})).toBe(0);
            expect(await criterion.getById(row.id)).not.toBeNull();
        });

        test("a rubric that is part of an assessment keeps its criterion links", async () => {
            const row = await newCriterion();
            const target = await tx(async (t) => {
                const parent = await newRubric({}, t);
                await linkCriterion(parent.id, row.id, 1, t);
                return parent;
            });
            await tx(async (t) => linkRubric((await newAssessment({}, t)).id, target.id, 1, t));

            await expect(rubric.deleteById(target.id)).rejects.toThrow(/still referenced/);
            expect(await rubric_criterion.count({where: {rubricId: target.id}})).toBe(1);
        });
    });

    describe("criterion_scoring_option", () => {
        test("negative, zero and positive points are stored", async () => {
            const row = await tx(async (t) => {
                const leaf = await newCriterion({minPoints: -2, maxPoints: 2}, t);
                for (const [position, points] of [-2, -1, 0, 1, 2].entries()) {
                    await addOption(leaf.id, points, position, t, `option ${points}`);
                }
                return leaf;
            });

            const options = await criterion_scoring_option.findAll({where: {criterionId: row.id}, order: [["position", "ASC"]]});
            expect(options.map((o) => Number(o.points))).toEqual([-2, -1, 0, 1, 2]);
        });

        test("points are not rounded or limited in size", async () => {
            const row = await newCriterion({minPoints: 0.125, maxPoints: "123456789012.123456789"});
            const fetched = await criterion.getById(row.id);
            expect(fetched.minPoints).toBe("0.125");
            expect(fetched.maxPoints).toBe("123456789012.123456789");
        });

        test("fractional points are kept", async () => {
            const option = await tx(async (t) => addOption((await newCriterion({}, t)).id, 0.5, 1, t));
            expect(Number((await criterion_scoring_option.getById(option.id)).points)).toBe(0.5);
        });

        test("a position is used once per criterion, but can repeat across criteria", async () => {
            await expect(tx(async (t) => {
                const leaf = await newCriterion({}, t);
                await addOption(leaf.id, 0, 1, t);
                await addOption(leaf.id, 1, 1, t);
            })).rejects.toBeInstanceOf(UniqueConstraintError);

            await expect(tx(async (t) => {
                await addOption((await newCriterion({}, t)).id, 0, 1, t);
                await addOption((await newCriterion({}, t)).id, 0, 1, t);
            })).resolves.toBeUndefined();
        });

        test("deleting an unreferenced criterion flags its options and keeps them", async () => {
            const row = await tx(async (t) => {
                const leaf = await newCriterion({}, t);
                await addOption(leaf.id, 0, 1, t);
                return leaf;
            });

            await criterion.deleteById(row.id);

            expect(await criterion_scoring_option.count({where: {criterionId: row.id}})).toBe(1);
            expect(await criterion_scoring_option.count({where: {criterionId: row.id, deleted: false}})).toBe(0);
        });
    });

    describe("associations", () => {
        test("an assessment loads its rubrics, their criteria and scoring options", async () => {
            const {parent, leaf, occurrence} = await tx(async (t) => {
                const parent = await newAssessment({}, t);
                const middle = await newRubric({}, t);
                const leaf = await newCriterion({}, t);
                await linkRubric(parent.id, middle.id, 1, t);
                const occurrence = await linkCriterion(middle.id, leaf.id, 1, t);
                await addOption(leaf.id, -1, 1, t);
                return {parent, leaf, occurrence};
            });

            // two shallow loads: one deep include overflows PostgreSQL's 63-character alias limit
            const loaded = await assessment.findByPk(parent.id, {
                include: [{
                    model: assessment_rubric, as: "assessmentRubrics",
                    include: [{model: rubric, as: "rubric", include: [{model: rubric_criterion, as: "rubricCriteria"}]}],
                }],
            });
            const loadedOccurrence = loaded.assessmentRubrics[0].rubric.rubricCriteria[0];
            expect(loadedOccurrence.id).toBe(occurrence.id);

            const loadedCriterion = await criterion.findByPk(loadedOccurrence.criterionId, {
                include: [{model: criterion_scoring_option, as: "scoringOptions"}],
            });
            expect(loadedCriterion.id).toBe(leaf.id);
            expect(Number(loadedCriterion.scoringOptions[0].points)).toBe(-1);
        });
    });
});
