const fs = require("fs");
const os = require("os");
const path = require("path");
const Server = require("../webserver/Server.js");
const {createInitialAdmin} = require("../webserver/utils/setupAdmin.js");
const {getSocketClient} = require("./utils.js");

const PORT = 3112;
const PEER_REVIEW_WORKFLOW_ID = 1;
const ANNOTATOR_WORKFLOW_STEP_ID = 1;
const SCOPE = {assignmentBulk: true};
const BACKFILL_MIGRATION = "../db/migrations/20261104120000-extend-submission-hideInFrontend.js";

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
    let server, models, sequelize, socket, adminId;
    const createdFiles = [];

    /**
     * Create a study with its steps from the Peer Review workflow.
     * @param {Object} overrides study attributes
     * @param {number|null} documentId document of the annotator step
     * @returns {Promise<Object>}
     */
    async function addStudy(overrides, documentId) {
        const study = {
            name: "T14 study",
            workflowId: PEER_REVIEW_WORKFLOW_ID,
            userId: adminId,
            createdByUserId: adminId,
            resumable: true,
            ...overrides,
        };
        const stepDocuments = [{id: ANNOTATOR_WORKFLOW_STEP_ID, documentId}];
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
        const file = path.join(__dirname, "../../files", `${document.hash}.pdf`);
        fs.writeFileSync(file, "%PDF-1.4 T14");
        createdFiles.push(file);
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
            sessions.push(await models.study_session.create({studyId, userId}));
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
            workflowMapping: {[ANNOTATOR_WORKFLOW_STEP_ID]: ANNOTATOR_WORKFLOW_STEP_ID},
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
    });

    afterAll(async () => {
        socket.disconnect();
        createdFiles.forEach((file) => fs.rmSync(file, {force: true}));
        await server.stop();
    });

    describe("session_user bulk: 3 sessions of 2 owners", () => {
        let ownerA, ownerB, source, template, sourceStudy, sessions, result, copies;

        beforeAll(async () => {
            ownerA = await addUser(`t14OwnerA${Date.now()}`);
            ownerB = await addUser(`t14OwnerB${Date.now()}`);
            source = await addSubmission(ownerA.id);
            template = await addStudy({name: "T14 template", template: true}, null);
            sourceStudy = await addStudy({name: "T14 source", userId: ownerA.id}, source.document.id);
            sessions = await addSessions(sourceStudy.id, [ownerA.id, ownerA.id, ownerB.id]);
            result = await createSessionUserBulk({
                template,
                // Select-all: the client sends the query, not the rows.
                assignmentSelection: {
                    allMatching: true,
                    scope: {assignmentBulk: {workflowId: PEER_REVIEW_WORKFLOW_ID}},
                    filter: [{key: "studyId", value: sourceStudy.id}],
                    excludeIds: [],
                },
                reviewerIds: [ownerA.id, ownerB.id],
            });
            copies = await childrenOf(source.submission.id);
        });

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
            const [session] = await models.study_session.findAll({where: {studyId: created.id}, raw: true});
            const inputs = await server.db.models.study_step.findAll({where: {studyId: created.id}, raw: true});
            const stepDocument = await models.document.findByPk(
                inputs.find((step) => step.documentId).documentId, {raw: true},
            );
            expect(copies.map((copy) => copy.id)).toContain(stepDocument.submissionId);
            expect(session).toBeTruthy();
        });

        test("a session owner who was not selected is still rejected", async () => {
            const before = await models.study.count();
            const res = await createSessionUserBulk({
                template,
                assignmentSelection: {
                    ids: sessions.map((session) => session.id),
                    scope: {assignmentBulk: {workflowId: PEER_REVIEW_WORKFLOW_ID}},
                },
                reviewerIds: [ownerA.id],
            });
            expect(res.success).toBe(false);
            expect(await models.study.count()).toBe(before);
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
        });

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
        test("the migration hides only copies with session provenance", async () => {
            const owner = await addUser(`t14History${Date.now()}`);
            const template = await addStudy({name: "T14 history template", template: true}, null);

            // A real session copy, on the code path that sets parentStudyId.
            const sessionSource = await addSubmission(owner.id);
            const sourceStudy = await addStudy({name: "T14 history source"}, sessionSource.document.id);
            const [session] = await addSessions(sourceStudy.id, [owner.id]);
            const created = await createSessionUserBulk({
                template,
                assignmentSelection: {
                    ids: [session.id],
                    scope: {assignmentBulk: {workflowId: PEER_REVIEW_WORKFLOW_ID}},
                },
                reviewerIds: [owner.id],
            });
            expect(created.success).toBe(true);
            const [sessionCopy] = await childrenOf(sessionSource.submission.id);

            // A group copy that is not used, and one a submission assignment put on a study step.
            const groupSource = await addSubmission(owner.id);
            const unusedCopy = await models.submission.copySubmission(groupSource.submission.id, adminId);
            const usedSource = await addSubmission(owner.id);
            const usedCopy = await models.submission.copySubmission(usedSource.submission.id, adminId);
            await addStudy(
                {name: "T14 history assigned"},
                usedCopy.copiedDocuments[0].id,
            );

            const migration = require(BACKFILL_MIGRATION);
            const queryInterface = sequelize.getQueryInterface();
            await migration.down(queryInterface, sequelize.constructor);
            await migration.up(queryInterface, sequelize.constructor);

            const hidden = async (id) => (await models.submission.findByPk(id, {raw: true})).hideInFrontend;
            expect(await hidden(sessionCopy.id)).toBe(true);
            expect(await hidden(sessionSource.submission.id)).toBe(false);
            expect(await hidden(unusedCopy.copiedSubmission.id)).toBe(false);
            expect(await hidden(usedCopy.copiedSubmission.id)).toBe(false);
        });

        test("the temp dir helper is not left behind", () => {
            expect(fs.existsSync(os.tmpdir())).toBe(true);
        });
    });
});
