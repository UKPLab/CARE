"use strict";

const nodemailer = require("nodemailer");

const TEST_MAIL_SUBJECT = "CARE test email";
const TEST_MAIL_TEXT =
    "This is a test message from CARE. If you received this, your outgoing mail configuration works.";

/** Basic email shape check (same rule as setup/test-mail and dashboard test mail). */
const RECIPIENT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Read a string value from the mail settings object.
 * @param {Object} mailSettings object with string keys and string values
 * @param {string} key
 * @returns {string|null}
 */
function get(mailSettings, key) {
    const v = mailSettings[key];
    if (v === null || v === undefined) {
        return null;
    }
    return String(v);
}

/**
 * Build a nodemailer transport from DB mail settings (system.mailService.* map).
 * @param {Object} mailSettings object with string keys and string values
 * @returns {Object}
 */
function buildTransportFromMailSettings(mailSettings) {
    if (get(mailSettings, "system.mailService.enabled") !== "true") {
        throw new Error("Email service is not enabled.");
    }
    if (get(mailSettings, "system.mailService.sendMail.enabled") === "true") {
        const sendmailPath = get(mailSettings, "system.mailService.sendMail.path");
        if (!sendmailPath) {
            throw new Error("Sendmail path is not configured.");
        }
        return nodemailer.createTransport({
            sendmail: true,
            newline: "unix",
            path: sendmailPath,
        });
    }
    if (get(mailSettings, "system.mailService.smtp.enabled") === "true") {
        const host = get(mailSettings, "system.mailService.smtp.host");
        const portStr = get(mailSettings, "system.mailService.smtp.port");
        const secure = get(mailSettings, "system.mailService.smtp.secure") === "true";
        const authEnabled = get(mailSettings, "system.mailService.smtp.auth.enabled") === "true";
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
            const user = get(mailSettings, "system.mailService.smtp.auth.user");
            const pass = get(mailSettings, "system.mailService.smtp.auth.pass");
            if (user && pass) {
                transportConfig.auth = { user, pass };
            }
        }
        return nodemailer.createTransport(transportConfig);
    }
    throw new Error("Neither sendmail nor SMTP is enabled for mail delivery.");
}

/**
 * Send a fixed plain-text test message. Validates recipient format; `from` must be non-empty.
 * @param {Object} transport
 * @param {Object} addresses
 * @param {string} addresses.from
 * @param {string} addresses.to
 * @returns {Promise<void>}
 */
async function sendFixedTestMail(transport, { from, to }) {
    if (!from || !String(from).trim()) {
        throw new Error("From address is required.");
    }
    const toTrim = to != null ? String(to).trim() : "";
    if (!toTrim || !RECIPIENT_EMAIL_RE.test(toTrim)) {
        throw new Error("A valid recipient email address is required.");
    }
    await transport.sendMail({
        from,
        to: toTrim,
        subject: TEST_MAIL_SUBJECT,
        text: TEST_MAIL_TEXT,
    });
}

/**
 * Build a mail settings map from setting rows (key/value), only system.mailService.* keys.
 * @param {Object[]} rows
 * @param {string}   rows.key
 * @param {string}   rows.value
 * @returns {Object}
 */
function buildMailMapFromSettingsRows(rows) {
    const mailSettings = {};
    for (const row of rows || []) {
        if (row.key && String(row.key).startsWith("system.mailService.")) {
            mailSettings[row.key] =
                row.value != null && row.value !== undefined ? String(row.value) : "";
        }
    }
    return mailSettings;
}

module.exports = {
    TEST_MAIL_SUBJECT,
    TEST_MAIL_TEXT,
    RECIPIENT_EMAIL_RE,
    buildTransportFromMailSettings,
    sendFixedTestMail,
    buildMailMapFromSettingsRows,
};
