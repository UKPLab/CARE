"use strict";

const nodemailer = require("nodemailer");

const TEST_MAIL_SUBJECT = "CARE test email";
const TEST_MAIL_TEXT =
    "This is a test message from CARE. If you received this, your outgoing mail configuration works.";

function get(map, key) {
    const v = map[key];
    if (v === null || v === undefined) {
        return null;
    }
    return String(v);
}

function buildTransportFromMailSettings(map) {
    if (get(map, "system.mailService.enabled") !== "true") {
        throw new Error("Email service is not enabled.");
    }
    if (get(map, "system.mailService.sendMail.enabled") === "true") {
        const sendmailPath = get(map, "system.mailService.sendMail.path");
        if (!sendmailPath) {
            throw new Error("Sendmail path is not configured.");
        }
        return nodemailer.createTransport({
            sendmail: true,
            newline: "unix",
            path: sendmailPath,
        });
    }
    if (get(map, "system.mailService.smtp.enabled") === "true") {
        const host = get(map, "system.mailService.smtp.host");
        const portStr = get(map, "system.mailService.smtp.port");
        const secure = get(map, "system.mailService.smtp.secure") === "true";
        const authEnabled = get(map, "system.mailService.smtp.auth.enabled") === "true";
        if (!host || !portStr) {
            throw new Error("SMTP host and port are required.");
        }
        const port = parseInt(portStr, 10);
        if (Number.isNaN(port)) {
            throw new Error("SMTP port must be a number.");
        }
        const transportConfig = {
            host,
            port,
            secure,
        };
        if (authEnabled) {
            const user = get(map, "system.mailService.smtp.auth.user");
            const pass = get(map, "system.mailService.smtp.auth.pass");
            if (user && pass) {
                transportConfig.auth = { user, pass };
            }
        }
        return nodemailer.createTransport(transportConfig);
    }
    throw new Error("Neither sendmail nor SMTP is enabled for mail delivery.");
}

async function sendFixedTestMail(transport, { from, to }) {
    if (!from || !to) {
        throw new Error("From and to addresses are required.");
    }
    await transport.sendMail({
        from,
        to,
        subject: TEST_MAIL_SUBJECT,
        text: TEST_MAIL_TEXT,
    });
}

function buildMailMapFromSettingsRows(rows) {
    const map = {};
    for (const row of rows || []) {
        if (row.key && String(row.key).startsWith("system.mailService.")) {
            map[row.key] =
                row.value != null && row.value !== undefined ? String(row.value) : "";
        }
    }
    return map;
}

module.exports = {
    TEST_MAIL_SUBJECT,
    TEST_MAIL_TEXT,
    buildTransportFromMailSettings,
    sendFixedTestMail,
    buildMailMapFromSettingsRows,
};
