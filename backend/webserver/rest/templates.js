'use strict';

/**
 * Document, study, and prompt templates, for /rest/v1/templates. Email templates stay in the dashboard.
 *
 * REST-only: the dashboard keeps using its socket methods, which these functions mirror where noted
 * ("Mirrors …"). Called by the routes in routes/rest/.
 */

const {getDuplicatePlaceholderIds, getDuplicatePlaceholderOptionTokens} = require('../../utils/helper/templateResolver');
const TranslatableError = require("../../utils/TranslatableError");
const {Op} = require('sequelize');

const REST_TEMPLATE_FIELDS = ["id", "name", "description", "type", "defaultLanguage", "public", "userId"];

/**
 * The caller's own templates and public ones, without content.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {Object} options the REST options (models)
 * @returns {Promise<Array<Object>>} the templates
 */
async function listTemplates({userId}, options) {
    const Template = options.models["template"];
    return Template.findAll({
        where: {
            deleted: false,
            type: {[Op.in]: Template.otherTemplateTypes},
            [Op.or]: [{userId}, {public: true}],
        },
        attributes: REST_TEMPLATE_FIELDS,
        order: [["id", "ASC"]],
        raw: true,
    });
}

/**
 * The caller's own templates with each saved language body, in the dashboard's export shape.
 * Mirrors TemplateSocket.exportTemplates (templateExport). Differs: never email templates.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} [data.templateId] export only this template
 * @param {Object} options the REST options (models)
 * @returns {Promise<Array<Object>|null>} the export, or null when one template was asked for and it is not the caller's
 */
async function exportTemplates({userId, templateId}, options) {
    const templates = await options.models["template"].findOwnedWithContent(userId, false, templateId, options);
    if (templateId && templates.length === 0) {
        return null;
    }
    return templates.map((template) => {
        const row = template.get({plain: true});
        return {
            name: row.name,
            description: row.description,
            type: row.type,
            defaultLanguage: row.defaultLanguage,
            public: row.public,
            template_content: (row.template_contents || []).map((content) => ({
                language: content.language,
                content: content.content,
            })),
        };
    });
}

/**
 * The template fields REST returns.
 *
 * @param {Object} row the template row or model instance
 * @returns {Object} the public fields
 */
function plainTemplate(row) {
    const plain = typeof row.get === "function" ? row.get({plain: true}) : row;
    return Object.fromEntries(REST_TEMPLATE_FIELDS.map((key) => [key, plain[key] ?? null]));
}

/**
 * A template the caller owns and may change over REST: never an email template.
 *
 * @param {Object} options the REST options (models, transaction)
 * @param {number} userId the token owner's user id
 * @param {number} id the template id
 * @returns {Promise<Object|null>} the template, or null when it does not exist
 * @throws {TranslatableError} errors.rest.templateNoAccess
 */
async function loadOwnTemplate(options, userId, id) {
    const Template = options.models["template"];
    const template = await Template.getById(id, {transaction: options.transaction});
    if (!template) {
        return null;
    }
    if (template.userId !== userId || Template.emailTemplateTypes.includes(template.type)) {
        throw new TranslatableError("errors.rest.templateNoAccess");
    }
    return template;
}

/**
 * Check placeholders in one language body, as the socket does before saving.
 *
 * @param {Object} content the language body, a delta with ops
 * @param {number} type the template type
 * @param {Object} options the REST options (models)
 * @returns {Promise<void>}
 * @throws {TranslatableError} when the ops are missing or a placeholder is duplicated
 */
async function checkTemplateContent(content, type, options) {
    if (!content || !Array.isArray(content.ops)) {
        throw new TranslatableError("errors.templates.deltaOperationsRequired");
    }
    const duplicates = await getDuplicatePlaceholderIds(content, type, options.models, options);
    if (duplicates.length > 0) {
        throw new TranslatableError("errors.templates.duplicateBracketPlaceholders", {ids: duplicates.join(", ")});
    }
    const optionDuplicates = getDuplicatePlaceholderOptionTokens(content);
    if (optionDuplicates.length > 0) {
        throw new TranslatableError("errors.templates.duplicatePlaceholderOptions", {tokens: optionDuplicates.join(", ")});
    }
}

/**
 * Mirrors TemplateSocket.createTemplate (templateAdd). Differs: never email templates; starts with
 * no text, which is set per language with setTemplateContent.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {string} data.name the template name
 * @param {string} [data.description] the description
 * @param {number} data.type the template type
 * @param {string} [data.defaultLanguage] the default language, 'en' when not given
 * @param {Object} options the REST options (models, transaction)
 * @returns {Promise<Object>} the new template
 */
async function createTemplate({userId, name, description, type, defaultLanguage}, options) {
    const Template = options.models["template"];
    const checkedType = Template.assertCreateAllowed({name, description, type}, false);
    const created = await Template.createWithContents({
        name, description, type: checkedType, defaultLanguage: defaultLanguage || "en", public: false, userId,
    }, [], {transaction: options.transaction, isAdmin: false});
    return plainTemplate(created);
}

/**
 * Change name, description, or default language of an own template. The default language must
 * already have text, if the template has any text.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.id the template id
 * @param {Object} data.fields the fields to change
 * @param {Object} options the REST options (models, transaction)
 * @returns {Promise<Object|null>} the updated template, or null when it does not exist
 * @throws {TranslatableError} errors.templates.importDefaultLanguageMissing
 */
async function updateTemplate({userId, id, fields}, options) {
    const template = await loadOwnTemplate(options, userId, id);
    if (!template) {
        return null;
    }
    if (fields.defaultLanguage) {
        const languages = await options.models["template_content"].getAllByKey("templateId", template.id) || [];
        if (languages.length > 0 && !languages.some((row) => row.language === fields.defaultLanguage)) {
            throw new TranslatableError("errors.templates.importDefaultLanguageMissing", {language: fields.defaultLanguage});
        }
    }
    const updated = await options.models["template"].updateById(template.id, fields, {transaction: options.transaction});
    return plainTemplate(updated);
}

/**
 * Set the whole text of one language of an own template (adds the language if it is new).
 * Mirrors TemplateSocket.editContent, addContent and closeTemplate, which edit through drafts and
 * merge them on close. Differs: writes the saved text directly, and drops the owner's unsaved drafts
 * for that language so the dashboard editor does not reapply old edits on top.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.id the template id
 * @param {string} data.language the language code
 * @param {Object} data.content the language body, a delta with ops
 * @param {Object} options the REST options (models, transaction)
 * @returns {Promise<Object|null>} {templateId, language, content}, or null when the template does not exist
 */
async function setTemplateContent({userId, id, language, content}, options) {
    const models = options.models;
    const transaction = options.transaction;
    const template = await loadOwnTemplate(options, userId, id);
    if (!template) {
        return null;
    }
    await checkTemplateContent(content, template.type, options);
    const existing = await models["template_content"].findOne({
        where: {templateId: template.id, language, deleted: false},
        raw: true,
        transaction,
    });
    if (existing) {
        await models["template_content"].updateById(existing.id, {content: {ops: content.ops}}, {transaction});
    } else {
        await models["template_content"].add({templateId: template.id, language, content: {ops: content.ops}}, {transaction});
    }
    // Drafts are the editor's working state; soft-deleting them in one update is enough here.
    await models["template_edit"].update(
        {deleted: true, deletedAt: new Date()},
        {where: {templateId: template.id, language, draft: true, deleted: false}, transaction}
    );
    return {templateId: template.id, language, content: {ops: content.ops}};
}

/**
 * Remove one language from an own template. The default language cannot be removed.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.id the template id
 * @param {string} data.language the language code
 * @param {Object} options the REST options (models, transaction)
 * @returns {Promise<boolean|null>} true, or null when the template does not exist
 * @throws {TranslatableError} errors.rest.cannotRemoveDefaultLanguage or errors.rest.templateLanguageNotFound
 */
async function removeTemplateLanguage({userId, id, language}, options) {
    const models = options.models;
    const template = await loadOwnTemplate(options, userId, id);
    if (!template) {
        return null;
    }
    if (template.defaultLanguage === language) {
        throw new TranslatableError("errors.rest.cannotRemoveDefaultLanguage");
    }
    const row = await models["template_content"].findOne({
        where: {templateId: template.id, language, deleted: false},
        raw: true,
        transaction: options.transaction,
    });
    if (!row) {
        throw new TranslatableError("errors.rest.templateLanguageNotFound");
    }
    await models["template_content"].deleteById(row.id, {transaction: options.transaction});
    return true;
}

/**
 * Copy another user's public template; the caller owns the copy.
 * Mirrors TemplateSocket.copyTemplate (templateCopy). Differs: never email templates.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.sourceId the template to copy
 * @param {Object} options the REST options (models, transaction)
 * @returns {Promise<Object|null>} the copy, or null when the source does not exist
 * @throws {TranslatableError} errors.rest.templateNoAccess
 */
async function copyTemplate({userId, sourceId}, options) {
    const Template = options.models["template"];
    const source = await Template.getById(sourceId, {transaction: options.transaction});
    if (!source) {
        return null;
    }
    if (Template.emailTemplateTypes.includes(source.type)) {
        throw new TranslatableError("errors.rest.templateNoAccess");
    }
    const copy = await Template.copyTemplate(source.id, userId, {force: false}, {transaction: options.transaction});
    return plainTemplate(copy);
}

/**
 * Mirrors TemplateSocket.deleteTemplate (templateDelete). Differs: never email templates.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.id the template id
 * @param {Object} options the REST options (models, transaction)
 * @returns {Promise<boolean|null>} true, or null when it does not exist
 */
async function deleteTemplate({userId, id}, options) {
    const template = await loadOwnTemplate(options, userId, id);
    if (!template) {
        return null;
    }
    await options.models["template"].deleteById(template.id, {transaction: options.transaction});
    return true;
}

/**
 * Create one template from an export item. Same checks as templateImport. Only the named keys
 * are read, the owner is the caller, and the new template is never public.
 * Mirrors TemplateSocket.importTemplate (templateImport). Differs: never email templates, only known keys read.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {Object} data.item one entry of an export
 * @param {Object} options the REST options (models, transaction)
 * @returns {Promise<Object>} the new template
 * @throws {TranslatableError} when the type, a language, or a placeholder is not valid
 */
async function importTemplate({userId, item}, options) {
    const Template = options.models["template"];
    const type = Template.assertCreateAllowed({
        name: item?.name,
        description: item?.description,
        type: item?.type,
    }, false);

    const contents = item?.template_content ?? [];
    if (!Array.isArray(contents)) {
        throw new TranslatableError("errors.templates.deltaOperationsRequired");
    }
    const seen = new Set();
    const rows = [];
    for (const row of contents) {
        if (!row || typeof row.language !== "string" || row.language === "") {
            throw new TranslatableError("errors.templates.languageRequired");
        }
        if (!row.content || !Array.isArray(row.content.ops)) {
            throw new TranslatableError("errors.templates.deltaOperationsRequired");
        }
        if (seen.has(row.language)) {
            throw new TranslatableError("errors.templates.duplicateImportLanguage", {language: row.language});
        }
        seen.add(row.language);
        rows.push({language: row.language, content: {ops: row.content.ops}});
    }
    const defaultLanguage = typeof item.defaultLanguage === "string" && item.defaultLanguage
        ? item.defaultLanguage
        : rows[0]?.language || "en";
    if (rows.length > 0 && !seen.has(defaultLanguage)) {
        throw new TranslatableError("errors.templates.importDefaultLanguageMissing", {language: defaultLanguage});
    }
    for (const row of rows) {
        const duplicates = await getDuplicatePlaceholderIds(row.content, type, options.models, options);
        if (duplicates.length > 0) {
            throw new TranslatableError("errors.templates.duplicateBracketPlaceholders", {ids: duplicates.join(", ")});
        }
        const optionDuplicates = getDuplicatePlaceholderOptionTokens(row.content);
        if (optionDuplicates.length > 0) {
            throw new TranslatableError("errors.templates.duplicatePlaceholderOptions", {tokens: optionDuplicates.join(", ")});
        }
    }
    const created = await Template.createWithContents({
        name: item.name,
        description: item.description,
        type,
        defaultLanguage,
        public: false,
        userId,
    }, rows, {transaction: options.transaction, isAdmin: false});
    return plainTemplate(created);
}

module.exports = {
    copyTemplate,
    createTemplate,
    deleteTemplate,
    exportTemplates,
    importTemplate,
    listTemplates,
    removeTemplateLanguage,
    setTemplateContent,
    updateTemplate,
};
