"use strict";
const Socket = require("../Socket");
const Delta = require("quill-delta");
const {dbToDelta} = require("editor-delta-conversion");

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
    return await this.models["template"].add(payload, { transaction: options.transaction });
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
  init() {
    this.createSocket("templateAdd", this.createTemplate, {}, true);
    this.createSocket("templateUpdate", this.updateTemplate, {}, true);
    this.createSocket("templateGetContent", this.getContent, {}, false);
    this.createSocket("templateEditContent", this.editContent, {}, true);
  }
}

module.exports = TemplateSocket;