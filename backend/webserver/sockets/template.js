"use strict";
const Socket = require("../Socket");
const Delta = require("quill-delta");
const {dbToDelta} = require("editor-delta-conversion");
const {resolveTemplate, resolveTemplateToDelta} = require("../../utils/templateResolver");

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
   * @param {Object} data.content          Template content (JSON, required)
   * @param {boolean} [data.hidden=false]  Hide in frontend
   * @param {Object} options               
   * @param {Object} options.transaction   
   * @returns {Promise<Object>}            
   */
  async createTemplate(data, options) {
    if (!(await this.isAdmin())) throw new Error("Access denied");
    if (!data.name || !data.description || data.type === undefined || data.content === undefined) {
        throw new Error("Missing required fields: name, description, type, content");
    }
    const payload = {
      name: data.name,
      description: data.description,
      type: data.type,
      content: data.content,
      hidden: data.hidden ?? false,
      userId: this.userId,
    };

    const template = await this.models["template"].add(payload, { transaction: options.transaction });
    
    // Create placeholder mappings if provided
    if (data.placeholders && Array.isArray(data.placeholders) && data.placeholders.length > 0) {
      const placeholderPromises = data.placeholders.map(placeholder => {
        return this.models["template_placeholder_mapping"].add({
          templateId: template.id,
          placeholderKey: placeholder.placeholderKey || placeholder.key,
          placeholderLabel: placeholder.placeholderLabel || placeholder.label,
          placeholderType: placeholder.placeholderType || placeholder.type,
          required: placeholder.required ?? false,
        }, { transaction: options.transaction });
      });
      
      await Promise.all(placeholderPromises);
    }
    
    return template;
  }

   /**
   * Get template content (deltas) for editor
   *
   * Fetches the template and returns its content as Quill Delta format for the editor to load.
   * Only admins can access template content (since only admins can access the editor).
   *
   * @socketEvent templateGetContent
   * @param {Object} data                  The data object
   * @param {number} data.templateId       Template ID (required)
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<Object>}            
   */
  async getContent(data, options){
    if (!(await this.isAdmin())) throw new Error("Access denied");
    if (!data.templateId) throw new Error("Template ID is required");

    const template = await this.models["template"].getById(data.templateId);
    if (!template) {
      throw new Error("Template not found");
    }
    let delta = new Delta();
    if (template.content && template.content.ops) {
      delta = new Delta(template.content.ops);
    } else if (template.content){
      delta = new Delta();
    }
    return {template: template, deltas: delta};
  }

  /**
   * Save template content edits (deltas)
   *
   * Saves content edits to the template. Composes new edits with existing content
   * (similar to document editing). Only admins can edit template content.
   *
   * @socketEvent templateEditContent
   * @param {Object} data                  The data object
   * @param {number} data.templateId       Template ID (required)
   * @param {Array<Object>} data.ops        Delta operations in database format (from deltaToDb)
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<Object>}
   */
  async editContent(data, options) {
    if (!(await this.isAdmin())) throw new Error("Access denied");
    if (!data.templateId) throw new Error("Template ID is required");
    if (!data.ops || !Array.isArray(data.ops)) {
      throw new Error("Delta operations are required");
    }

    const template = await this.models["template"].getById(data.templateId);
    if (!template) {
      throw new Error("Template not found");
    }
    const newDelta = dbToDelta(data.ops);
    let existingDelta = new Delta();
    if (template.content && template.content.ops) {
      existingDelta = new Delta(template.content.ops);
    }
    const composedDelta = existingDelta.compose(newDelta);

    return await this.models["template"].updateById(
      data.templateId,
      { content: {ops: composedDelta.ops} },
      { transaction: options.transaction }
    );
  }


  /**
   * Update a template
   *
   * @socketEvent templateUpdate
   * @param {Object} data                  The data object containing the template update
   * @param {number} data.id               Template ID to update (required)
   * @param {string} [data.name]           New name
   * @param {string} [data.description]    New description
   * @param {Object} [data.content]        New content (JSON)
   * @param {boolean} [data.hidden]        New hidden flag
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<Object>}
   */
  async updateTemplate(data, options) {
    if (!(await this.isAdmin())) throw new Error("Access denied");
    if (!data.id) throw new Error("Template ID is required");
    
    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.hidden !== undefined) updateData.hidden = data.hidden;

    return await this.models["template"].updateById(
        data.id,
        updateData,
        { transaction: options.transaction }
    );
  }


  /**
   * Add a placeholder to a template
   *
   * @socketEvent templatePlaceholderAdd
   * @param {Object} data                   The data object
   * @param {number} data.templateId        Template ID (required)
   * @param {string} data.placeholderKey    Placeholder key (required, e.g., "username")
   * @param {string} data.placeholderLabel  Placeholder label (required, e.g., "Username")
   * @param {string} data.placeholderType   Placeholder type (required, e.g., "user")
   * @param {boolean} [data.required=false] Whether placeholder is required
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<Object>}
   */
  async addPlaceholder(data, options) {
    if (!(await this.isAdmin())) throw new Error("Access denied");
    if (!data.templateId) throw new Error("Template ID is required");
    if (!data.placeholderKey || !data.placeholderLabel || !data.placeholderType) {
      throw new Error("Missing required fields: placeholderKey, placeholderLabel, placeholderType");
    }

    const template = await this.models["template"].getById(data.templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    const payload = {
      templateId: data.templateId,
      placeholderKey: data.placeholderKey,
      placeholderLabel: data.placeholderLabel,
      placeholderType: data.placeholderType,
      required: data.required ?? false,
    };

    return await this.models["template_placeholder_mapping"].add(
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
    if (!(await this.isAdmin())) throw new Error("Access denied");
    if (!data.id) throw new Error("Placeholder ID is required");

    const updateData = {};
    if (data.placeholderLabel !== undefined) updateData.placeholderLabel = data.placeholderLabel;
    if (data.placeholderType !== undefined) updateData.placeholderType = data.placeholderType;
    if (data.required !== undefined) updateData.required = data.required;

    if (Object.keys(updateData).length === 0) {
      throw new Error("No fields to update");
    }

    return await this.models["template_placeholder_mapping"].updateById(
      data.id,
      updateData,
      { transaction: options.transaction }
    );
  }


  /**
   * Get all placeholders for a template
   *
   * @socketEvent templatePlaceholderGetAll
   * @param {Object} data                  The data object
   * @param {number} data.templateId       Template ID (required)
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<Array>}
   */
  async getAllPlaceholders(data, options) {
    if (!(await this.isAdmin())) throw new Error("Access denied");
    if (!data.templateId) throw new Error("Template ID is required");

    const template = await this.models["template"].getById(data.templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    return await this.models["template_placeholder_mapping"].getAllByKey(
      "templateId",
      data.templateId,
      { transaction: options.transaction }
    );
  }


  /**
   * Resolve template placeholders with context data
   *
   * Resolves all placeholders in a template using the provided context data.
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
    if (!(await this.isAdmin())) throw new Error("Access denied");
    if (!data.templateId) throw new Error("Template ID is required");
    if (!data.context || typeof data.context !== 'object') {
      throw new Error("Context object is required");
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

  init() {
    this.createSocket("templateAdd", this.createTemplate, {}, true);
    this.createSocket("templateUpdate", this.updateTemplate, {}, true);
    this.createSocket("templateGetContent", this.getContent, {}, false);
    this.createSocket("templateEditContent", this.editContent, {}, true);
    this.createSocket("templatePlaceholderAdd", this.addPlaceholder, {}, true);
    this.createSocket("templatePlaceholderUpdate", this.updatePlaceholder, {}, true);
    this.createSocket("templatePlaceholderGetAll", this.getAllPlaceholders, {}, false);
    this.createSocket("templateResolve", this.resolveTemplatePlaceholders, {}, false);
  }
}

module.exports = TemplateSocket;