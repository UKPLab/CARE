"use strict";
const Socket = require("../Socket");
const Delta = require("quill-delta");
const {Op} = require("sequelize");
const {dbToDelta} = require("editor-delta-conversion");
const {
  resolveTemplate,
  resolveTemplateToDelta,
  getMissingRequiredPlaceholders,
  formatMissingPlaceholderError,
} = require("../../utils/helper/templateResolver");
const TranslatableError = require("../../utils/TranslatableError");

/**
 * Handle templates through websocket
 *
 * @author Mohammad Elwan
 * @type {TemplateSocket}
 * @class TemplateSocket
 */
class TemplateSocket extends Socket {

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
    if (!data.name || !data.description || data.type === undefined || data.content === undefined) {
        throw new TranslatableError("errors.templates.missingCreateFields");
    }
    if (!(await this.isAdmin()) && [1, 2, 3, 6, 7].includes(data.type)) {
      throw new TranslatableError("errors.templates.adminOnlyEmailTemplateCreate");
    }

    const defaultLanguage = data.defaultLanguage || "en";
    const templatePayload = {
      name: data.name,
      description: data.description,
      type: data.type,
      defaultLanguage,
      public: data.public ?? false,
      userId: this.userId,
    };

    const template = await this.models["template"].add(templatePayload, { transaction: options.transaction });

    await this.models["template_content"].add(
      {
        templateId: template.id,
        language: defaultLanguage,
        content: data.content,
      },
      { transaction: options.transaction }
    );

    return template;
  }

  /**
   * Get template content (deltas) for editor
   *
   * Fetches the template and returns its content as Quill Delta format for the given language.
   * - For owners: returns stable content from template_content composed with draft edits (like documents)
   * - For non-owners: returns only stable content (no drafts)
   *
   * @socketEvent templateGetContent
   * @param {Object} data                  The data object
   * @param {number} data.templateId       Template ID (required)
   * @param {string} data.language         Language code (required, e.g. 'en', 'de')
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<Object>}            
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
    
    if (!isOwner && !isPublicFromOthers) {
      throw new TranslatableError("errors.templates.viewOwnOrPublicOnly");
    }

    const langRow = await this.models["template_content"].findOne({
      where: { templateId: data.templateId, language: data.language, deleted: false },
      raw: true,
      ...options,
    });

    let delta = new Delta();
    if (langRow && langRow.content && langRow.content.ops) {
      delta = new Delta(langRow.content.ops);
    }

    if (isOwner) {
      const draftEdits = await this.models["template_edit"].findAll({
        where: { templateId: data.templateId, language: data.language, draft: true, deleted: false },
        order: [
          ["createdAt", "ASC"],
          ["order", "ASC"],
        ],
        raw: true,
        ...options,
      });

      if (draftEdits.length > 0) {
        const draftDelta = new Delta(dbToDelta(draftEdits));
        const composed = delta.compose(draftDelta);

        // Self-heal: drafts left unmerged by a forced URL navigation or tab close
        // (which bypass the editor's close/discard flow) must not resurface as if saved
        // when they omit required placeholders. Discard such invalid drafts and fall back
        // to stable content; valid drafts are still resumed.
        let composedIsInvalid = false;
        if ([1, 2, 3, 6, 7].includes(template.type)) {
          const missing = await getMissingRequiredPlaceholders(
            { ops: composed.ops },
            template.type,
            this.models,
            options
          );
          composedIsInvalid = missing.length > 0;
        }

        if (composedIsInvalid) {
          await this.models["template_edit"].update(
            { deleted: true, deletedAt: new Date() },
            {
              where: { templateId: data.templateId, language: data.language, draft: true, deleted: false },
              transaction: options.transaction,
            }
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
   * @param {number} data.templateType      Template type (required, 1-5)
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
    if (!data.templateType || ![1, 2, 3, 4, 5, 6, 7].includes(data.templateType)) {
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

    return await this.models["placeholder"].getAllByKey(
      "type",
      template.type,
      { transaction: options.transaction }
    );
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

    const rows = await this.models["template_content"].findAll({
      where: { templateId: data.templateId, deleted: false },
      attributes: ["language"],
      raw: true,
      ...options,
    });
    const languages = rows.map((r) => r.language).sort();
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

    const templateContentModel = this.models["template_content"];
    const existing = await templateContentModel.findOne({
      where: { templateId: data.templateId, language: data.language, deleted: false },
      raw: true,
      ...options,
    });
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
    if (!(await this.isAdmin())) throw new TranslatableError("errors.templates.accessDenied");
    if (!data.templateId) throw new TranslatableError("errors.templates.templateIdRequired");
    if (!data.context || typeof data.context !== 'object') {
      throw new TranslatableError("errors.templates.contextObjectRequired");
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

    const edits = await this.models["template_edit"].findAll({
      where: { templateId, language, draft: true, deleted: false },
      order: [
        ["createdAt", "ASC"],
        ["order", "ASC"],
      ],
      raw: true,
      ...options,
    });

    if (edits.length === 0) {
      if ([1, 2, 3, 6, 7].includes(template.type)) {
        const templateContentModel = this.models["template_content"];
        const langRow = await templateContentModel.findOne({
          where: { templateId, language, deleted: false },
          raw: true,
          ...options,
        });
        let baseContent = new Delta();
        if (langRow && langRow.content && langRow.content.ops) {
          baseContent = new Delta(langRow.content.ops);
        }
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
      return;
    }

    const templateContentModel = this.models["template_content"];
    const langRow = await templateContentModel.findOne({
      where: { templateId, language, deleted: false },
      raw: true,
      ...options,
    });

    let baseContent = new Delta();
    if (langRow && langRow.content && langRow.content.ops) {
      baseContent = new Delta(langRow.content.ops);
    }
    const editsDelta = new Delta(dbToDelta(edits));
    const mergedDelta = baseContent.compose(editsDelta);

    // Email templates (types 1, 2, 3, 6, 7) must include all required placeholders
    if ([1, 2, 3, 6, 7].includes(template.type)) {
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

    const contentPayload = { content: { ops: mergedDelta.ops } };
    if (langRow) {
      await templateContentModel.update(contentPayload, {
        where: { id: langRow.id },
        transaction: options.transaction,
      });
    } else {
      await templateContentModel.add(
        { templateId, language, content: contentPayload.content },
        { transaction: options.transaction }
      );
    }

    // Mark edits as draft:false
    await this.models["template_edit"].update(
      { draft: false },
      {
        where: { id: edits.map((e) => e.id) },
        transaction: options.transaction,
      }
    );

    // Touch template.updatedAt so "Update available" works for copies when source content changes
    // NOTE: Must use instance-level save — Model.update() and updateById both fail to persist updatedAt
    const templateInstance = await this.models["template"].findByPk(templateId, { transaction: options.transaction });
    templateInstance.changed('updatedAt', true);
    await templateInstance.save({ fields: ['updatedAt'], transaction: options.transaction });

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
      await this.models["template_edit"].update(
        { deleted: true, deletedAt: new Date() },
        {
          where: {
            templateId: data.templateId,
            language: data.language,
            draft: true,
            deleted: false,
          },
          transaction: options.transaction,
        }
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
    if (!(await this.isAdmin()) && [1, 2, 3, 6, 7].includes(source?.type)) {
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

    if (template.public && [1, 2, 3, 6, 7].includes(template.type)) {
      throw new TranslatableError("errors.templates.publicEmailCannotDelete");
    }

    if ([1, 2, 3, 6, 7].includes(template.type)) {
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
    this.createSocket("templateResolve", this.resolveTemplatePlaceholders, {}, false);
    this.createSocket("templateCopy", this.copyTemplate, {}, true);
    this.createSocket("templateDetach", this.detachTemplate, {}, true);
    this.createSocket("templateUpdateFromSource", this.updateFromSource, {}, true);
    this.createSocket("templateDelete", this.deleteTemplate, {}, true);
  }
}

module.exports = TemplateSocket;