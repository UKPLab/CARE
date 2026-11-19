require("./reportTestSetup");
const {Op, Sequelize, DataTypes} = require("sequelize");
const ProblemReportSocket = require("../webserver/sockets/problem_report");

describe("report export cursor", () => {
    const sequelize = new Sequelize("postgres://postgres@localhost/unused", {logging: false});
    const model = require("../db/models/problem_report")(sequelize, DataTypes);

    test("new submissions cannot shift subsequent pages or remove original rows", async () => {
        const original = Array.from({length: 200}, (_, i) => ({id: 200 - i}));
        const stored = [...original];
        model.findAll = jest.fn(async ({where, limit}) => stored
            .filter((row) => !where.id || row.id < where.id[Op.lt]).slice(0, limit));
        const first = await model.getExportPage(null, 100);
        stored.unshift({id: 201});
        const second = await model.getExportPage(first.nextCursor, 100);
        expect([...first.rows, ...second.rows]).toEqual(original);
        expect(second.nextCursor).toBeNull();
    });

    test("empty exports terminate immediately", async () => {
        model.findAll = jest.fn(async () => []);
        await expect(model.getExportPage(null, 100)).resolves.toEqual({rows: [], nextCursor: null});
    });

    test("export pages require administrator access", async () => {
        const context = {isAdmin: async () => false};
        await expect(ProblemReportSocket.prototype.getExportPage.call(context, {}, {}))
            .rejects.toThrow("errors.problemReport.noAccess");
    });

    test.each([0, -1, "42", 1.5])("rejects invalid cursor %s", async (beforeId) => {
        await expect(ProblemReportSocket.prototype.getExportPage.call({isAdmin: async () => true}, {beforeId}, {}))
            .rejects.toThrow("errors.problemReport.invalidRequest");
    });

    test("admin export keeps its cursor and normalizes legacy filenames", async () => {
        const context = {
            isAdmin: async () => true,
            models: {problem_report: {getExportPage: async () => ({
                rows: [{id: 42, clientRequestId: "retry", attachments: [{name: "old.html", extension: "png"}]}],
                nextCursor: 42,
            })}},
            updateCreatorName: async (rows) => rows.map((row) => ({...row, creator_name: "Reporter"})),
        };
        const result = await ProblemReportSocket.prototype.getExportPage.call(context, {}, {});
        expect(result.nextCursor).toBe(42);
        expect(result.rows[0].creator_name).toBe("Reporter");
        expect(result.rows[0].attachments[0].name).toBe("old.png");
        expect(result.rows[0]).not.toHaveProperty("clientRequestId");
    });
});
