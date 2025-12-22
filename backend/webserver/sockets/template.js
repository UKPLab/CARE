"use strict";
const Socket = require("../Socket");

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
    if (data.type !== undefined) throw new Error("Template type cannot be changed");
    
    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
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
  }
}

module.exports = TemplateSocket;