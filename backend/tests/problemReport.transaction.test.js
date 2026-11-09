const fs = require("fs");
const os = require("os");
const path = require("path");
const {randomUUID} = require("crypto");
const ProblemReportSocket = require("../webserver/sockets/problem_report");

test("a failed database commit removes attachments written by the handler", async () => {
    const attachment = path.join(os.tmpdir(), `care-report-${randomUUID()}`);
    const context = {
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
    };
    try {
        await expect(ProblemReportSocket.prototype.submitReport.call(context, {}, {})).rejects.toThrow("Commit failed");
        expect(fs.existsSync(attachment)).toBe(false);
    } finally {
        fs.rmSync(attachment, {force: true});
    }
});
