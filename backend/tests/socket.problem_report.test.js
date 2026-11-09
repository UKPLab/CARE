const fs = require("fs");
const path = require("path");
const {randomUUID} = require("crypto");
const Server = require("../webserver/Server.js");
const {getSocketClient} = require("./utils.js");

const PORT = 3121;
const ATTACHMENT_PATH = path.join(__dirname, "..", "..", "files", "problem_reports");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

/**
 * Emit an event and resolve with the acknowledgement.
 * @param {Object} socket socket.io client
 * @param {string} event Event name
 * @param {Object} data Payload
 * @returns {Promise<Object>}
 */
const request = (socket, event, data) => new Promise((resolve) => socket.emit(event, data, resolve));

const report = (overrides = {}) => ({
    clientRequestId: randomUUID(),
    problemTypes: ["error", "slowOrStuck"],
    blocked: true,
    frequency: "sometimes",
    description: "The document does not load.",
    context: {
        page: "/document/abc?token=secret-reset-token",
        reportedAt: new Date().toISOString(),
        version: "dev: abc123",
        build: "development",
        browser: "Firefox 130",
        os: "Linux",
    },
    diagnostics: [{
        type: "failedOperation",
        time: new Date().toISOString(),
        event: "documentGet",
        key: "errors.documents.notFound",
        errorId: randomUUID(),
        message: "failed with password=hunter2",
    }],
    activity: [{
        type: "click",
        time: new Date().toISOString(),
        x: 120,
        y: 40,
        path: "/document/abc?token=secret-reset-token",
        element: {tag: "button", id: "private-id", className: "private-class", text: "Private draft"},
    }],
    ...overrides,
});

describe("Test Websockets - Problem reports", () => {
    let server;
    let guest;
    let admin;
    const createdIds = [];
    const originalSettings = {};

    /**
     * Change a problem report setting for the duration of the test file.
     * @param {string} key Setting key
     * @param {string} value Setting value
     * @returns {Promise<void>}
     */
    const setSetting = async (key, value) => {
        const model = server.db.models["setting"];
        if (!(key in originalSettings)) {
            originalSettings[key] = await model.get(key);
        }
        await model.update({value}, {where: {key}});
    };

    let guestUser;

    /**
     * Change the guest's usage statistics consent in the database (restored after the tests).
     * @param {boolean} acceptStats
     * @returns {Promise<void>}
     */
    const setGuestConsent = async (acceptStats) => {
        await server.db.models["user"].update({acceptStats}, {where: {id: guestUser.id}});
    };

    beforeAll(async () => {
        server = new Server();
        server.start(PORT);
        guest = await getSocketClient(server, PORT, process.env.GUEST_EMAIL, process.env.GUEST_PWD);
        admin = await getSocketClient(server, PORT, process.env.ADMIN_EMAIL, process.env.ADMIN_PWD);
        await setSetting("problemReport.reportsPerHour", "1000");
        guestUser = await server.db.models["user"].findOne({where: {email: process.env.GUEST_EMAIL}, raw: true});
    });

    afterAll(async () => {
        await setGuestConsent(guestUser.acceptStats);
        for (const [key, value] of Object.entries(originalSettings)) {
            await server.db.models["setting"].update({value}, {where: {key}});
        }
        const reports = await server.db.models["problem_report"].findAll({where: {id: createdIds}, raw: true});
        for (const row of reports) {
            (row.attachments || []).forEach((a) => fs.rmSync(path.join(ATTACHMENT_PATH, `${a.id}.${a.extension}`), {force: true}));
        }
        // Test rows only: remove them so reruns start from the same rate-limit state
        await server.db.models["problem_report"].destroy({where: {id: createdIds}});
        guest.disconnect();
        admin.disconnect();
        server.stop();
    });

    test("prepare returns the sanitized details and a server database snapshot without saving, even for an empty form", async () => {
        const before = await server.db.models["problem_report"].count();
        const {clientRequestId, context, diagnostics} = report();
        const response = await request(guest, "problemReportPrepare", {clientRequestId, context, diagnostics});
        expect(response.success).toBe(true);
        expect(response.data.context.page).toBe("/document/abc");
        expect(response.data.diagnostics[0].message).toBe("failed with password=[redacted]");
        expect(response.data).not.toHaveProperty("problemTypes");
        expect(["ok", "unavailable"]).toContain(response.data.databaseHealth.status);
        // Capacity and load figures stay on the server
        expect(response.data.databaseHealth.restricted).toBe(true);
        for (const field of ["pool", "connections", "locks", "deadlocks", "transactions", "cache"]) {
            expect(response.data.databaseHealth).not.toHaveProperty(field);
        }
        expect(response.data.databaseHealthExpiresInMs).toBeGreaterThan(0);
        const text = JSON.stringify(response.data.databaseHealth);
        expect(text).not.toMatch(/SELECT|client_addr|datname|"pid"/i);
        expect(await server.db.models["problem_report"].count()).toBe(before);

        const invalid = await request(guest, "problemReportPrepare", {context});
        expect(invalid.key).toBe("errors.problemReport.invalidRequest");
    });

    test("submit saves the database snapshot shown in the form, never one sent by the client", async () => {
        const payload = report();
        const prepared = await request(guest, "problemReportPrepare", payload);
        const spoofed = {status: "ok", connections: {total: 999999}, query: "SELECT secret"};
        const submitted = await request(guest, "problemReportSubmit", {...payload, databaseHealth: spoofed});
        expect(submitted.success).toBe(true);
        createdIds.push(submitted.data.id);
        const stored = await server.db.models["problem_report"].getById(submitted.data.id);
        expect(stored.databaseHealth.capturedAt).toBe(prepared.data.databaseHealth.capturedAt);
        expect(stored.databaseHealth.status).toBe(prepared.data.databaseHealth.status);
        expect(stored.databaseHealth).toHaveProperty("pool");
        expect(stored.databaseHealth).not.toHaveProperty("restricted");
        expect(JSON.stringify(stored.databaseHealth)).not.toContain("999999");
        // The automatic details are stored exactly as shown
        expect(stored.context).toEqual(prepared.data.context);
        expect(stored.diagnostics).toEqual(prepared.data.diagnostics);
        expect(stored.activity).toEqual(prepared.data.activity);
    });

    test("activity is kept only while the user agrees to usage statistics, checked on the server", async () => {
        await setGuestConsent(true);
        const consented = report();
        const prepared = await request(guest, "problemReportPrepare", consented);
        expect(prepared.data.activity.status).toBe("included");
        expect(prepared.data.activity.entries[0]).toEqual({
            type: "click",
            time: consented.activity[0].time,
            x: 120,
            y: 40,
            path: "/document/abc",
            element: {tag: "button"},
        });
        const saved = await request(guest, "problemReportSubmit", consented);
        createdIds.push(saved.data.id);
        const stored = await server.db.models["problem_report"].getById(saved.data.id);
        expect(stored.activity.entries).toHaveLength(1);
        expect(JSON.stringify(stored.activity)).not.toMatch(/private|Private draft|token/);

        // Consent withdrawn after the form was opened: the activity is dropped on submit
        const withdrawn = report();
        await request(guest, "problemReportPrepare", withdrawn);
        await setGuestConsent(false);
        const dropped = await request(guest, "problemReportSubmit", withdrawn);
        createdIds.push(dropped.data.id);
        const storedWithout = await server.db.models["problem_report"].getById(dropped.data.id);
        expect(storedWithout.activity).toEqual({status: "noConsent", entries: []});

        const notConsented = await request(guest, "problemReportPrepare", {...report(), acceptStats: true});
        expect(notConsented.data.activity).toEqual({status: "noConsent", entries: []});
    });

    test("database health and activity can be turned off in the settings", async () => {
        await setGuestConsent(true);
        await setSetting("problemReport.databaseHealth.enabled", "false");
        await setSetting("problemReport.activity.enabled", "false");
        try {
            const payload = report();
            const prepared = await request(guest, "problemReportPrepare", payload);
            expect(prepared.data.databaseHealth).toBeNull();
            expect(prepared.data.databaseHealthExpiresInMs).toBeNull();
            expect(prepared.data.activity).toEqual({status: "disabled", entries: []});
            const saved = await request(guest, "problemReportSubmit", payload);
            createdIds.push(saved.data.id);
            const stored = await server.db.models["problem_report"].getById(saved.data.id);
            expect(stored.databaseHealth).toBeNull();
            expect(stored.activity.status).toBe("disabled");

            const config = await request(guest, "problemReportConfig", {});
            expect(config.data.databaseHealthEnabled).toBe(false);
            expect(config.data).not.toHaveProperty("databaseHealthTimeoutMs");
        } finally {
            await setSetting("problemReport.databaseHealth.enabled", "true");
            await setSetting("problemReport.activity.enabled", "true");
        }
    });

    test("submit saves the report with attachment, and a repeated submit returns the same report", async () => {
        const payload = report({attachments: [{name: "screen.png", file: PNG}]});
        const first = await request(guest, "problemReportSubmit", payload);
        expect(first.success).toBe(true);
        expect(first.data.duplicate).toBe(false);
        createdIds.push(first.data.id);

        const second = await request(guest, "problemReportSubmit", payload);
        expect(second.success).toBe(true);
        expect(second.data).toEqual({id: first.data.id, duplicate: true});
        expect(await server.db.models["problem_report"].count({where: {clientRequestId: payload.clientRequestId}})).toBe(1);

        const stored = await server.db.models["problem_report"].getById(first.data.id);
        expect(stored.userId).not.toBeNull();
        expect(stored.context.page).toBe("/document/abc");
        expect(JSON.stringify(stored)).not.toContain("hunter2");
        expect(JSON.stringify(stored)).not.toContain("secret-reset-token");
        expect(stored.attachments).toHaveLength(1);
        expect(stored.attachments[0]).toMatchObject({name: "screen.png", mimeType: "image/png", size: PNG.length});
    });

    test("reports submit without diagnostics", async () => {
        const response = await request(guest, "problemReportSubmit", report({diagnostics: undefined}));
        expect(response.success).toBe(true);
        createdIds.push(response.data.id);
        const stored = await server.db.models["problem_report"].getById(response.data.id);
        expect(stored.diagnostics).toEqual([]);
    });

    test("concurrent retries return the same report", async () => {
        const payload = report();
        const results = await Promise.all(Array.from({length: 3}, () => request(guest, "problemReportSubmit", payload)));
        expect(results.every((result) => result.success)).toBe(true);
        const ids = results.map((result) => result.data.id);
        createdIds.push(...new Set(ids));
        expect(new Set(ids).size).toBe(1);
        expect(results.filter((result) => !result.data.duplicate)).toHaveLength(1);
    });

    test("the form receives effective settings including safety caps and fallback choices", async () => {
        await setSetting("problemReport.problemTypes", "Connection/problem");
        await setSetting("problemReport.attachments.maxCount", "100");
        try {
            const response = await request(guest, "problemReportConfig", {});
            expect(response.success).toBe(true);
            expect(response.data.problemTypes).toContain("error");
            expect(response.data.problemTypes).not.toContain("Connection/problem");
            expect(response.data.attachmentsMaxCount).toBe(20);
            expect(response.data.maxFileSizeMb * 1024 * 1024).toBe(response.data.attachmentsMaxFileBytes);
        } finally {
            await setSetting("problemReport.problemTypes", originalSettings["problemReport.problemTypes"]);
            await setSetting("problemReport.attachments.maxCount", originalSettings["problemReport.attachments.maxCount"]);
        }
    });

    test("concurrent submissions cannot exceed the hourly limit", async () => {
        const reporter = await server.db.models["problem_report"].findByPk(createdIds[0]);
        const before = await server.db.models["problem_report"].countSince(reporter.userId, new Date(Date.now() - 60 * 60 * 1000));
        await setSetting("problemReport.reportsPerHour", String(before + 1));
        try {
            const results = await Promise.all(Array.from({length: 3}, () => request(guest, "problemReportSubmit", report())));
            const accepted = results.filter((result) => result.success);
            createdIds.push(...accepted.map((result) => result.data.id));
            expect(accepted).toHaveLength(1);
            expect(results.filter((result) => result.key === "errors.problemReport.rateLimited")).toHaveLength(2);
        } finally {
            await setSetting("problemReport.reportsPerHour", "1000");
        }
    });

    test("invalid input is rejected with a translatable error and a correlation id", async () => {
        const missing = await request(guest, "problemReportSubmit", report({description: " "}));
        expect(missing.success).toBe(false);
        expect(missing.key).toBe("errors.problemReport.descriptionRequired");
        expect(missing.errorId).toMatch(/^[0-9a-f-]{36}$/);

        const fake = await request(guest, "problemReportSubmit", report({attachments: [{name: "x.png", file: Buffer.from("<svg/>")}]}));
        expect(fake.key).toBe("errors.problemReport.unsupportedAttachmentType");

        const types = await request(guest, "problemReportSubmit", report({problemTypes: ["notConfigured"]}));
        expect(types.key).toBe("errors.problemReport.problemTypeRequired");
    });

    test("a failed submit does not keep files or rows", async () => {
        const before = fs.existsSync(ATTACHMENT_PATH) ? fs.readdirSync(ATTACHMENT_PATH).length : 0;
        const payload = report({attachments: [{name: "a.png", file: PNG}, {name: "b.txt", file: Buffer.from("text")}]});
        const response = await request(guest, "problemReportSubmit", payload);
        expect(response.success).toBe(false);
        expect(fs.existsSync(ATTACHMENT_PATH) ? fs.readdirSync(ATTACHMENT_PATH).length : 0).toBe(before);
        expect(await server.db.models["problem_report"].count({where: {clientRequestId: payload.clientRequestId}})).toBe(0);
    });

    test("configured limits from settings are enforced on the server", async () => {
        await setSetting("problemReport.attachments.maxCount", "1");
        const tooMany = await request(guest, "problemReportSubmit", report({attachments: [{file: PNG}, {file: PNG}]}));
        expect(tooMany.key).toBe("errors.problemReport.tooManyAttachments");
        expect(tooMany.params).toEqual({max: 1});
        await setSetting("problemReport.attachments.maxCount", "5");

        // The guest already submitted reports in this hour, so a limit of 1 is reached
        await setSetting("problemReport.reportsPerHour", "1");
        const limited = await request(guest, "problemReportSubmit", report());
        expect(limited.key).toBe("errors.problemReport.rateLimited");
        await setSetting("problemReport.reportsPerHour", "1000");
    });

    test("disabled reports cannot be previewed or submitted", async () => {
        await setSetting("problemReport.enabled", "false");
        const preview = await request(guest, "problemReportPrepare", report());
        const submit = await request(guest, "problemReportSubmit", report());
        await setSetting("problemReport.enabled", "true");
        expect(preview.key).toBe("errors.problemReport.disabled");
        expect(submit.key).toBe("errors.problemReport.disabled");
    });

    test("only administrators can list reports and read attachments", async () => {
        const created = await request(guest, "problemReportSubmit", report({attachments: [{name: "shot.png", file: PNG}]}));
        createdIds.push(created.data.id);
        const stored = await server.db.models["problem_report"].getById(created.data.id);
        const attachmentId = stored.attachments[0].id;

        const guestList = await request(guest, "problemReportGetAll", {page: 0, limit: 10});
        expect(guestList.key).toBe("errors.problemReport.noAccess");
        const guestFile = await request(guest, "problemReportAttachmentGet", {reportId: created.data.id, attachmentId});
        expect(guestFile.key).toBe("errors.problemReport.noAccess");

        const list = await request(admin, "problemReportGetAll", {page: 0, limit: 500});
        expect(list.success).toBe(true);
        const row = list.data.rows.find((r) => r.id === created.data.id);
        expect(row).toBeDefined();
        expect(row).not.toHaveProperty("clientRequestId");
        expect(row.creator_name).toBeTruthy();
        expect(list.data.rows.length).toBeLessThanOrEqual(100);

        const file = await request(admin, "problemReportAttachmentGet", {reportId: created.data.id, attachmentId});
        expect(file.success).toBe(true);
        expect(file.data.mimeType).toBe("image/png");
        expect(Buffer.from(file.data.file).equals(PNG)).toBe(true);

        const traversal = await request(admin, "problemReportAttachmentGet", {reportId: created.data.id, attachmentId: "../../package"});
        expect(traversal.key).toBe("errors.problemReport.attachmentNotFound");
        const otherReport = await request(admin, "problemReportAttachmentGet", {reportId: createdIds[0] === created.data.id ? -1 : createdIds[1], attachmentId});
        expect(otherReport.key).toBe("errors.problemReport.attachmentNotFound");
    });
});
