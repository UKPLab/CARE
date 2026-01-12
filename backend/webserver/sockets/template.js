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
   * @param {boolean} [data.published=false]  Publish template (makes it visible to all users, cannot be undone)
   * @param {Object} options               
   * @param {Object} options.transaction   
   * @returns {Promise<Object>}            
   */
  async createTemplate(data, options) {
    if (!data.name || !data.description || data.type === undefined || data.content === undefined) {
        throw new Error("Missing required fields: name, description, type, content");
    }
    
    // Non-admins can only create types 2, 3, 4, 5 (not type 1)
    if (!(await this.isAdmin()) && data.type === 1) {
      throw new Error("Access denied: Only administrators can create Type 1 (Email - General) templates");
    }
    
    const payload = {
      name: data.name,
      description: data.description,
      type: data.type,
      content: data.content,
      published: data.published ?? false,
      userId: this.userId,
    };

    const template = await this.models["template"].add(payload, { transaction: options.transaction });
    

    
    return template;
  }

   /**
   * Get template content (deltas) for editor
   *
   * Fetches the template and returns its content as Quill Delta format for the editor to load.
   * All users can access template content for their own templates or published templates from others.
   *
   * @socketEvent templateGetContent
   * @param {Object} data                  The data object
   * @param {number} data.templateId       Template ID (required)
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<Object>}            
   */
  async getContent(data, options){
    if (!data.templateId) throw new Error("Template ID is required");

    const template = await this.models["template"].getById(data.templateId);
    if (!template) {
      throw new Error("Template not found");
    }
    
    // Allow viewing:
    // - Own templates (always, for all users including admins)
    // - Published templates from others (view-only, for all users including admins)
    // - Admins follow the same rules as regular users
    const isOwner = template.userId === this.userId;
    const isPublishedFromOthers = template.published === true && !isOwner;
    
    if (!isOwner && !isPublishedFromOthers) {
      throw new Error("You can only view templates that you own or published templates from others");
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
   * (similar to document editing). Users can only edit content of their own templates.
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
    if (!data.templateId) throw new Error("Template ID is required");
    if (!data.ops || !Array.isArray(data.ops)) {
      throw new Error("Delta operations are required");
    }

    const template = await this.models["template"].getById(data.templateId);
    if (!template) {
      throw new Error("Template not found");
    }
    
    // Check ownership: users (including admins) can only edit content of their own templates
    // Published templates from others are view-only (can't edit content)
    if (template.userId !== this.userId) {
      throw new Error("You can only edit content of templates that you own");
    }
    
    // Prevent editing published templates from others (view-only)
    if (template.published === true && template.userId !== this.userId) {
      throw new Error("Published templates from other users are view-only and cannot be edited");
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
   * @param {boolean} [data.published]     New published flag (can only be set to true, cannot be unpublished)
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<Object>}
   */
  async updateTemplate(data, options) {
    if (!data.id) throw new Error("Template ID is required");
    
    // Get current template to check ownership and published status
    const currentTemplate = await this.models["template"].getById(data.id);
    if (!currentTemplate) {
      throw new Error("Template not found");
    }
    
    // Check ownership: users (including admins) can only update their own templates
    if (currentTemplate.userId !== this.userId) {
      throw new Error("You can only update templates that you own");
    }
    
    // Prevent editing published templates from others (view-only)
    if (currentTemplate.published === true && currentTemplate.userId !== this.userId) {
      throw new Error("Published templates from other users are view-only and cannot be edited");
    }
    
    // Prevent unpublishing: if template is published, cannot set to false
    if (currentTemplate.published === true && data.published === false) {
      throw new Error("Cannot unpublish a template once it has been published");
    }
    
    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.published !== undefined) updateData.published = data.published;

    return await this.models["template"].updateById(
        data.id,
        updateData,
        { transaction: options.transaction }
    );
  }


  /**
   * Add a placeholder to a template type
   *
   * @socketEvent templatePlaceholderAdd
   * @param {Object} data                   The data object
   * @param {number} data.templateType      Template type (required, 1-5)
   * @param {string} data.placeholderKey    Placeholder key (required, e.g., "username")
   * @param {string} data.placeholderLabel  Placeholder label (required, e.g., "Username")
   * @param {string} data.placeholderType   Placeholder type (required, e.g., "text")
   * @param {boolean} [data.required=false] Whether placeholder is required
   * @param {Object} options
   * @param {Object} options.transaction
   * @returns {Promise<Object>}
   */
  async addPlaceholder(data, options) {
    if (!(await this.isAdmin())) throw new Error("Access denied");
    if (!data.templateType || ![1, 2, 3, 4, 5].includes(data.templateType)) {
      throw new Error("Template type is required and must be 1-5");
    }
    if (!data.placeholderKey || !data.placeholderLabel || !data.placeholderType) {
      throw new Error("Missing required fields: placeholderKey, placeholderLabel, placeholderType");
    }

    const payload = {
      templateType: data.templateType,
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
    if (!data.templateId) throw new Error("Template ID is required");

    const template = await this.models["template"].getById(data.templateId);
    if (!template) {
      throw new Error("Template not found");
    }
    
    // Check access: users (including admins) can view placeholders for their own templates or published templates from others
    const isOwner = template.userId === this.userId;
    const isPublishedFromOthers = template.published === true && !isOwner;
    
    if (!isOwner && !isPublishedFromOthers) {
      throw new Error("Access denied: You can only view placeholders for templates that you own or published templates from others");
    }

    return await this.models["template_placeholder_mapping"].getAllByKey(
      "templateType",
      template.type,
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