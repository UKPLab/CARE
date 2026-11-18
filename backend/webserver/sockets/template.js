"use strict";
const Socket = require("../Socket");
const Delta = require("quill-delta");
const {Op} = require("sequelize");
const {dbToDelta} = require("editor-delta-conversion");
const {
  resolveTemplate,
  resolveTemplateToDelta,
  getMissingRequiredPlaceholders,
  getDuplicatePlaceholderIds,
  getDuplicatePlaceholderOptionTokens,
  getUsedPlaceholders,
  formatMissingPlaceholderError,
} = require("../../utils/helper/templateResolver");
const TranslatableError = require("../../utils/TranslatableError");

/**
 * Template actions for /rest/v1 only (document, study, and prompt templates). The socket methods
 * below do not call these. Email templates are system settings and stay in the dashboard: these
 * functions never return or create them, whoever owns the token.
 */

const REST_TEMPLATE_FIELDS = ["id", "name", "description", "type", "defaultLanguage", "public", "userId"];

/**
 * The caller's own templates and public ones, without content.
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
 * @returns {Promise<Object[]|null>} null when one template was asked for and it is not the caller's
 * Mirrors TemplateSocket.exportTemplates (templateExport). Differs: never email templates.
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

function plainTemplate(row) {
    const plain = typeof row.get === "function" ? row.get({plain: true}) : row;
    return Object.fromEntries(REST_TEMPLATE_FIELDS.map((key) => [key, plain[key] ?? null]));
}

/**
 * A template the caller owns and may change over REST: never an email template.
 * @returns {Promise<Object|null>} null when it does not exist
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

/**
 * Handle templates through websocket
 *
 * @author Mohammad Elwan
 * @type {TemplateSocket}
 * @class TemplateSocket
 */
class TemplateSocket extends Socket {

  /**
   * Validate access to prompt-resolution context data for non-admin users.
   *
   * @param {Object} context                  Resolver context
   * @param {number} [context.documentId]     Document ID
   * @param {number} [context.studySessionId] Study session ID
   * @param {number} [context.studyStepId]    Study step ID
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<void>}
   */
  async validateResolveContextAccess(context, options = {}) {
    let studyStep = null;

    if (context.documentId && !(await this.checkDocumentAccess(context.documentId))) {
      throw new TranslatableError("errors.templates.accessDenied");
    }

    if (context.studyStepId) {
      studyStep = await this.models["study_step"].getById(context.studyStepId, options);
      if (!studyStep) {
        throw new TranslatableError("errors.templates.resolveContextStudyStepNotFound");
      }
      if (studyStep.documentId) {
        if (!(await this.checkDocumentAccess(studyStep.documentId))) {
          throw new TranslatableError("errors.templates.accessDenied");
        }
        if (context.documentId && studyStep.documentId !== context.documentId) {
          throw new TranslatableError("errors.templates.resolveContextStepDocumentMismatch");
        }
      } else if (!context.studySessionId) {
        // add() can leave documentId null for editor/modal steps; there is no document ACL then,
        // so fall back to the study. A studySessionId is checked below and covers participants.
        let hasStepAccess = await this.hasAccess("frontend.dashboard.studies.fullAccess");
        if (!hasStepAccess) {
          const study = await this.models["study"].getById(studyStep.studyId, options);
          hasStepAccess = !!study && (await this.checkUserAccess(study.userId));
        }
        if (!hasStepAccess) {
          throw new TranslatableError("errors.templates.accessDenied");
        }
      }
    }

    if (context.studySessionId) {
      const studySession = await this.models["study_session"].getById(context.studySessionId, options);
      if (!studySession) {
        throw new TranslatableError("errors.templates.resolveContextStudySessionNotFound");
      }

      let hasSessionAccess =
        studySession.userId === this.userId ||
        (await this.hasAccess("frontend.dashboard.studies.fullAccess"));

      if (!hasSessionAccess) {
        const study = await this.models["study"].getById(studySession.studyId, options);
        hasSessionAccess = !!study && (await this.checkUserAccess(study.userId));
      }

      if (!hasSessionAccess) {
        throw new TranslatableError("errors.templates.accessDenied");
      }

      if (studyStep?.studyId && studySession.studyId !== studyStep.studyId) {
        throw new TranslatableError("errors.templates.resolveContextSessionStepMismatch");
      }
    }
  }

  /**
   * Create a template
   *
   * @socketEvent templateAdd
   * @param {Object} data                  The data object containing the template info
   * @param {string} data.name             Template name (required)
   * @param {string} data.description      Template description (required)
   * @param {number} data.type             Template type (required, immutable later)
   * @param {Object} data.content          Initial template content for default language (JSON, required)
   * @param {string} [data.defaultLanguage='en']  Default language code
   * @param {boolean} [data.public=false]  Make template public (visible to all users, cannot be undone)
   * @param {Object} options               
   * @param {Object} options.transaction   
   * @returns {Promise<Object>}            
   */
  async createTemplate(data, options) {
    if (data?.content === undefined) {
      throw new TranslatableError("errors.templates.missingCreateFields");
    }
    const defaultLanguage = data.defaultLanguage || "en";
    return this.models["template"].createWithContents({
      name: data.name,
      description: data.description,
      type: data.type,
      defaultLanguage,
      public: data.public ?? false,
      userId: this.userId,
    }, [{
      language: defaultLanguage,
      content: data.content,
    }], {
      transaction: options.transaction,
      isAdmin: await this.isAdmin(),
    });
  }

  /**
   * Get template content (deltas) for editor
   *
   * Fetches the template and returns its content as Quill Delta format for the given language.
   * - For owners: returns stable content from template_content composed with draft edits (like documents)
   * - For non-owners: returns only stable content (no drafts)
   * - Non-admins are rejected for email templates (including owners)
   *
   * @socketEvent templateGetContent
   * @param {Object} data                  The data object
   * @param {number} data.templateId       Template ID (required)
   * @param {string} data.language         Language code (required, e.g. 'en', 'de')
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<Object>}
   * @throws {Error} if templateId or language is missing, or the template does not exist
   * @throws {Error} if the caller is not the owner and the template is not public
   * @throws {Error} if the caller is not an admin and the template is an email type
   */
  async getContent(data, options){
    if (!data.templateId) throw new TranslatableError("errors.templates.templateIdRequired");
    if (!data.language) throw new TranslatableError("errors.templates.languageRequired");

    const template = await this.models["template"].getById(data.templateId);
    if (!template) {
      throw new TranslatableError("errors.templates.notFound");
    }
    
    const isOwner = template.userId === this.userId;
    const isPublicFromOthers = template.public === true && !isOwner;
    const isAdmin = await this.isAdmin();
    const isEmailType = this.models["template"].emailTemplateTypes.includes(template.type);
    
    if (!isOwner && !isPublicFromOthers) {
      throw new TranslatableError("errors.templates.viewOwnOrPublicOnly");
    }
    if (!isAdmin && isEmailType) {
      throw new TranslatableError("errors.templates.adminOnlyEmailTemplateView");
    }

    const langRow = await this.models["template_content"].getByTemplateIdAndLanguage(
      data.templateId,
      data.language,
      options
    );

    let delta = new Delta();
    if (langRow && langRow.content && langRow.content.ops) {
      delta = new Delta(langRow.content.ops);
    }

    if (isOwner) {
      const draftEdits = await this.models["template_edit"].getDrafts(
        data.templateId,
        data.language,
        options
      );

      if (draftEdits.length > 0) {
        const draftDelta = new Delta(dbToDelta(draftEdits));
        const composed = delta.compose(draftDelta);

        // Self-heal: drafts left unmerged by a forced URL navigation or tab close
        // (which bypass the editor's close/discard flow) must not resurface as if saved
        // when they omit required placeholders. Discard such invalid drafts and fall back
        // to stable content; valid drafts are still resumed.
        let composedIsInvalid = false;
        if (isEmailType) {
          const missing = await getMissingRequiredPlaceholders(
            { ops: composed.ops },
            template.type,
            this.models,
            options
          );
          composedIsInvalid = missing.length > 0;
        }

        if (composedIsInvalid) {
          await this.models["template_edit"].discardDrafts(
            data.templateId,
            data.language,
            options
          );
        } else {
          delta = composed;
        }
      }
    }

    const isNewLanguage = !langRow;
    return { template, deltas: delta, isNewLanguage };
  }

  /**
   * Save template content edits (deltas) to template_edit table
   *
   * Saves content edits as draft edits in template_edit table for the given language.
   * Drafts are merged into template_content when the editor is closed.
   * Users can only edit content of their own templates.
   *
   * @socketEvent templateEditContent
   * @param {Object} data                  The data object
   * @param {number} data.templateId       Template ID (required)
   * @param {string} data.language         Language code (required)
   * @param {Array<Object>} data.ops       Delta operations in database format (from deltaToDb)
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<Object>}
   */
  async editContent(data, options) {
    if (!data.templateId) throw new TranslatableError("errors.templates.templateIdRequired");
    if (!data.language) throw new TranslatableError("errors.templates.languageRequired");
    if (!data.ops || !Array.isArray(data.ops)) {
      throw new TranslatableError("errors.templates.deltaOperationsRequired");
    }

    const template = await this.models["template"].getById(data.templateId);
    if (!template) {
      throw new TranslatableError("errors.templates.notFound");
    }

    // Check ownership: users (including admins) can only edit content of their own templates
    if (template.userId !== this.userId) {
      throw new TranslatableError("errors.templates.editOwnContentOnly");
    }

    // Copied templates cannot be edited
    if (template.sourceId) {
      throw new TranslatableError("errors.templates.copiedCannotBeEdited");
    }

    if (this.models["template"].emailTemplateTypes.includes(template.type) && !(await this.isAdmin())) {
      throw new TranslatableError("errors.templates.adminOnlyEmailTemplateEdit");
    }

    const bulkEdits = data.ops.map((op, idx) => ({
      userId: this.userId,
      templateId: data.templateId,
      language: data.language,
      draft: true,
      order: idx + 1,
      ...op,
    }));

    await this.models["template_edit"].bulkCreate(bulkEdits, {
      transaction: options.transaction,
    });

    return;
  }


  /**
   * Add a placeholder to a template type
   *
   * @socketEvent templatePlaceholderAdd
   * @param {Object} data                   The data object
   * @param {number} data.templateType      Template type (required, must be in allTemplateTypes)
   * @param {string} data.placeholderKey    Placeholder key (required, e.g., "username")
   * @param {string} data.placeholderLabel  i18n key for label (required, e.g. "templates.placeholders.labels.emailGeneral.username")
   * @param {string} data.placeholderType   Placeholder type (required, e.g., "text")
   * @param {boolean} [data.required=false] Whether placeholder is required
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<Object>}
   */
  async addPlaceholder(data, options) {
    if (!(await this.isAdmin())) throw new TranslatableError("errors.templates.accessDenied");
    if (!data.templateType || !this.models["template"].allTemplateTypes.includes(data.templateType)) {
      throw new TranslatableError("errors.templates.typeRequired");
    }
    if (!data.placeholderKey || !data.placeholderLabel || !data.placeholderType) {
      throw new TranslatableError("errors.templates.missingPlaceholderFields");
    }

    const payload = {
      type: data.templateType,
      placeholderKey: data.placeholderKey,
      placeholderLabel: data.placeholderLabel,
      placeholderType: data.placeholderType,
      required: data.required ?? false,
    };

    return await this.models["placeholder"].add(
      payload,
      { transaction: options.transaction }
    );
  }

  /**
   * Update a placeholder's metadata
   *
   * @socketEvent templatePlaceholderUpdate
   * @param {Object} data                    The data object
   * @param {number} data.id                 Placeholder mapping ID (required)
   * @param {string} [data.placeholderLabel] New placeholder label
   * @param {string} [data.placeholderType]  New placeholder type
   * @param {boolean} [data.required]        New required flag
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<Object>}
   */
  async updatePlaceholder(data, options) {
    if (!(await this.isAdmin())) throw new TranslatableError("errors.templates.accessDenied");
    if (!data.id) throw new TranslatableError("errors.templates.placeholderIdRequired");

    const updateData = {};
    if (data.placeholderLabel !== undefined) updateData.placeholderLabel = data.placeholderLabel;
    if (data.placeholderType !== undefined) updateData.placeholderType = data.placeholderType;
    if (data.required !== undefined) updateData.required = data.required;

    if (Object.keys(updateData).length === 0) {
      throw new TranslatableError("errors.templates.noFieldsToUpdate");
    }

    return await this.models["placeholder"].updateById(
        data.id,
        updateData,
        { transaction: options.transaction }
    );
  }


  /**
   * Get all placeholders for a template type
   *
   * @socketEvent templatePlaceholderGetAll
   * @param {Object} data                  The data object
   * @param {number} data.templateId       Template ID (required) - used to get template type
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<Array>}
   */
  async getAllPlaceholders(data, options) {
    if (!data.templateId) throw new TranslatableError("errors.templates.templateIdRequired");

    const template = await this.models["template"].getById(data.templateId);
    if (!template) {
      throw new TranslatableError("errors.templates.notFound");
    }
    
    // Check access: users (including admins) can view placeholders for their own templates or public templates from others
    const isOwner = template.userId === this.userId;
    const isPublicFromOthers = template.public === true && !isOwner;
    
    if (!isOwner && !isPublicFromOthers) {
      throw new TranslatableError("errors.templates.viewPlaceholdersOwnOrPublicOnly");
    }
    if (this.models["template"].emailTemplateTypes.includes(template.type) && !(await this.isAdmin())) {
      throw new TranslatableError("errors.templates.adminOnlyEmailTemplateView");
    }

    return await this.models["placeholder"].getAllByKey(
      "type",
      template.type,
      { transaction: options.transaction }
    );
  }

  /**
   * Get the placeholders a specific template actually uses (tokens present in its content).
   *
   * Placeholders are defined per template type, not per template, so "used" is derived from the
   * template's content. Returns the same row shape as {@link getAllPlaceholders}.
   *
   * @socketEvent templatePlaceholderGetUsed
   * @param {Object} data            The data object
   * @param {number} data.templateId Template ID (required)
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<Array>}
   */
  async getUsedPlaceholders(data, options) {
    if (!data.templateId) throw new TranslatableError("errors.templates.templateIdRequired");

    const template = await this.models["template"].getById(data.templateId);
    if (!template) {
      throw new TranslatableError("errors.templates.notFound");
    }

    const isOwner = template.userId === this.userId;
    const isPublicFromOthers = template.public === true && !isOwner;
    if (!isOwner && !isPublicFromOthers) {
      throw new TranslatableError("errors.templates.viewPlaceholdersOwnOrPublicOnly");
    }

    return await getUsedPlaceholders(data.templateId, this.models, { transaction: options.transaction });
  }


  /**
   * Get list of language codes that have content for a template
   *
   * @socketEvent templateGetLanguages
   * @param {Object} data                  The data object
   * @param {number} data.templateId       Template ID (required)
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<Array<string>>}
   */
  async getLanguages(data, options) {
    if (!data.templateId) throw new TranslatableError("errors.templates.templateIdRequired");

    const template = await this.models["template"].getById(data.templateId);
    if (!template) {
      throw new TranslatableError("errors.templates.notFound");
    }
    const isOwner = template.userId === this.userId;
    const isPublicFromOthers = template.public === true && !isOwner;
    if (!isOwner && !isPublicFromOthers) {
      throw new TranslatableError("errors.templates.viewOwnOrPublicOnly");
    }
    if (this.models["template"].emailTemplateTypes.includes(template.type) && !(await this.isAdmin())) {
      throw new TranslatableError("errors.templates.adminOnlyEmailTemplateView");
    }

    const languages = await this.models["template_content"].getLanguages(data.templateId, options);
    return { languages, defaultLanguage: template.defaultLanguage || "en" };
  }

  /**
   * Add template content for a given language (for "add language" in editor).
   *
   * When the user adds a new language, this ensures there is a corresponding row
   * in the template_content table for (templateId, language). If content is
   * provided (copy-from-current case), it is used; otherwise minimal empty
   * content is created.
   *
   * @socketEvent templateAddLanguageContent
   * @param {Object} data                  The data object
   * @param {number} data.templateId       Template ID (required)
   * @param {string} data.language         Language code (required)
   * @param {Object} [data.content]        Content to copy (optional; if omitted, creates minimal empty content)
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<Object>}
   */
  async addContent(data, options) {
    if (!data.templateId) throw new TranslatableError("errors.templates.templateIdRequired");
    if (!data.language) throw new TranslatableError("errors.templates.languageRequired");

    const template = await this.models["template"].getById(data.templateId);
    if (!template) {
      throw new TranslatableError("errors.templates.notFound");
    }
    if (template.userId !== this.userId) {
      throw new TranslatableError("errors.templates.addLanguageOwnOnly");
    }
    if (this.models["template"].emailTemplateTypes.includes(template.type) && !(await this.isAdmin())) {
      throw new TranslatableError("errors.templates.adminOnlyEmailTemplateEdit");
    }

    const templateContentModel = this.models["template_content"];
    const existing = await templateContentModel.getByTemplateIdAndLanguage(
      data.templateId,
      data.language,
      options
    );
    if (existing) {
      return { success: true, existing: true };
    }

    const content = data.content && data.content.ops
      ? data.content
      : { ops: [{ insert: "\n" }] };

    await templateContentModel.add(
      { templateId: data.templateId, language: data.language, content },
      { transaction: options.transaction }
    );
    return { success: true, existing: false };
  }

  /**
   * Resolve template placeholders with context data
   *
   * Resolves all placeholders in a template using the provided context data.
   * Uses context.language or template.defaultLanguage to pick content from template_content.
   * Returns resolved content as HTML string or Quill Delta object.
   *
   * @socketEvent templateResolve
   * @param {Object} data                            The data object
   * @param {number} data.templateId                 Template ID (required)
   * @param {Object} data.context                    Context object for placeholder resolution (required)
   * @param {number} [data.context.userId]           User/participant ID
   * @param {number} [data.context.creatorId]        Study creator ID
   * @param {number} [data.context.studyId]          Study ID (for anonymization check)
   * @param {number} [data.context.studySessionId]   Study session ID
   * @param {number} [data.context.studyStepId]     Study step ID (prompt placeholders, editor resolution)
   * @param {number} [data.context.documentId]      Document ID (prompt placeholders)
   * @param {string} [data.context.pdfText]         Extracted text for the current PDF (`~pdfText~`; caller-supplied)
   * @param {Object} [data.context.submissionPdfTexts] Optional map documentId -> string for submission PDF text extraction
   * @param {Object} [data.context.placeholderMapping] Per-key index maps for bracket tokens (e.g. submissionFiles: { 1: documentId, 3: documentId })
   * @param {string} [data.context.editorText]      Optional editor plain-text override (`~editorText~`)
   * @param {string} [data.context.studySessionHash] Study session hash (for link)
   * @param {string} [data.context.baseUrl]          Base URL for generating links
   * @param {string} [data.context.assignmentType]   Assignment type
   * @param {string} [data.context.assignmentName]   Assignment name
   * @param {boolean} [data.context.anonymize]       Override anonymization
   * @param {string} [data.format="html"]            Return format: "html" or "delta"
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<string|Object>} 
   */
  async resolveTemplatePlaceholders(data, options) {
    if (!data.templateId) throw new TranslatableError("errors.templates.templateIdRequired");
    if (!data.context || typeof data.context !== 'object') {
      throw new TranslatableError("errors.templates.contextObjectRequired");
    }
    const template = await this.models["template"].getById(data.templateId);
    if (!template) {
      throw new TranslatableError("errors.templates.notFound");
    }
    const isAdmin = await this.isAdmin();
    const isEmailTemplate = this.models["template"].emailTemplateTypes.includes(template.type);
    const isOwner = template.userId === this.userId;
    const isPublicFromOthers = template.public === true && !isOwner;

    if (!isAdmin && isEmailTemplate) {
      throw new TranslatableError("errors.templates.accessDenied");
    }
    if (!isAdmin && !isOwner && !isPublicFromOthers) {
      throw new TranslatableError("errors.templates.accessDenied");
    }
    if (!isAdmin) {
      await this.validateResolveContextAccess(data.context, options);
    }

    // Get baseUrl from settings if not provided in context
    if (!data.context.baseUrl) {
      const baseUrl = await this.models["setting"].get("system.baseUrl", options);
      data.context.baseUrl = baseUrl || "localhost:3000";
    }

    const format = data.format || "html";

    if (format === "delta") {
      return await resolveTemplateToDelta(
        data.templateId,
        data.context,
        this.models,
        options
      );
    } else {
      return await resolveTemplate(
        data.templateId,
        data.context,
        this.models,
        options
      );
    }
  }

  /**
   * Reject save when merged content contains duplicate placeholder ids or duplicate option names.
   *
   * @param {Object} content - Delta content with ops
   * @param {number} templateType - Template type
   * @param {Object} options - Sequelize options
   * @returns {Promise<void>}
   * @throws {Error}
   */
  async assertNoDuplicatePlaceholders(content, templateType, options = {}) {
    const duplicates = await getDuplicatePlaceholderIds(
      content,
      templateType,
      this.models,
      options
    );
    if (duplicates.length > 0) {
      throw new TranslatableError("errors.templates.duplicateBracketPlaceholders", {
        ids: duplicates.join(", "),
      });
    }
    const optionDuplicates = getDuplicatePlaceholderOptionTokens(content);
    if (optionDuplicates.length > 0) {
      throw new TranslatableError("errors.templates.duplicatePlaceholderOptions", {
        tokens: optionDuplicates.join(", "),
      });
    }
  }

  /**
   * Save template by merging draft edits into template_content for the given language
   *
   * Merges all draft edits (draft=true) from template_edit for (templateId, language) into
   * the content row in template_content, then marks edits as draft=false.
   * Called when the editor is closed or when switching language.
   *
   * @param {number} templateId            Template ID to save
   * @param {string} language              Language code (e.g. 'en', 'de')
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<void>}
   */
  async saveTemplate(templateId, language, options = {}) {
    const template = await this.models["template"].getById(templateId);
    if (!template) {
      this.logger.error(`Template not found.`);
      return;
    }

    const edits = await this.models["template_edit"].getDrafts(templateId, language, options);

    const templateContentModel = this.models["template_content"];
    const langRow = await templateContentModel.getByTemplateIdAndLanguage(
      templateId,
      language,
      options
    );
    let baseContent = new Delta();
    if (langRow && langRow.content && langRow.content.ops) {
      baseContent = new Delta(langRow.content.ops);
    }

    if (edits.length === 0) {
      if (this.models["template"].emailTemplateTypes.includes(template.type)) {
        const missing = await getMissingRequiredPlaceholders(
          { ops: baseContent.ops },
          template.type,
          this.models,
          options
        );
        if (missing.length > 0) {
          const { key, params } = formatMissingPlaceholderError(missing, { action: "saving" });
          throw new TranslatableError(key, params);
        }
      }
      await this.assertNoDuplicatePlaceholders(
        { ops: baseContent.ops },
        template.type,
        options
      );
      return;
    }

    const editsDelta = new Delta(dbToDelta(edits));
    const mergedDelta = baseContent.compose(editsDelta);

    // Email templates must include all required placeholders
    if (this.models["template"].emailTemplateTypes.includes(template.type)) {
      const missing = await getMissingRequiredPlaceholders(
        { ops: mergedDelta.ops },
        template.type,
        this.models,
        options
      );
      if (missing.length > 0) {
        const { key, params } = formatMissingPlaceholderError(missing, { action: "saving" });
        throw new TranslatableError(key, params);
      }
    }

    await this.assertNoDuplicatePlaceholders(
      { ops: mergedDelta.ops },
      template.type,
      options
    );

    const contentPayload = { content: { ops: mergedDelta.ops } };
    if (langRow) {
      await templateContentModel.updateById(langRow.id, contentPayload, options);
    } else {
      await templateContentModel.add(
        { templateId, language, content: contentPayload.content },
        { transaction: options.transaction }
      );
    }

    await this.models["template_edit"].markMerged(edits.map((e) => e.id), options);

    // Copies show "Update available" off the source's updatedAt
    await this.models["template"].touch(templateId, options);

    this.logger.info(`Template saved successfully.`);
  }

  /**
   * Close template and save if owner
   *
   * Called when the template editor is closed. Saves the current language's content.
   *
   * @socketEvent templateClose
   * @param {Object} data                  The data object
   * @param {number} data.templateId       Template ID (required)
   * @param {string} data.language         Language code (required)
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<void>}
   */
  async closeTemplate(data, options) {
    if (!data.templateId) throw new TranslatableError("errors.templates.templateIdRequired");
    if (!data.language) throw new TranslatableError("errors.templates.languageRequired");

    const template = await this.models["template"].getById(data.templateId);
    if (!template) return;

    if (this.models["template"].emailTemplateTypes.includes(template.type) && !(await this.isAdmin())) {
      throw new TranslatableError("errors.templates.adminOnlyEmailTemplateEdit");
    }

    if (template.userId === this.userId) {
      await this.saveTemplate(data.templateId, data.language, options);
    }
  }

  /**
   * Discard draft edits for a template language without merging into template_content.
   *
   * Used when the user leaves the editor after declining to save invalid content.
   *
   * @socketEvent templateDiscardDrafts
   * @param {Object} data
   * @param {number} data.templateId Template ID (required)
   * @param {string} data.language   Language code (required)
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<void>}
   */
  async discardDrafts(data, options) {
    if (!data.templateId) throw new TranslatableError("errors.templates.templateIdRequired");
    if (!data.language) throw new TranslatableError("errors.templates.languageRequired");

    const template = await this.models["template"].getById(data.templateId);
    if (!template) return;

    if (template.userId === this.userId) {
      await this.models["template_edit"].discardDrafts(
        data.templateId,
        data.language,
        options
      );
    }
  }

  /**
   * Detach a template copy from its source (set sourceId to null).
   * After detachment, the template can be edited like any user-created template.
   *
   * @socketEvent templateDetach
   * @param {Object} data
   * @param {number} data.templateId - The copy's template ID (required)
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<Object>}
   */
  async detachTemplate(data, options) {
    if (!data.templateId) throw new TranslatableError("errors.templates.templateIdRequired");

    const copy = await this.models["template"].getById(data.templateId);
    if (!copy) throw new TranslatableError("errors.templates.notFound");
    if (copy.userId !== this.userId) throw new TranslatableError("errors.templates.detachOwnCopiesOnly");
    if (!copy.sourceId) throw new TranslatableError("errors.templates.notACopy");

    return await this.models["template"].detach(
      data.templateId,
      { transaction: options.transaction }
    );
  }

  /**
   * Copy a public template to the current user's template list
   *
   * @socketEvent templateCopy
   * @param {Object} data
   * @param {number} data.sourceTemplateId - Source template ID (required)
   * @param {boolean} [data.force=false] - Skip duplicate check (for "Make new copy")
   * @param {number} [data.detachTemplateId] - If set, detach this copy after creating the new one
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<Object>}
   */
  async copyTemplate(data, options) {
    if (!data.sourceTemplateId) throw new TranslatableError("errors.templates.sourceTemplateIdRequired");

    const source = await this.models["template"].getById(data.sourceTemplateId);
    if (!(await this.isAdmin()) && this.models["template"].emailTemplateTypes.includes(source?.type)) {
      throw new TranslatableError("errors.templates.adminOnlyEmailTemplateCopy");
    }

    const copiedTemplate = await this.models["template"].copyTemplate(
      data.sourceTemplateId,
      this.userId,
      { force: data.force || false },
      { transaction: options.transaction }
    );

    if (data.detachTemplateId) {
      const toDetach = await this.models["template"].getById(data.detachTemplateId);
      if (toDetach && toDetach.userId === this.userId && toDetach.sourceId) {
        await this.models["template"].detach(
          data.detachTemplateId,
          { transaction: options.transaction }
        );
      }
    }

    return copiedTemplate;
  }

  /**
   * Update a copied template with the latest content from its source
   *
   * @socketEvent templateUpdateFromSource
   * @param {Object} data
   * @param {number} data.templateId - The copy's template ID (required)
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<Object>}
   */
  async updateFromSource(data, options) {
    if (!data.templateId) throw new TranslatableError("errors.templates.templateIdRequired");

    const copy = await this.models["template"].getById(data.templateId);
    if (!copy) throw new TranslatableError("errors.templates.notFound");
    if (copy.userId !== this.userId) throw new TranslatableError("errors.templates.updateOwnCopiesOnly");
    if (this.models["template"].emailTemplateTypes.includes(copy.type) && !(await this.isAdmin())) {
      throw new TranslatableError("errors.templates.adminOnlyEmailTemplateUpdateFromSource");
    }

    return await this.models["template"].updateFromSource(
      data.templateId,
      { transaction: options.transaction }
    );
  }

  /**
   * Soft-delete a template after verifying ownership and usage constraints.
   *
   * @socketEvent templateDelete
   * @param {Object} data
   * @param {number} data.templateId - The template ID to delete (required)
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<Object>}
   */
  async deleteTemplate(data, options) {
    if (!data.templateId) throw new TranslatableError("errors.templates.templateIdRequired");

    const template = await this.models["template"].getById(data.templateId, {transaction: options.transaction});
    if (!template) {
      throw new TranslatableError("errors.templates.notFound");
    }

    if (template.userId !== this.userId) {
      throw new TranslatableError("errors.templates.deleteOwnOnly");
    }

    if (template.public && this.models["template"].emailTemplateTypes.includes(template.type)) {
      throw new TranslatableError("errors.templates.publicEmailCannotDelete");
    }

    if (this.models["template"].emailTemplateTypes.includes(template.type)) {
      const usedBySettings = await this.models["setting"].findAll({
        where: {
          key: {[Op.like]: "email.template.%"},
          value: String(template.id),
        },
        raw: true,
        transaction: options.transaction,
      });
      if (usedBySettings.length > 0) {
        const settingNames = usedBySettings.map(s => s.key.replace("email.template.", "")).join(", ");
        throw new TranslatableError( "errors.templates.assignedEmailTemplate", {settingNames});
      }
    }

    return await this.models["template"].deleteById(data.templateId, {transaction: options.transaction});
  }

  /**
   * Saved body text for templates the caller owns.
   * Export all is the dashboard table: own rows, including copies. Another user's
   * public template is not included. template_content is not in the client store.
   * sourceId is omitted because it only points at a row in this database.
   * Drafts in template_edit are not included.
   *
   * @socketEvent templateExport
   * @param {Object} data
   * @param {number} [data.templateId]
   * @param {Object} options
   * @returns {Promise<Object>}
   * @throws {TranslatableError}
   */
  async exportTemplates(data, options) {
    const Template = this.models["template"];
    const isAdmin = await this.isAdmin();
    const templates = await Template.findOwnedWithContent(
      this.userId,
      isAdmin,
      data?.templateId,
      options
    );

    if (data?.templateId && templates.length === 0) {
      throw new TranslatableError("errors.templates.notFound");
    }

    return templates.map((template) => {
      const row = template.get({ plain: true });
      return {
        name: row.name,
        description: row.description,
        type: row.type,
        defaultLanguage: row.defaultLanguage,
        public: row.public,
        template_content: (row.template_contents || []).map((contentRow) => ({
          language: contentRow.language,
          content: contentRow.content,
        })),
      };
    });
  }

  /**
   * Create a template from an export file, including each saved language body.
   * Uses this.userId. A userId or sourceId in the file is ignored so the row
   * is not a locked copy of a template that only exists in the source database.
   * public is always false. Publishing stays on the existing publish action.
   *
   * @socketEvent templateImport
   * @param {Object} data
   * @param {Array<Object>} [data.template_content]
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<Object>}
   * @throws {TranslatableError}
   */
  async importTemplate(data, options) {
    const isAdmin = await this.isAdmin();
    const type = this.models["template"].assertCreateAllowed({
      name: data?.name,
      description: data?.description,
      type: data?.type,
    }, isAdmin);

    const contents = data?.template_content ?? [];
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
        throw new TranslatableError("errors.templates.duplicateImportLanguage", { language: row.language });
      }
      seen.add(row.language);
      rows.push(row);
    }

    const defaultLanguage = data?.defaultLanguage || rows[0]?.language || "en";
    if (rows.length > 0 && !seen.has(defaultLanguage)) {
      throw new TranslatableError("errors.templates.importDefaultLanguageMissing", { language: defaultLanguage });
    }

    for (const row of rows) {
      await this.assertNoDuplicatePlaceholders(row.content, type, options);
    }

    return this.models["template"].createWithContents({
      name: data?.name,
      description: data?.description,
      type: data?.type,
      defaultLanguage,
      public: false,
      userId: this.userId,
    }, rows, {
      transaction: options.transaction,
      isAdmin,
    });
  }

  init() {
    this.createSocket("templateAdd", this.createTemplate, {}, true);
    this.createSocket("templateGetContent", this.getContent, {}, false);
    this.createSocket("templateGetLanguages", this.getLanguages, {}, false);
    this.createSocket("templateEditContent", this.editContent, {}, true);
    this.createSocket("templateAddLanguageContent", this.addContent, {}, true);
    this.createSocket("templateClose", this.closeTemplate, {}, true);
    this.createSocket("templateDiscardDrafts", this.discardDrafts, {}, true);
    this.createSocket("templatePlaceholderAdd", this.addPlaceholder, {}, true);
    this.createSocket("templatePlaceholderUpdate", this.updatePlaceholder, {}, true);
    this.createSocket("templatePlaceholderGetAll", this.getAllPlaceholders, {}, false);
    this.createSocket("templatePlaceholderGetUsed", this.getUsedPlaceholders, {}, false);
    this.createSocket("templateResolve", this.resolveTemplatePlaceholders, {}, false);
    this.createSocket("templateCopy", this.copyTemplate, {}, true);
    this.createSocket("templateDetach", this.detachTemplate, {}, true);
    this.createSocket("templateUpdateFromSource", this.updateFromSource, {}, true);
    this.createSocket("templateDelete", this.deleteTemplate, {}, true);
    this.createSocket("templateExport", this.exportTemplates, {}, false);
    this.createSocket("templateImport", this.importTemplate, {}, true);
  }
}

module.exports = TemplateSocket;
module.exports.listTemplates = listTemplates;
module.exports.exportTemplates = exportTemplates;
module.exports.importTemplate = importTemplate;
module.exports.createTemplate = createTemplate;
module.exports.updateTemplate = updateTemplate;
module.exports.setTemplateContent = setTemplateContent;
module.exports.removeTemplateLanguage = removeTemplateLanguage;
module.exports.copyTemplate = copyTemplate;
module.exports.deleteTemplate = deleteTemplate;
