const fs = require("fs");
const path = require("path");
const Server = require("../webserver/Server.js");
const {createInitialAdmin} = require("../webserver/utils/setupAdmin.js");
const {getSocketClient} = require("./utils.js");

const PORT = 3112;
const SCOPE = {assignmentBulk: true};
// Fixtures run whole bulk assignments, and the first request loads the socket modules.
const SLOW = 60000;
const HIDDEN_FLAG_MIGRATION = "../db/migrations/20261104120000-extend-submission-hideInFrontend.js";
const FILES_DIR = path.join(__dirname, "../../files");
// Every copy of a fixture PDF has these bytes, including copies whose transaction was rolled back.
const PDF_CONTENT = `%PDF-1.4 T14 ${process.pid} ${Date.now()}`;
// parentStudyId plus document ancestry: looks like session provenance, but real group copies match too.
const SESSION_LIKE_ANCESTRY = `
    SELECT DISTINCT copy."id"
    FROM "submission" AS copy
    JOIN "document" AS copy_document ON copy_document."submissionId" = copy."id"
    JOIN "study_step" AS child_step ON child_step."documentId" = copy_document."id"
    JOIN "study" AS child_study ON child_study."id" = child_step."studyId"
    JOIN "study_step" AS parent_step
      ON parent_step."studyId" = child_study."parentStudyId"
      AND parent_step."documentId" = copy_document."parentDocumentId"
    WHERE copy."parentSubmissionId" IS NOT NULL`;

/**
 * Remove the fixture PDFs and all their copies. Rolled-back copies have no document row left to find them by.
 */
function removeFixturePdfs() {
    for (const name of fs.readdirSync(FILES_DIR).filter((file) => file.endsWith(".pdf"))) {
        const file = path.join(FILES_DIR, name);
        if (fs.statSync(file).size === Buffer.byteLength(PDF_CONTENT) && fs.readFileSync(file, "utf8") === PDF_CONTENT) {
            fs.rmSync(file);
        }
    }
}

/**
 * Emit a socket event and wait for its acknowledgement.
 * @param {Object} socket connected client
 * @param {string} event socket event name
 * @param {Object} data event payload
 * @returns {Promise<{success: boolean, data: *, message: *}>}
 */
function request(socket, event, data) {
    return new Promise((resolve) => socket.emit(event, data, resolve));
}

/**
 * Bulk assignments end to end against the test database: a study-session assignment really copies
 * its submission, and those copies must not come back as candidates for a new assignment.
 */
describe("Test Websockets - Bulk assignments", () => {
    let server, models, sequelize, socket, adminId, workflowId, workflowStepId;

    /**
     * Create a study with its step from the test workflow.
     * @param {Object} overrides study attributes
     * @param {number|null} documentId document of the annotator step
     * @returns {Promise<Object>}
     */
    async function addStudy(overrides, documentId) {
        const study = {
            name: "T14 study",
            workflowId,
            userId: adminId,
            createdByUserId: adminId,
            resumable: true,
            ...overrides,
        };
        const stepDocuments = [{id: workflowStepId, documentId}];
        return await models.study.add(study, {context: {...study, stepDocuments}});
    }

    /**
     * Create a submission with one PDF document and that PDF's file on disk.
     * @param {number} userId owner
     * @returns {Promise<{submission: Object, document: Object}>}
     */
    async function addSubmission(userId) {
        const submission = await models.submission.add({userId, createdByUserId: adminId});
        const document = await models.document.add({
            name: "T14 document", type: 0, userId, submissionId: submission.id,
        });
        fs.writeFileSync(path.join(FILES_DIR, `${document.hash}.pdf`), PDF_CONTENT);
        return {submission, document};
    }

    /**
     * Create a user who can be picked as a reviewer.
     * @param {string} name unique user name
     * @returns {Promise<Object>}
     */
    async function addUser(name) {
        return await models.user.add({
            userName: name, firstName: name, lastName: "T14", email: `${name}@t14.example`,
        });
    }

    /**
     * Open one session per owner on a study.
     * @param {number} studyId study
     * @param {Array<number>} ownerIds session owner per session
     * @returns {Promise<Array<Object>>}
     */
    async function addSessions(studyId, ownerIds) {
        const sessions = [];
        for (const userId of ownerIds) {
            sessions.push(await models.study_session.add({studyId, userId}));
        }
        return sessions;
    }

    /**
     * Children of a submission, read straight from the table.
     * @param {number} parentSubmissionId parent
     * @returns {Promise<Array<Object>>}
     */
    async function childrenOf(parentSubmissionId) {
        return await sequelize.query(
            'SELECT * FROM "submission" WHERE "parentSubmissionId" = :parentSubmissionId ORDER BY id',
            {replacements: {parentSubmissionId}, type: sequelize.QueryTypes.SELECT},
        );
    }

    /**
     * Run a session_user bulk assignment that copies the session's submission.
     * @param {Object} params
     * @param {Object} params.template template study row
     * @param {Object} params.assignmentSelection study_session selection
     * @param {Array<number>} params.reviewerIds selected reviewers
     * @returns {Promise<Object>} socket acknowledgement
     */
    function createSessionUserBulk({template, assignmentSelection, reviewerIds}) {
        return request(socket, "assignmentCreateBulk", {
            template,
            mode: "session_user",
            assignmentType: "study_session",
            assignmentSelection,
            reviewerQuerySelection: {ids: reviewerIds},
            workflowMapping: {[workflowStepId]: workflowStepId},
        });
    }

    /**
     * Query the assignment submission picker.
     * @param {Object} [overrides] extra queryTable fields
     * @returns {Promise<{ids: number[], total: number}>}
     */
    async function queryPicker(overrides = {}) {
        const res = await request(socket, "queryTable", {
            table: "submission", scope: SCOPE, query: {limit: 500}, ...overrides,
        });
        expect(res.success).toBe(true);
        return {ids: res.data.items.map((item) => item.id), total: res.data.meta.total};
    }

    /**
     * Resolve a submission selection the way the wizard does before Distribution.
     * @param {Object} assignmentSelection BackendTable selection
     * @returns {Promise<Object>} socket acknowledgement
     */
    function resolveSubmissions(assignmentSelection) {
        return request(socket, "assignmentBulkResolveSelection", {
            assignmentType: "submission", assignmentSelection,
        });
    }

    beforeAll(async () => {
        server = new Server();
        server.start(PORT);
        models = server.db.models;
        sequelize = server.db.sequelize;
        // The first admin comes from the setup wizard, not from a migration.
        if (await models.user.getUserIdByEmail(process.env.ADMIN_EMAIL) === 0) {
            await createInitialAdmin(server, {
                userName: "admin", email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PWD,
            });
        }
        socket = await getSocketClient(server, PORT, process.env.ADMIN_EMAIL, process.env.ADMIN_PWD);
        adminId = (await models.user.findOne({where: {email: process.env.ADMIN_EMAIL}, raw: true})).id;
        // Other suites empty the seeded workflows, so this one brings its own.
        workflowId = (await models.workflow.add({name: "T14 workflow"})).id;
        workflowStepId = (await models.workflow_step.add({workflowId, stepType: 1})).id;
    }, SLOW);

    afterAll(async () => {
        socket.disconnect();
        removeFixturePdfs();
        await server.stop();
    });

    describe("session_user bulk: 3 sessions of 2 owners", () => {
        let ownerA, ownerB, source, template, sourceStudy, sessions, result, copies;

        beforeAll(async () => {
            ownerA = await addUser(`t14OwnerA${Date.now()}`);
            ownerB = await addUser(`t14OwnerB${Date.now()}`);
            source = await addSubmission(ownerA.id);
            template = await addStudy({name: "T14 template", template: true}, null);
            sourceStudy = await addStudy({name: "T14 source", userId: ownerA.id, limitSessionsPerUser: null}, source.document.id);
            sessions = await addSessions(sourceStudy.id, [ownerA.id, ownerA.id, ownerB.id]);
            result = await createSessionUserBulk({
                template,
                // Select-all: the client sends the query, not the rows.
                assignmentSelection: {
                    allMatching: true,
                    scope: {assignmentBulk: {workflowId}},
                    filter: [{key: "studyId", value: sourceStudy.id}],
                    excludeIds: [],
                },
                reviewerIds: [ownerA.id, ownerB.id],
            });
            copies = await childrenOf(source.submission.id);
        }, SLOW);

        test("creates one assignment per session, for that session's owner", async () => {
            expect(result).toHaveProperty("success", true);
            const created = await models.study.findAll({where: {parentStudyId: sourceStudy.id}, raw: true});
            expect(created).toHaveLength(sessions.length);

            const reviewers = await models.study_session.findAll({
                where: {studyId: created.map((study) => study.id)}, raw: true,
            });
            expect(reviewers.map((session) => session.userId).sort())
                .toEqual([ownerA.id, ownerA.id, ownerB.id].sort());
        });

        test("persists every session copy as hidden and keeps the original author", () => {
            expect(copies).toHaveLength(sessions.length);
            copies.forEach((copy) => {
                expect(copy.hideInFrontend).toBe(true);
                expect(copy.userId).toBe(ownerA.id);
            });
        });

        test("keeps a submission that was not copied by a session visible", async () => {
            const row = await models.submission.findByPk(source.submission.id, {raw: true});
            expect(row.hideInFrontend).toBe(false);
        });

        test("the picker lists and counts the source, not its copies", async () => {
            const {ids, total} = await queryPicker();
            expect(ids).toContain(source.submission.id);
            copies.forEach((copy) => expect(ids).not.toContain(copy.id));
            expect(total).toBe(ids.length);
        });

        test("select-all does not resolve copies, even without the client's scope", async () => {
            for (const scope of [SCOPE, null, {}]) {
                const res = await resolveSubmissions({allMatching: true, scope, excludeIds: []});
                expect(res.success).toBe(true);
                const ids = res.data.selectedAssignments.map((submission) => submission.id);
                expect(ids).toContain(source.submission.id);
                copies.forEach((copy) => expect(ids).not.toContain(copy.id));
            }
        });

        test("an explicit id cannot select a copy", async () => {
            const mixed = await resolveSubmissions({ids: [source.submission.id, copies[0].id]});
            expect(mixed.success).toBe(true);
            expect(mixed.data.selectedAssignments.map((submission) => submission.id))
                .toEqual([source.submission.id]);

            const onlyCopy = await resolveSubmissions({ids: [copies[0].id]});
            expect(onlyCopy.success).toBe(false);
        });

        test("bulk creation refuses a selection of only copies", async () => {
            const before = await models.study.count();
            const res = await request(socket, "assignmentCreateBulk", {
                template,
                mode: "reviewer",
                assignmentType: "submission",
                assignmentSelection: {ids: [copies[0].id]},
                reviewerQuerySelection: {ids: [ownerB.id]},
                reviewerSelection: {[ownerB.id]: 1},
            });
            expect(res.success).toBe(false);
            expect(await models.study.count()).toBe(before);
        });

        test("single creation refuses a copy sent by a client", async () => {
            const before = await models.study.count();
            const res = await request(socket, "assignmentCreateSingle", {
                template,
                assignmentType: "submission",
                selectedAssignments: [{id: copies[0].id, userId: copies[0].userId}],
                reviewer: [{id: ownerB.id}],
            });
            expect(res.success).toBe(false);
            expect(await models.study.count()).toBe(before);
        });

        test("hidden copies stay readable for the workflows that need them", async () => {
            const unscoped = await queryPicker({scope: null});
            copies.forEach((copy) => expect(unscoped.ids).toContain(copy.id));

            const root = await models.submission.getRootSubmission(copies[0]);
            expect(root.id).toBe(source.submission.id);

            const created = await models.study.findOne({where: {parentStudyId: sourceStudy.id}, raw: true});
            const steps = await models.study_step.findAll({where: {studyId: created.id}, raw: true});
            const stepDocument = await models.document.findByPk(
                steps.find((step) => step.workflowStepId === workflowStepId).documentId, {raw: true},
            );
            expect(copies.map((copy) => copy.id)).toContain(stepDocument.submissionId);
        });

        test("a session owner who was not selected is rejected and nothing is kept", async () => {
            const counts = async () => ({
                studies: await models.study.count(),
                submissions: await models.submission.count(),
                documents: await models.document.count(),
                copies: (await childrenOf(source.submission.id)).length,
                copiedDocuments: await models.document.count({where: {parentDocumentId: source.document.id}}),
            });
            const before = await counts();
            expect(before.copies).toBe(sessions.length);
            const res = await createSessionUserBulk({
                template,
                assignmentSelection: {
                    ids: sessions.map((session) => session.id),
                    scope: {assignmentBulk: {workflowId}},
                },
                reviewerIds: [ownerA.id],
            });
            expect(res.success).toBe(false);
            expect(await counts()).toEqual(before);
        });
    });

    describe("submission assignment", () => {
        let owner, reviewer, source, groupCopy, template;

        beforeAll(async () => {
            owner = await addUser(`t14SubOwner${Date.now()}`);
            reviewer = await addUser(`t14SubReviewer${Date.now()}`);
            source = await addSubmission(owner.id);
            template = await addStudy({name: "T14 submission template", template: true}, null);
            const res = await request(socket, "submissionAssignGroup", {
                group: 1, isCopied: true, submissionIds: [source.submission.id],
            });
            expect(res.success).toBe(true);
            groupCopy = (await childrenOf(source.submission.id))[0];
        }, SLOW);

        test("a copy made by group assignment is a real submission, not a hidden copy", async () => {
            expect(groupCopy.hideInFrontend).toBe(false);
            const {ids} = await queryPicker();
            expect(ids).toEqual(expect.arrayContaining([source.submission.id, groupCopy.id]));

            const res = await resolveSubmissions({ids: [groupCopy.id]});
            expect(res.success).toBe(true);
            expect(res.data.selectedAssignments.map((submission) => submission.id)).toEqual([groupCopy.id]);
        });

        test("manual distribution still assigns the owner's study to the reviewer", async () => {
            const res = await request(socket, "assignmentCreateBulk", {
                template,
                mode: "reviewer",
                assignmentType: "submission",
                assignmentSelection: {ids: [source.submission.id]},
                reviewerQuerySelection: {ids: [reviewer.id]},
                reviewerSelection: {[reviewer.id]: 1},
            });
            expect(res.success).toBe(true);

            const study = await models.study.findOne({
                where: {createdByUserId: adminId, userId: owner.id, template: false}, raw: true,
            });
            const [session] = await models.study_session.findAll({where: {studyId: study.id}, raw: true});
            expect(session.userId).toBe(reviewer.id);
        });

        test("manual distribution still refuses a self-review", async () => {
            const res = await request(socket, "assignmentCreateBulk", {
                template,
                mode: "reviewer",
                assignmentType: "submission",
                assignmentSelection: {ids: [source.submission.id]},
                reviewerQuerySelection: {ids: [owner.id]},
                reviewerSelection: {[owner.id]: 1},
            });
            expect(res.success).toBe(false);
        });

        test("single creation still accepts an eligible submission", async () => {
            const res = await request(socket, "assignmentCreateSingle", {
                template,
                assignmentType: "submission",
                selectedAssignments: [{id: source.submission.id, userId: owner.id}],
                reviewer: [{id: reviewer.id}],
            });
            expect(res.success).toBe(true);
        });

        test("a viewer without the bulk right cannot resolve a selection", async () => {
            const guest = await getSocketClient(server, PORT, process.env.GUEST_EMAIL, process.env.GUEST_PWD);
            try {
                const res = await request(guest, "assignmentBulkResolveSelection", {
                    assignmentType: "submission", assignmentSelection: {ids: [source.submission.id]},
                });
                expect(res.success).toBe(false);
            } finally {
                guest.disconnect();
            }
        });
    });

    describe("historical copies", () => {
        let owner, steps, template, editedCopy, replacedTemplateCopy, unmappedStepCopy, sessionCopy, unusedCopy, usedCopy;

        /**
         * Create a study on both steps of this block's workflow.
         * @param {Object} overrides study attributes
         * @param {Array<number|null>} documentIds document of each step
         * @returns {Promise<Object>}
         */
        async function addTwoStepStudy(overrides, documentIds) {
            const study = {
                name: "T14 history study",
                workflowId: steps.workflowId,
                userId: adminId,
                createdByUserId: adminId,
                resumable: true,
                ...overrides,
            };
            const stepDocuments = steps.ids.map((id, index) => ({id, documentId: documentIds[index]}));
            return await models.study.add(study, {context: {...study, stepDocuments}});
        }

        /**
         * Copy a new submission the way the group assignment does.
         * @returns {Promise<{source: Object, id: number, documentId: number}>} source and its group copy
         */
        async function addGroupCopy() {
            const source = await addSubmission(owner.id);
            const res = await request(socket, "submissionAssignGroup", {
                group: 1, isCopied: true, submissionIds: [source.submission.id],
            });
            expect(res.success).toBe(true);
            const {copiedSubmission, copiedDocuments} = res.data.copiedSubmissions[0];
            return {source, id: copiedSubmission.id, documentId: copiedDocuments[0].id};
        }

        /**
         * Assign a session of a new study back to its owner, copying the submission of the first step.
         * @param {Object} assignmentTemplate template study row
         * @param {Object} submissionFixture source submission
         * @returns {Promise<Array<Object>>} children of the source submission
         */
        async function assignSessionCopy(assignmentTemplate, submissionFixture) {
            const documentId = submissionFixture.document.id;
            const study = await addTwoStepStudy({limitSessionsPerUser: null}, [documentId, documentId]);
            const [session] = await addSessions(study.id, [adminId]);
            const res = await request(socket, "assignmentCreateBulk", {
                template: assignmentTemplate,
                mode: "session_user",
                assignmentType: "study_session",
                assignmentSelection: {ids: [session.id], scope: {assignmentBulk: {workflowId: steps.workflowId}}},
                reviewerQuerySelection: {ids: [adminId]},
                workflowMapping: {[steps.ids[0]]: steps.ids[0]},
            });
            expect(res.success).toBe(true);
            return await childrenOf(submissionFixture.submission.id);
        }

        const hidden = async (id) => (await models.submission.findByPk(id, {raw: true})).hideInFrontend;

        /**
         * The real paths that give a group copy the ancestry of a session copy, and a real session copy.
         * Migrating drops and adds the column, which is the state of data from before the flag existed.
         */
        beforeAll(async () => {
            owner = await addUser(`t14History${Date.now()}`);
            const historyWorkflowId = (await models.workflow.add({name: "T14 history workflow"})).id;
            const first = await models.workflow_step.add({workflowId: historyWorkflowId, stepType: 1});
            const second = await models.workflow_step.add({
                workflowId: historyWorkflowId, stepType: 1, workflowStepPrevious: first.id,
            });
            steps = {workflowId: historyWorkflowId, ids: [first.id, second.id]};
            template = await models.study.findByPk(
                (await addTwoStepStudy({name: "T14 history template", template: true}, [null, null])).id, {raw: true},
            );

            // Editing a study versions it: the group copy replaces its source on the new version.
            editedCopy = await addGroupCopy();
            const edited = await addTwoStepStudy({}, Array(2).fill(editedCopy.source.document.id));
            const row = await models.study.findByPk(edited.id, {raw: true});
            const update = await request(socket, "appDataUpdate", {
                table: "study",
                data: {
                    id: edited.id,
                    name: row.name,
                    workflowId: steps.workflowId,
                    description: "edited",
                    tagSetId: row.tagSetId || 1,
                    stepDocuments: steps.ids.map((id) => ({id, documentId: editedCopy.documentId})),
                },
            });
            expect(update.success).toBe(true);

            // Replacing a template points its new version at the group copy.
            replacedTemplateCopy = await addGroupCopy();
            const replaced = await addTwoStepStudy(
                {template: true}, Array(2).fill(replacedTemplateCopy.source.document.id),
            );
            const replacement = await request(socket, "studySaveAsTemplate", {
                onlyTemplate: true,
                replaceTemplateId: replaced.id,
                templateData: {
                    name: "T14 history replacement",
                    workflowId: steps.workflowId,
                    stepDocuments: steps.ids.map((id) => ({id, documentId: replacedTemplateCopy.documentId})),
                },
            });
            expect(replacement.success).toBe(true);

            // A session assignment keeps the template's document on a step that is not mapped.
            unmappedStepCopy = await addGroupCopy();
            const keepingTemplate = await addTwoStepStudy(
                {name: "T14 history keeping template", template: true}, [null, unmappedStepCopy.documentId],
            );
            await assignSessionCopy(
                await models.study.findByPk(keepingTemplate.id, {raw: true}), unmappedStepCopy.source,
            );

            // A session copy, whose flag is true until the column is rebuilt.
            const sessionCopies = await assignSessionCopy(template, await addSubmission(owner.id));
            expect(sessionCopies).toHaveLength(1);
            expect(sessionCopies[0].hideInFrontend).toBe(true);
            sessionCopy = sessionCopies[0];

            // A group copy that is not used, and one a submission assignment put on a study step.
            unusedCopy = await models.submission.copySubmission((await addSubmission(owner.id)).submission.id, adminId);
            usedCopy = await models.submission.copySubmission((await addSubmission(owner.id)).submission.id, adminId);
            await addTwoStepStudy({name: "T14 history assigned"}, Array(2).fill(usedCopy.copiedDocuments[0].id));

            const migration = require(HIDDEN_FLAG_MIGRATION);
            const queryInterface = sequelize.getQueryInterface();
            await migration.down(queryInterface, sequelize.constructor);
            await migration.up(queryInterface, sequelize.constructor);
        }, SLOW * 2);

        test("group and session copies have the same ancestry, so it cannot tell them apart", async () => {
            const rows = await sequelize.query(SESSION_LIKE_ANCESTRY, {type: sequelize.QueryTypes.SELECT});
            expect(rows.map((row) => row.id)).toEqual(expect.arrayContaining([
                editedCopy.id, replacedTemplateCopy.id, unmappedStepCopy.id, sessionCopy.id,
            ]));
        });

        test.each([
            ["a study edit", () => editedCopy.id],
            ["a template replacement", () => replacedTemplateCopy.id],
            ["an unmapped template step", () => unmappedStepCopy.id],
            ["no study", () => unusedCopy.copiedSubmission.id],
            ["a study step", () => usedCopy.copiedSubmission.id],
        ])("a group copy linked through %s stays visible and assignable", async (_, copyId) => {
            const id = copyId();
            expect(await hidden(id)).toBe(false);
            expect((await queryPicker()).ids).toContain(id);
            const res = await resolveSubmissions({ids: [id]});
            expect(res.success).toBe(true);
            expect(res.data.selectedAssignments.map((submission) => submission.id)).toEqual([id]);
        });

        test("a historical session copy stays visible, it needs a reviewed cleanup", async () => {
            expect(await hidden(sessionCopy.id)).toBe(false);
            expect((await queryPicker()).ids).toContain(sessionCopy.id);
        });

        test("the column is a required boolean that defaults to visible", async () => {
            const {hideInFrontend} = await sequelize.getQueryInterface().describeTable("submission");
            expect(hideInFrontend).toMatchObject({type: "BOOLEAN", allowNull: false, defaultValue: false});
        });

        test("a session copy made after the migration is hidden everywhere", async () => {
            const fixture = await addSubmission(owner.id);
            const [copy] = await assignSessionCopy(template, fixture);
            expect(copy.hideInFrontend).toBe(true);
            expect(await hidden(fixture.submission.id)).toBe(false);

            const {ids} = await queryPicker();
            expect(ids).toContain(fixture.submission.id);
            expect(ids).not.toContain(copy.id);

            const selectAll = await resolveSubmissions({allMatching: true, excludeIds: []});
            expect(selectAll.success).toBe(true);
            expect(selectAll.data.selectedAssignments.map((submission) => submission.id)).not.toContain(copy.id);

            expect((await resolveSubmissions({ids: [copy.id]})).success).toBe(false);

            const before = await models.study.count();
            const reviewer = await addUser(`t14HistoryReviewer${Date.now()}`);
            const bulk = await request(socket, "assignmentCreateBulk", {
                template,
                mode: "reviewer",
                assignmentType: "submission",
                assignmentSelection: {ids: [copy.id]},
                reviewerQuerySelection: {ids: [reviewer.id]},
                reviewerSelection: {[reviewer.id]: 1},
            });
            expect(bulk.success).toBe(false);
            const single = await request(socket, "assignmentCreateSingle", {
                template,
                assignmentType: "submission",
                selectedAssignments: [{id: copy.id, userId: copy.userId}],
                reviewer: [{id: reviewer.id}],
            });
            expect(single.success).toBe(false);
            expect(await models.study.count()).toBe(before);
        }, SLOW);

        test("a group copy made after the migration is visible", async () => {
            const {id} = await addGroupCopy();
            expect(await hidden(id)).toBe(false);
            expect((await queryPicker()).ids).toContain(id);
        });
    });
});
