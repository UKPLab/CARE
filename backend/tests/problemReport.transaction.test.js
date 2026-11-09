const fs = require("fs");
const os = require("os");
const path = require("path");
const {randomUUID} = require("crypto");
const ProblemReportSocket = require("../webserver/sockets/problem_report");
const {loadReportSettings} = require("../utils/helper/problemReport");
const report = (values = {}) => ({problemTypes: ["error"], description: "The page hangs", clientRequestId: randomUUID(), ...values});
const {databaseHealthCache} = require("../utils/helper/problemReportHealthCache.js");

/**
 * Socket stand-in whose transaction runs saveReport and then fails or succeeds.
 * @param {Object} overrides
 * @returns {Object}
 */
const handler = (overrides = {}) => ({
    userId: 7,
    getEnabledReportSettings: async () => loadReportSettings(async () => null),
    models: {problem_report: {getByClientRequestId: async () => null}},
    databaseHealthForSubmit: ProblemReportSocket.prototype.databaseHealthForSubmit,
    captureDatabaseHealth: async () => ({status: "ok", capturedAt: "fresh"}),
    server: {db: {sequelize: {transaction: async (callback) => callback({})}}},
    ...overrides,
});

test("a failed database commit removes attachments written by the handler", async () => {
    const attachment = path.join(os.tmpdir(), `care-report-${randomUUID()}`);
    const context = handler({
        server: {db: {sequelize: {
            transaction: async (callback) => {
                await callback({});
                throw new Error("Commit failed");
            },
        }}},
        saveReport: async (_data, _options, written) => {
            fs.writeFileSync(attachment, "attachment");
            written.push(attachment);
            return {id: 1};
        },
    });
    try {
        await expect(ProblemReportSocket.prototype.submitReport.call(context, report(), {})).rejects.toThrow("Commit failed");
        expect(fs.existsSync(attachment)).toBe(false);
    } finally {
        fs.rmSync(attachment, {force: true});
    }
});

test("submit saves the snapshot shown in the form, keeps it after a failure and drops it after success", async () => {
    const clientRequestId = randomUUID();
    const shown = {status: "ok", capturedAt: "when the form opened"};
    databaseHealthCache.set(7, clientRequestId, shown, 60000);
    const saved = [];
    let fail = true;
    const context = handler({
        saveReport: async (_data, options) => {
            saved.push(options.databaseHealth);
            if (fail) throw new Error("Rate limited");
            return {id: 2};
        },
    });

    await expect(ProblemReportSocket.prototype.submitReport.call(context, report({clientRequestId}), {})).rejects.toThrow("Rate limited");
    // A retry still saves the snapshot the user saw
    fail = false;
    await ProblemReportSocket.prototype.submitReport.call(context, report({clientRequestId}), {});
    expect(saved).toEqual([shown, shown]);
    expect(databaseHealthCache.get(7, clientRequestId)).toBeNull();

    // Another user's form id never reuses this user's snapshot; without one a fresh snapshot is taken
    databaseHealthCache.set(8, clientRequestId, {status: "ok", capturedAt: "other user"}, 60000);
    await ProblemReportSocket.prototype.submitReport.call(context, report({clientRequestId}), {});
    expect(saved[2]).toEqual({status: "ok", capturedAt: "fresh"});
    databaseHealthCache.delete(8, clientRequestId);
});

test("database health is not captured when turned off", async () => {
    let captured = false;
    const saved = [];
    const context = handler({
        getEnabledReportSettings: async () => ({...await loadReportSettings(async () => null), databaseHealthEnabled: false}),
        captureDatabaseHealth: async () => {
            captured = true;
            return {};
        },
        saveReport: async (_data, options) => {
            saved.push(options.databaseHealth);
            return {id: 3};
        },
    });
    await ProblemReportSocket.prototype.submitReport.call(context, report(), {});
    expect(captured).toBe(false);
    expect(saved).toEqual([null]);
});

test("a missing displayed snapshot requires review instead of silently replacing it", async () => {
    const capture = jest.fn();
    const context = handler({captureDatabaseHealth: capture});
    await expect(context.databaseHealthForSubmit(randomUUID(), {databaseHealthEnabled: true}, "shown-at"))
        .rejects.toMatchObject({key: "errors.problemReport.detailsExpired"});
    expect(capture).not.toHaveBeenCalled();
});

test("invalid submissions cannot trigger a database health query", async () => {
    const capture = jest.fn();
    const context = handler({captureDatabaseHealth: capture});
    const results = await Promise.allSettled(Array.from({length: 8}, () =>
        ProblemReportSocket.prototype.submitReport.call(context, report({description: ""}), {})));
    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect(capture).not.toHaveBeenCalled();
});

test("a retry returns the stored report even after its displayed snapshot was discarded", async () => {
    const capture = jest.fn();
    const context = handler({models: {problem_report: {getByClientRequestId: async () => ({id: 123})}}, captureDatabaseHealth: capture});
    await expect(ProblemReportSocket.prototype.submitReport.call(context, report({databaseHealthCapturedAt: "old"}), {}))
        .resolves.toEqual({id: 123, duplicate: true});
    expect(capture).not.toHaveBeenCalled();
});
