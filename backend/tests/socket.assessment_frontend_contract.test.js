const Server = require("../webserver/Server.js");
const {getSocketClient} = require("./utils.js");

/**
 * Contract between the Assessment Management Dashboard frontend and the real backend: a real server, real
 * Socket.IO and real PostgreSQL, driven with the payload builders and the response mappers of the frontend itself
 * (frontend/src/components/dashboard/assessments/*Form.js, selectionRows.js), imported unchanged. If the frontend
 * and the backend ever drift apart (field names, response shapes, numbering, pinned versions, the assessment
 * predecessor chain, deletion rules) this suite fails. It is not a browser test: no component is rendered here, the
 * components are tested with an in-memory backend in frontend/tests.
 */
describe("Assessment dashboard: frontend payloads against the real backend", () => {
    const PORT = 3113;
    const FRONTEND = "../../frontend/src/components/dashboard/assessments/";
    const tag = `t${Date.now()}`;
    let counter = 0;
    const next = () => `${tag}-${++counter}`;

    let server;
    let admin;
    let db;
    let criterionForm;
    let rubricForm;
    let assessmentForm;
    let selection;
    let settingsForm;
    const created = {assessment: [], rubric: [], criterion: [], study: [], study_step: []};

    const call = (event, data = {}) => new Promise((resolve) => admin.emit(event, data, resolve));
    const must = async (event, data) => {
        const response = await call(event, data);
        expect(response).toMatchObject({success: true});
        return response.data;
    };

    beforeAll(async () => {
        db = require("../db/index.js");
        criterionForm = await import(`${FRONTEND}criterionForm.js`);
        rubricForm = await import(`${FRONTEND}rubricForm.js`);
        assessmentForm = await import(`${FRONTEND}assessmentForm.js`);
        selection = await import(`${FRONTEND}selectionRows.js`);
        settingsForm = await import(`${FRONTEND}settingsForm.js`);
        server = new Server();
        server.start(PORT);
        admin = await getSocketClient(server, PORT, process.env.ADMIN_EMAIL, process.env.ADMIN_PWD);
    });

    afterAll(async () => {
        admin.connected && admin.disconnect();
        if (created.study_step.length) {
            await db.sequelize.query("DELETE FROM study_step WHERE id IN (:ids)", {replacements: {ids: created.study_step}});
        }
        if (created.study.length) {
            await db.sequelize.query("DELETE FROM study WHERE id IN (:ids)", {replacements: {ids: created.study}});
        }
        for (const id of [...created.assessment].sort((a, b) => b - a)) {
            await db.models.assessment.destroy({where: {id}});
        }
        await db.models.rubric.destroy({where: {id: created.rubric}});
        await db.models.criterion.destroy({where: {id: created.criterion}});
        server.stop();
    });

    /** a criterion created exactly like the criterion modal does */
    const createCriterion = async (overrides = {}) => {
        const form = {...criterionForm.emptyCriterionForm(), name: next(), minActive: true, minPoints: -2.5, maxActive: true, maxPoints: 4, ...overrides};
        const payload = criterionForm.toCriterionPayload(form, [{uid: 1, points: -2.5, description: "worst"}, {uid: 2, points: 4, description: "best"}]);
        const row = await must("criterionCreate", payload);
        created.criterion.push(row.id);
        return row;
    };

    test("criterion: the modal payload is accepted, numbered 1, and the stored version maps back to the same form and payload", async () => {
        const rows = settingsForm.rowsFromSettings({});
        const typed = [{...settingsForm.emptySettingsRow(), key: "weight", value: "5"}, {...settingsForm.emptySettingsRow(), key: "tier", value: "a"}];
        const row = await createCriterion({settingsRows: [...rows, ...typed]});

        expect(row.versionNumber).toBe("1");
        expect(row.settings).toEqual({weight: "5", tier: "a"}, "typed values are stored as text");
        expect([row.minPoints, row.maxPoints]).toEqual([-2.5, 4]);
        for (const removed of ["function", "expertLevel", "subjective"]) {
            expect(row).not.toHaveProperty(removed);
        }
        // round trip: the stored version, loaded for a view or a copy, gives back the content that was sent
        const loaded = await must("criterionGet", {criterionId: row.id});
        const form = criterionForm.formFromCriterion(loaded);
        const options = criterionForm.optionsFromCriterion(loaded).map((option, uid) => ({uid, ...option}));
        expect(criterionForm.toCriterionPayload(form, options)).toEqual({
            name: row.name, description: "", minPoints: -2.5, maxPoints: 4, settings: {weight: "5", tier: "a"},
            scoringOptions: [{points: -2.5, description: "worst"}, {points: 4, description: "best"}],
        });
    });

    test("criterion: switched-off bounds are stored as null and come back switched off; a typed version number is refused", async () => {
        const row = await createCriterion({minActive: false, maxActive: false});
        expect([row.minPoints, row.maxPoints]).toEqual([null, null]);
        const form = criterionForm.formFromCriterion(await must("criterionGet", {criterionId: row.id}));
        expect([form.minActive, form.maxActive]).toEqual([false, false]);

        const payload = {...criterionForm.toCriterionPayload({...criterionForm.emptyCriterionForm(), name: next()}, []), versionNumber: "9"};
        expect(await call("criterionCreate", payload)).toMatchObject({success: false, key: "errors.assessment.versionNumberNotAllowed"});
    });

    test("criterion: a new version from the modal request is numbered 2, becomes the latest, and an untouched stored setting keeps its type", async () => {
        const first = await must("criterionCreate", {name: next(), description: "", minPoints: null, maxPoints: null, settings: {level: 2, strict: true, tag: "x"}, scoringOptions: []});
        created.criterion.push(first.id);
        const form = criterionForm.formFromCriterion(await must("criterionGet", {criterionId: first.id}));
        form.name = `${first.name}-v2`;
        const request = criterionForm.versionRequest(criterionForm.versionSource(first), form, []);
        const second = await must("criterionCreateVersion", request);
        created.criterion.push(second.id);

        expect(second.versionNumber).toBe("2");
        expect(second.criterionGroupId).toBe(first.criterionGroupId);
        expect(second.settings).toEqual({level: 2, strict: true, tag: "x"}, "stored types preserved when not edited");
        const latest = (await must("criterionGetLatest")).find((row) => row.criterionGroupId === first.criterionGroupId);
        expect(latest).toMatchObject({id: second.id, versionNumber: "2", versionCount: 2});
        const versions = await must("criterionGetVersions", {criterionGroupId: first.criterionGroupId});
        expect(versions.map((v) => [v.id, v.versionNumber])).toEqual([[second.id, "2"], [first.id, "1"]]);
    });

    test("rubric: the modal payload creates version 1 pinned to criterion VERSIONS; selection rows and read-only rows map from the real answers", async () => {
        const a = await createCriterion();
        const b = await createCriterion();
        const form = {...rubricForm.emptyRubricForm(), name: next(), calculation: "max", defaultPoints: 8, isBonus: true, minActive: true, minPoints: 0, maxActive: true, maxPoints: 10,
            settingsRows: settingsForm.rowsFromSettings({tier: "gold", level: 3})};
        const row = await must("rubricCreate", rubricForm.toRubricPayload(form, [b.id, a.id]));
        created.rubric.push(row.id);

        expect(row).toMatchObject({versionNumber: "1", calculation: "max", defaultPoints: 8, isBonus: true, minPoints: 0, maxPoints: 10});
        expect(row.settings).toEqual({tier: "gold", level: 3}, "untouched stored values keep their type");
        const loaded = await must("rubricGet", {rubricId: row.id});
        expect(rubricForm.criterionIdsFromRubric(loaded)).toEqual([b.id, a.id], "the order of the selection is kept");
        expect(selection.rowsFromRubricCriteria(loaded).map((r) => [r.id, r.name, r.detail])).toEqual([[b.id, b.name, "v1"], [a.id, a.name, "v1"]]);

        const rows = selection.versionRows(await must("criterionGetAll"));
        expect(rows.find((r) => r.id === a.id)).toMatchObject({name: a.name, versionNumber: "1", points: "-2.5 – 4"});
        // the form of a stored rubric maps back to the same payload
        expect(rubricForm.toRubricPayload(rubricForm.formFromRubric(loaded), rubricForm.criterionIdsFromRubric(loaded)))
            .toEqual(rubricForm.toRubricPayload(form, [b.id, a.id]));
    });

    test("rubric: a new version keeps the pinned criterion versions and a stored older calculation; the number is assigned by the backend", async () => {
        const criterion = await createCriterion();
        const legacy = await must("rubricCreate", {name: next(), description: "", calculation: "min", minPoints: 0, maxPoints: 5, criterionIds: [criterion.id]});
        created.rubric.push(legacy.id);
        // a newer criterion version exists, but the rubric stays pinned to the one it was given
        const newer = await must("criterionCreateVersion", criterionForm.versionRequest(
            criterionForm.versionSource(criterion), criterionForm.formFromCriterion(criterion), []));
        created.criterion.push(newer.id);

        const loaded = await must("rubricGet", {rubricId: legacy.id});
        const form = rubricForm.formFromRubric(loaded);
        expect(form.calculation).toBe("min");
        const request = rubricForm.rubricVersionRequest(rubricForm.rubricSource(loaded), form, rubricForm.criterionIdsFromRubric(loaded));
        const second = await must("rubricCreateVersion", request);
        created.rubric.push(second.id);
        expect(second).toMatchObject({versionNumber: "2", calculation: "min", rubricGroupId: legacy.rubricGroupId});
        expect(second.criteria.map((link) => link.criterionId)).toEqual([criterion.id], "newer criterion versions are never picked up");
        const latest = (await must("rubricGetLatest")).find((r) => r.rubricGroupId === legacy.rubricGroupId);
        expect(latest).toMatchObject({id: second.id, versionCount: 2, calculation: "min"});
    });

    test("rubric: a criterion version still used by a rubric cannot be deleted from the Versions modal; a deleted one is no longer offered", async () => {
        const used = await createCriterion();
        const spare = await createCriterion();
        const row = await must("rubricCreate", rubricForm.toRubricPayload({...rubricForm.emptyRubricForm(), name: next()}, [used.id]));
        created.rubric.push(row.id);

        expect(await call("criterionDelete", {criterionId: used.id})).toMatchObject({success: false, key: "errors.assessment.criterion.inUse"});
        const removed = await must("criterionDelete", {criterionId: spare.id});
        expect(removed).toMatchObject({id: spare.id, latestVersionId: null});
        const offered = selection.versionRows(await must("criterionGetAll")).map((r) => r.id);
        expect(offered).toContain(used.id);
        expect(offered).not.toContain(spare.id);
        expect(await call("rubricCreate", rubricForm.toRubricPayload({...rubricForm.emptyRubricForm(), name: next()}, [spare.id])))
            .toMatchObject({success: false, key: "errors.assessment.rubric.criteriaNotFound"});
    });

    test("assessment: the modal payload creates version 1, a new version is numbered 2 and linked by the backend, rubric versions stay pinned", async () => {
        const criterion = await createCriterion();
        const rubric = await must("rubricCreate", rubricForm.toRubricPayload({...rubricForm.emptyRubricForm(), name: next()}, [criterion.id]));
        created.rubric.push(rubric.id);
        const other = await must("rubricCreate", rubricForm.toRubricPayload({...rubricForm.emptyRubricForm(), name: next()}, [criterion.id]));
        created.rubric.push(other.id);

        const first = await must("assessmentCreate", assessmentForm.toAssessmentPayload({name: next(), description: "Final"}, [other.id, rubric.id]));
        created.assessment.push(first.id);
        expect(first).toMatchObject({versionNumber: "1", previousAssessmentVersionId: null});
        expect(first.rubrics.map((link) => link.rubricId)).toEqual([other.id, rubric.id]);

        const loaded = await must("assessmentGet", {assessmentId: first.id});
        expect(assessmentForm.rubricIdsFromAssessment(loaded)).toEqual([other.id, rubric.id]);
        expect(selection.rowsFromAssessmentRubrics(loaded).map((r) => [r.id, r.detail])).toEqual([[other.id, "v1"], [rubric.id, "v1"]]);

        const request = assessmentForm.assessmentVersionRequest(assessmentForm.assessmentSource(loaded), {name: `${first.name}-2`, description: "Final"}, [rubric.id]);
        expect(Object.keys(request).sort()).toEqual(["assessmentGroupId", "copyFromId", "description", "name", "rubricIds"], "the frontend never sends a version number or a predecessor");
        const second = await must("assessmentCreateVersion", request);
        created.assessment.push(second.id);
        expect(second).toMatchObject({versionNumber: "2", assessmentGroupId: first.assessmentGroupId, previousAssessmentVersionId: first.id});
        expect(second.rubrics.map((link) => link.rubricId)).toEqual([rubric.id]);

        const latest = (await must("assessmentGetLatest")).find((a) => a.assessmentGroupId === first.assessmentGroupId);
        expect(latest).toMatchObject({id: second.id, versionNumber: "2", versionCount: 2});
        const versions = await must("assessmentGetVersions", {assessmentGroupId: first.assessmentGroupId});
        expect(versions.map((v) => v.versionNumber)).toEqual(["2", "1"]);
    });

    test("assessment: an unreferenced version can be deleted; a rubric version used by an assessment cannot be deleted and is named", async () => {
        const criterion = await createCriterion();
        const rubric = await must("rubricCreate", rubricForm.toRubricPayload({...rubricForm.emptyRubricForm(), name: next()}, [criterion.id]));
        created.rubric.push(rubric.id);
        const assessment = await must("assessmentCreate", assessmentForm.toAssessmentPayload({name: next(), description: ""}, [rubric.id]));
        created.assessment.push(assessment.id);

        expect(await call("rubricDelete", {rubricId: rubric.id}))
            .toMatchObject({success: false, key: "errors.assessment.rubric.inUse", params: {references: `'${assessment.name}' (v1)`}});
        const second = await must("assessmentCreateVersion", {copyFromId: assessment.id});
        created.assessment.push(second.id);
        expect(await call("assessmentDelete", {assessmentId: second.id}))
            .toMatchObject({success: true, data: {id: second.id, assessmentGroupId: assessment.assessmentGroupId, latestVersionId: assessment.id}});
        expect(await call("assessmentGet", {assessmentId: assessment.id})).toMatchObject({success: true});
        // the rubric offered for a selection is still there
        expect(selection.versionRows(await must("rubricGetAll")).some((r) => r.id === rubric.id)).toBe(true);
    });

    test("deletion refusals: the real responses carry every placeholder of the English, German and French messages, filled with stored names and version numbers", async () => {
        const fs = require("fs");
        const path = require("path");
        const catalog = (lang) => JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../utils/modules/i18n/${lang}/errors.json`), "utf8")).assessment;

        const criterion = await createCriterion();
        const rubric = await must("rubricCreate", rubricForm.toRubricPayload({...rubricForm.emptyRubricForm(), name: next()}, [criterion.id]));
        created.rubric.push(rubric.id);
        const rubricV2 = await must("rubricCreateVersion", {copyFromId: rubric.id});
        created.rubric.push(rubricV2.id);
        const assessment = await must("assessmentCreate", assessmentForm.toAssessmentPayload({name: next(), description: ""}, [rubric.id]));
        created.assessment.push(assessment.id);
        const assessmentV2 = await must("assessmentCreateVersion", {copyFromId: assessment.id});
        created.assessment.push(assessmentV2.id);

        // a study step that uses the second assessment version (the real writers do not exist yet: raw SQL, guarded by the trigger)
        const studyName = next();
        const [[study]] = await db.sequelize.query(
            'INSERT INTO study (name, hash, template, "createdAt", "updatedAt") VALUES (:name, :hash, false, now(), now()) RETURNING id',
            {replacements: {name: studyName, hash: next()}});
        created.study = [...(created.study ?? []), study.id];
        const [[workflowStep]] = await db.sequelize.query("SELECT id, name FROM workflow_step ORDER BY id LIMIT 1");
        const [[step]] = await db.sequelize.query(
            `INSERT INTO study_step ("studyId", "workflowStepId", "stepType", configuration, "createdAt", "updatedAt")
             VALUES (:studyId, :workflowStepId, 1, CAST(:configuration AS jsonb), now(), now()) RETURNING id`,
            {replacements: {studyId: study.id, workflowStepId: workflowStep.id, configuration: JSON.stringify({settings: {assessmentId: assessmentV2.id}})}});
        created.study_step = [...(created.study_step ?? []), step.id];

        const refusals = {
            criterion: [await call("criterionDelete", {criterionId: criterion.id}), criterion, "rubric"],
            rubric: [await call("rubricDelete", {rubricId: rubric.id}), rubric, "assessment"],
            assessment: [await call("assessmentDelete", {assessmentId: assessmentV2.id}), assessmentV2, null],
        };
        for (const [kind, [response, target]] of Object.entries(refusals)) {
            expect(response).toMatchObject({success: false, key: `errors.assessment.${kind}.inUse`});
            // names and version numbers of the stored rows, never ids
            expect(response.params).toMatchObject({name: target.name, version: target.versionNumber});
            for (const lang of ["en", "de", "fr"]) {
                const template = catalog(lang)[kind].inUse;
                const placeholders = [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
                expect(placeholders.length).toBeGreaterThan(2);
                for (const name of placeholders) {
                    expect({lang, kind, name, value: response.params[name]}).toEqual({lang, kind, name, value: expect.anything()});
                    expect(String(response.params[name]).trim()).not.toBe("");
                }
                const text = template.replace(/\{(\w+)\}/g, (_match, name) => String(response.params[name]));
                expect(text).toContain(`${target.name}`);
                expect(text).not.toMatch(/''|\(version \)|\(Version \)|: \./);
            }
        }
        expect(refusals.criterion[0].params.references).toBe(`'${rubric.name}' (v1), '${rubricV2.name}' (v2)`);
        expect(refusals.rubric[0].params.references).toBe(`'${assessment.name}' (v1), '${assessmentV2.name}' (v2)`);
        expect(refusals.assessment[0].params.studySteps).toBe(`'${studyName}' / '${workflowStep.name}'`);
        expect(refusals.assessment[0].params).toMatchObject({count: 1, templateSteps: "-", triggers: "-", triggerActions: "-", queuedRuns: "-"});

        // the unreferenced first version of the assessment can go, the referenced second one stays
        expect(await call("assessmentDelete", {assessmentId: assessment.id})).toMatchObject({success: true, data: {latestVersionId: assessmentV2.id}});
        expect(await call("assessmentGet", {assessmentId: assessmentV2.id})).toMatchObject({success: true});
    });

    test("assessment: a typed version number or a predecessor sent by a client is never part of what the frontend builds", async () => {
        const criterion = await createCriterion();
        const rubric = await must("rubricCreate", rubricForm.toRubricPayload({...rubricForm.emptyRubricForm(), name: next()}, [criterion.id]));
        created.rubric.push(rubric.id);
        const payload = assessmentForm.toAssessmentPayload({name: next(), description: ""}, [rubric.id]);
        expect(Object.keys(payload).sort()).toEqual(["description", "name", "rubricIds"]);
        const refused = await call("assessmentCreate", {...payload, versionNumber: "4"});
        expect(refused).toMatchObject({success: false, key: "errors.assessment.versionNumberNotAllowed"});
        expect(await db.models.assessment.count({where: {name: payload.name}})).toBe(0);
    });
});
