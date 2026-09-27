"use strict";

const { resolveTemplate } = require("../../templateResolver.js");
const TranslatableError = require("../../../TranslatableError.js");

/**
 * Resolves recipients for an email trigger action.
 *
 * @param {Object} server CARE server.
 * @param {string} recipient Recipient selector.
 * @param {Object} context Resolved event context.
 * @param {Object} options Runtime options.
 * @returns {Promise<Array<Object>>}
 * @throws {Error} If the recipient selector is unsupported.
 */
async function resolveEmailRecipients(server, recipient, context, options = {}) {
    const models = server.db.models;

    if (recipient === "admins") {
        return (await models["user"].getUsersByRole("admin") || [])
            .filter((user) => user.email);
    }

    if (recipient !== "uploader") {
        throw new TranslatableError("errors.triggers.email.unsupportedRecipient", {recipient});
    }

    const userId = context.userId || context.submitterUserId;
    if (!userId) {
        return [];
    }

    const user = await models["user"].getById(userId, options);
    return user?.email ? [user] : [];
}

/**
 * Sends a templated email for a trigger action.
 *
 * @param {Object} server CARE server.
 * @param {Object} trigger Trigger row.
 * @param {Object} context Resolved event context.
 * @param {Object} options Runtime options.
 * @returns {Promise<Object>}
 * @throws {Error} If the action configuration cannot be executed.
 */
async function sendEmail(server, trigger, context, options = {}) {
    const config = trigger.configuration?.action || {};
    const templateId = config.templateId;

    if (!templateId) {
        throw new TranslatableError("errors.triggers.email.templateRequired");
    }

    const template = await server.db.models["template"].getById(templateId, options);
    if (!template) {
        throw new TranslatableError("errors.triggers.email.templateNotFound", {templateId});
    }

    const recipients = await resolveEmailRecipients(
        server,
        config.recipient,
        context,
        options
    );
    if (!recipients.length) {
        throw new TranslatableError("errors.triggers.email.noRecipients");
    }

    const sent = [];
    for (const recipient of recipients) {
        const body = await resolveTemplate(
            templateId,
            { ...context, userId: recipient.id },
            server.db.models,
            options
        );
        await server.sendMail(recipient.email, template.name, body, { isHtml: true });
        sent.push(recipient.email);
    }

    return { sent };
}

module.exports = sendEmail;
