/**
 * Assignment-picker filters evaluated by PostgreSQL against isolated fixture rows.
 * Uses the real submission model's filter specification and shared WHERE builder.
 * No application rows are created, modified, or deleted.
 */
jest.mock("uuid", () => {
    const {randomUUID} = require("crypto");
    return {v1: randomUUID, v4: randomUUID};
});
jest.mock(require.resolve("uuid", {paths: [require.resolve("sequelize")]}), () => {
    const {randomUUID} = require("crypto");
    return {v1: randomUUID, v4: randomUUID};
});

const {Op} = require("sequelize");
const db = require("../db");
const Socket = require("../webserver/Socket");
const {buildQueryTableColumnFilters} = require("../utils/helper/queryTableColumnFilters");

describe("Assignment filtering in the submission picker", () => {
    const model = db.models.submission;
    let filterSpec;

    beforeAll(async () => {
        filterSpec = await model.getQueryTableFilterColumns();
    });

    afterAll(async () => {
        await db.sequelize.close();
    });

    async function query(columnFilters, {limit = 100, offset = 0, readable = true} = {}) {
        const allowedAttributeNames = readable ? Object.keys(model.getAttributes()) : ["id"];
        const filters = buildQueryTableColumnFilters({model, columnFilters, filterSpec, allowedAttributeNames});
        const where = {[Op.and]: [{deleted: false}, ...(filters ? [filters] : [])]};
        const sql = db.sequelize.getQueryInterface().queryGenerator.getWhereConditions(where, "submission");
        // Same display name deliberately belongs to two different assignment IDs.
        const [rows] = await db.sequelize.query(`
            WITH "submission" ("id", "assignmentId", "deleted", "name") AS (
                VALUES (1, 10, false, 'Draft'), (2, 20, false, 'Draft'),
                       (3, 30, false, 'Final'), (4, NULL, false, 'Legacy'),
                       (5, 10, false, 'Draft'), (6, 10, true, 'Deleted')
            )
            SELECT "id", COUNT(*) OVER ()::int AS "total"
            FROM "submission" WHERE ${sql}
            ORDER BY "id" LIMIT :limit OFFSET :offset
        `, {replacements: {limit, offset}});
        return rows;
    }

    test("matches one assignment by ID and keeps the existing deleted-row scope", async () => {
        expect(await query({assignmentId: {operator: "%", value: 10}})).toEqual([
            {id: 1, total: 2}, {id: 5, total: 2},
        ]);
    });

    test("matches any selected assignment, including assignments with identical names", async () => {
        expect(await query({assignmentId: {operator: "%", value: [10, 20]}})).toEqual([
            {id: 1, total: 3}, {id: 2, total: 3}, {id: 5, total: 3},
        ]);
    });

    test("accepts string IDs serialized by the filter UI without substring matching", async () => {
        expect(await query({assignmentId: {operator: "%", value: ["10"]}})).toEqual([
            {id: 1, total: 2}, {id: 5, total: 2},
        ]);
        expect(await query({assignmentId: {operator: "%", value: 1}})).toEqual([]);
    });

    test("combines the assignment filter with other column filters", async () => {
        expect(await query({
            assignmentId: {operator: "%", value: [10, 20]},
            id: {operator: ">", value: 1},
        })).toEqual([{id: 2, total: 2}, {id: 5, total: 2}]);
    });

    test("pagination retains the matching count across all matching pages", async () => {
        const filter = {assignmentId: {operator: "%", value: [10, 20]}};
        expect(await query(filter, {limit: 1, offset: 0})).toEqual([{id: 1, total: 3}]);
        expect(await query(filter, {limit: 1, offset: 1})).toEqual([{id: 2, total: 3}]);
        expect(await query(filter, {limit: 1, offset: 2})).toEqual([{id: 5, total: 3}]);
        expect((await query(filter)).map(row => row.id)).toEqual([1, 2, 5]);
    });

    test("clearing restores submissions without an assignment while retaining other filters", async () => {
        expect((await query({})).map(row => row.id)).toEqual([1, 2, 3, 4, 5]);
        expect((await query({id: {operator: ">", value: 3}})).map(row => row.id)).toEqual([4, 5]);
    });

    test("does not apply a filter on an assignment field the viewer cannot read", async () => {
        expect((await query({assignmentId: {operator: "%", value: 10}}, {readable: false}))
            .map(row => row.id)).toEqual([1, 2, 3, 4, 5]);
    });

    test("document enrichment resolves assignment IDs through submissions without replacing document names", async () => {
        const transaction = await db.sequelize.transaction();
        try {
            await db.sequelize.query(`
                CREATE TEMP TABLE "submission" (
                    "id" INTEGER, "assignmentId" INTEGER, "deleted" BOOLEAN
                ) ON COMMIT DROP;
                INSERT INTO "submission" VALUES
                    (1,10,false), (2,20,false), (3,NULL,false), (4,30,true);
            `, {transaction});
            const socket = Object.create(Socket.prototype);
            socket.models = db.models;
            const rows = await socket.handleInjections([{
                type: "parent", table: "submission", by: "submissionId", fields: ["assignmentId"],
            }], [
                {id: 11, name: "First.pdf", submissionId: 1},
                {id: 12, name: "Second.pdf", submissionId: 2},
                {id: 13, name: "Legacy.pdf", submissionId: null},
                {id: 14, name: "Unassigned.pdf", submissionId: 3},
                {id: 15, name: "Deleted parent.pdf", submissionId: 4},
                {id: 16, name: "Missing parent.pdf", submissionId: 999},
            ], transaction);
            expect(rows.map(row => [row.id, row.name, row.assignmentId])).toEqual([
                [11, "First.pdf", 10], [12, "Second.pdf", 20],
                [13, "Legacy.pdf", null], [14, "Unassigned.pdf", null],
                [15, "Deleted parent.pdf", null], [16, "Missing parent.pdf", null],
            ]);
        } finally {
            await transaction.rollback();
        }
    });

    test("the real selection resolver respects assignment filters, exclusions, explicit picks, and search", async () => {
        const transaction = await db.sequelize.transaction();
        try {
            // A connection-local temporary table shadows the application table only in this
            // transaction. The resolver still executes real model queries against PostgreSQL.
            await db.sequelize.query(`
                CREATE TEMP TABLE "submission" (
                    "id" INTEGER, "assignmentId" INTEGER, "deleted" BOOLEAN
                ) ON COMMIT DROP;
                INSERT INTO "submission" VALUES
                    (1,10,false), (2,20,false), (3,30,false),
                    (4,NULL,false), (5,10,false), (6,10,true);
            `, {transaction});
            const socket = Object.create(Socket.prototype);
            socket.models = {submission: model};
            socket.userId = 1;
            // Supply the authenticated viewer's readable fields at the ACL boundary;
            // scope construction, filtering, search, and ID resolution remain real.
            socket.getReadFilter = async (_userId, filter) => ({
                accessAllowed: true, filter, attributes: ["id", "assignmentId", "deleted"],
            });
            socket.hasAccess = async () => false;
            const selection = {
                allMatching: true,
                ids: [3],
                query: {columnFilters: {assignmentId: {operator: "%", value: [10, 20]}}},
            };
            expect(await socket.resolveSelectionIds("submission", selection, transaction)).toEqual([1, 2, 5]);
            expect(await socket.resolveSelectionIds("submission", {
                ...selection, excludeIds: [2],
            }, transaction)).toEqual([1, 5]);
            expect(await socket.resolveSelectionIds("submission", {
                ...selection, allMatching: false, ids: [1, 3, 4, 6],
            }, transaction)).toEqual([1]);
            expect(await socket.resolveSelectionIds("submission", {
                ...selection, query: {...selection.query, search: "5", searchColumns: ["id"]},
            }, transaction)).toEqual([5]);
        } finally {
            await transaction.rollback();
        }
    });
});
