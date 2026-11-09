const {
    HARD_LIMITS,
    detectAttachmentType,
    sanitizeText,
    loadReportSettings,
    normalizeReport,
    validateAttachments,
    validateClientRequestId,
} = require("../utils/helper/problemReport.js");

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(8)]);
const MB = 1024 * 1024;

/**
 * Settings with all defaults, optionally overriding raw setting values.
 * @param {Object} values Raw setting values keyed without the "problemReport." prefix
 * @returns {Promise<Object>}
 */
const settingsWith = (values = {}) => loadReportSettings(async (key) => {
    const short = key.replace("problemReport.", "");
    return short in values ? values[short] : null;
});

const validReport = (overrides = {}) => ({
    problemTypes: ["error"],
    description: "Saving fails",
    context: {page: "/dashboard", reportedAt: new Date().toISOString()},
    ...overrides,
});

describe("problem report settings", () => {
    test("missing settings fall back to defaults", async () => {
        const config = await settingsWith();
        expect(config.enabled).toBe(true);
        expect(config.problemTypes).toEqual(["error", "wrongOrMissing", "slowOrStuck", "otherOrSuggestion"]);
        expect(config.attachmentsMaxCount).toBe(5);
        expect(config.attachmentsMaxFileBytes).toBe(20 * MB);
    });

    test("settings cannot exceed the fixed safety caps or add unsafe types", async () => {
        const config = await settingsWith({
            "attachments.maxCount": "500",
            "attachments.maxTotalSizeMb": "5000",
            "attachments.maxFileSizeMb": "5000",
            "attachments.allowedTypes": "image/svg+xml,text/html,image/png",
            "diagnostics.maxEntries": "100000",
            "description.maxLength": "99999999",
        });
        expect(config.attachmentsMaxCount).toBe(HARD_LIMITS.attachmentsMaxCount);
        expect(config.attachmentsMaxTotalBytes).toBe(HARD_LIMITS.attachmentsMaxTotalBytes);
        expect(config.attachmentsMaxFileBytes).toBe(HARD_LIMITS.attachmentsMaxTotalBytes);
        expect(config.attachmentTypes).toEqual(["image/png"]);
        expect(config.diagnosticsMaxEntries).toBe(HARD_LIMITS.diagnosticsMaxEntries);
        expect(config.descriptionMaxLength).toBe(HARD_LIMITS.descriptionMaxLength);
    });

    test("invalid numbers fall back and an empty type list keeps the defaults", async () => {
        const config = await settingsWith({"attachments.maxCount": "-3", problemTypes: " , ", frequencies: "", enabled: "false"});
        expect(config.attachmentsMaxCount).toBe(5);
        expect(config.problemTypes.length).toBe(4);
        expect(config.frequencies).toEqual([]);
        expect(config.enabled).toBe(false);
    });

    test("configured choices are trimmed, deduplicated and pattern checked", async () => {
        const config = await settingsWith({problemTypes: "error, Accessibility issue,error,<script>"});
        expect(config.problemTypes).toEqual(["error", "Accessibility issue"]);
    });
});

describe("problem report normalization", () => {
    test("requires a configured problem type and a description", async () => {
        const config = await settingsWith();
        expect(() => normalizeReport(validReport({problemTypes: []}), config)).toThrow("errors.problemReport.problemTypeRequired");
        expect(() => normalizeReport(validReport({problemTypes: ["unknown"]}), config)).toThrow("errors.problemReport.problemTypeRequired");
        expect(() => normalizeReport(validReport({description: "   "}), config)).toThrow("errors.problemReport.descriptionRequired");
    });

    test("enforces the configured description length", async () => {
        const config = await settingsWith({"description.maxLength": "10"});
        expect(() => normalizeReport(validReport({description: "x".repeat(11)}), config)).toThrow("errors.problemReport.descriptionTooLong");
    });

    test("keeps multi-select types in configured order and drops unknown optional answers", async () => {
        const config = await settingsWith({askBlocked: "false"});
        const report = normalizeReport(validReport({
            problemTypes: ["slowOrStuck", "error", "nope"],
            blocked: true,
            frequency: "weekly",
        }), config);
        expect(report.problemTypes).toEqual(["error", "slowOrStuck"]);
        expect(report.blocked).toBeNull();
        expect(report.frequency).toBeNull();
    });

    test("strips query strings, secrets and unknown fields from context and diagnostics", async () => {
        const config = await settingsWith();
        const now = new Date();
        const report = normalizeReport(validReport({
            context: {
                page: "https://care.example/reset_password?token=abc123#x",
                reportedAt: now.toISOString(),
                browser: "Firefox 130",
                cookie: "sid=secret",
            },
            diagnostics: [{
                type: "failedOperation",
                time: now.toISOString(),
                event: "documentGet",
                errorId: "123e4567-e89b-12d3-a456-426614174000",
                message: "Bearer abc.def password=hunter2 mail jane@example.org url https://x.org/a?token=1 jwt eyJa.eyJb.sig",
                data: {documentText: "secret document contents"},
            }, {
                type: "consoleLog",
                time: now.toISOString(),
                message: "raw console output",
            }],
        }), config);

        expect(report.context.page).toBe("/reset_password");
        expect(report.context).not.toHaveProperty("cookie");
        expect(report.diagnostics).toHaveLength(1);
        const [entry] = report.diagnostics;
        expect(entry).not.toHaveProperty("data");
        expect(entry.errorId).toBe("123e4567-e89b-12d3-a456-426614174000");
        expect(entry.message).not.toMatch(/hunter2|jane@example.org|token=1|eyJa|abc\.def/);
        expect(entry.message).toContain("password=[redacted]");
    });

    test("applies configured diagnostic count, age and message length", async () => {
        const config = await settingsWith({
            "diagnostics.maxEntries": "2",
            "diagnostics.maxAgeMinutes": "10",
            "diagnostics.maxMessageLength": "20",
        });
        const now = Date.now();
        const at = (minutesAgo) => new Date(now - minutesAgo * 60 * 1000).toISOString();
        const report = normalizeReport(validReport({
            context: {reportedAt: new Date(now).toISOString()},
            diagnostics: [
                {type: "error", time: at(30), message: "too old"},
                {type: "error", time: at(5), message: "first"},
                {type: "error", time: at(4), message: "second"},
                {type: "error", time: at(3), message: "x".repeat(50)},
                {type: "error", message: "no time"},
            ],
        }), config);
        expect(report.diagnostics.map((entry) => entry.message.length <= 20)).toEqual([true, true]);
        expect(report.diagnostics[0].message).toBe("second");
    });

    test("missing diagnostics still produce a valid report", async () => {
        const report = normalizeReport(validReport({diagnostics: undefined}), await settingsWith());
        expect(report.diagnostics).toEqual([]);
    });

    test("an implausible client report time is replaced by server time", async () => {
        const now = new Date();
        const report = normalizeReport(validReport({context: {reportedAt: "1999-01-01T00:00:00Z"}}), await settingsWith(), now);
        expect(report.context.reportedAt).toBe(now.toISOString());
    });

    test("sanitizeText removes control characters and caps length", () => {
        expect(sanitizeText("a\u0000b\nc", 100)).toBe("a b c");
        expect(sanitizeText("x".repeat(10), 5)).toHaveLength(5);
        expect(sanitizeText(42, 5)).toBeNull();
    });
});

describe("problem report attachments", () => {
    test("detects allowed types from content, not the name", () => {
        expect(detectAttachmentType(PNG).mimeType).toBe("image/png");
        expect(detectAttachmentType(MP4).mimeType).toBe("video/mp4");
        expect(detectAttachmentType(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
    });

    test("validates count, size, total size and type against settings", async () => {
        const defaults = await settingsWith();
        const config = await settingsWith({"attachments.maxCount": "2", "attachments.maxFileSizeMb": "0.00001", "attachments.maxTotalSizeMb": "1"});
        expect(() => validateAttachments([{file: PNG}, {file: PNG}, {file: PNG}], config)).toThrow("errors.problemReport.tooManyAttachments");
        expect(() => validateAttachments([{file: Buffer.concat([PNG, Buffer.alloc(100)])}], config)).toThrow("errors.problemReport.attachmentTooLarge");
        expect(() => validateAttachments([{name: "fake.png", file: Buffer.from("not an image")}], defaults)).toThrow("errors.problemReport.unsupportedAttachmentType");
        expect(() => validateAttachments([{file: "text"}], config)).toThrow("errors.problemReport.invalidAttachment");

        const total = await settingsWith({"attachments.maxTotalSizeMb": "0.00002"});
        expect(() => validateAttachments([{file: PNG}, {file: PNG}], total)).toThrow("errors.problemReport.attachmentsTooLarge");
    });

    test("rejects types that settings turned off, and all files when attachments are disabled", async () => {
        const imagesOnly = await settingsWith({"attachments.allowedTypes": "image/png"});
        expect(() => validateAttachments([{file: MP4}], imagesOnly)).toThrow("errors.problemReport.unsupportedAttachmentType");
        const disabled = await settingsWith({"attachments.allowedTypes": ""});
        expect(() => validateAttachments([{file: PNG}], disabled)).toThrow("errors.problemReport.attachmentsDisabled");
        expect(validateAttachments([], disabled)).toEqual([]);
    });

    test("cleans display names", async () => {
        const [attachment] = validateAttachments([{name: "..\\..\\evil<x>.png", file: PNG}], await settingsWith());
        expect(attachment.name).toBe("evil_x_.png");
        expect(attachment.extension).toBe("png");
    });

    test("client request ids must be well formed", () => {
        expect(validateClientRequestId("123e4567-e89b-12d3-a456-426614174000")).toBeTruthy();
        expect(() => validateClientRequestId("../../x")).toThrow("errors.problemReport.invalidRequest");
        expect(() => validateClientRequestId(undefined)).toThrow("errors.problemReport.invalidRequest");
    });
});
