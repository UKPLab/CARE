"use strict";
const Socket = require("../Socket");

/**
 * Handle configuration files through websocket
 *
 * @author Linyin Huang
 * @type {ConfigurationSocket}
 * @class ConfigurationSocket
 */
class ConfigurationSocket extends Socket {
  /**
   * Get configuration by id
   * @param {Object} data
   * @param {number} data.configurationId
   * @returns {Promise<Object>} configuration row
   */
  async getConfiguration(data, options) {
    const { configurationId } = data;
    if (!configurationId) {
      throw new Error("Configuration ID is required");
    }

    const config = await this.models["configuration"].getById(configurationId);
    if (!config) {
      throw new Error("Configuration not found");
    }

    const { accessAllowed } = await this.getFiltersAndAttributes(
      this.userId,
      { id: configurationId },
      {},
      "configuration"
    );
    if (!accessAllowed) {
      throw new Error("Access denied");
    }
    return config;
  }
  /**
   * Update configuration content
   *
   * @param {Object} data The data object containing the configuration update
   * @param {number} data.configurationId The ID of the configuration to update
   * @param {Object} data.content The new JSON content for the configuration
   * @param {Object} options Additional configuration parameters
   * @returns {Promise<Object>} The updated configuration
   */
  async updateConfiguration(data, options) {
    const { configurationId, content } = data;

    if (!configurationId) {
      throw new Error("Configuration ID is required");
    }

    if (!content) {
      throw new Error("Configuration content is required");
    }

    // Get the existing configuration
    const existingConfig = await this.models["configuration"].getById(configurationId);

    if (!existingConfig) {
      throw new Error("Configuration not found");
    }

    // Check if user has access to update this configuration
    const { accessAllowed } = await this.getFiltersAndAttributes(
      this.userId,
      { id: configurationId },
      {},
      "configuration"
    );
    
    if (!accessAllowed) {
      throw new Error("Access denied");
    }

    // Update only the content field
    const updatedConfig = await this.models["configuration"].updateById(
      configurationId,
      { content },
      { transaction: options.transaction }
    );

    return updatedConfig;
  }

  /**
   * Create a configuration entry
   *
   * @param {Object} data The data object containing the configuration info
   * @param {string} data.name The name of the configuration
   * @param {string} data.description The description of the configuration
   * @param {number} data.type The type of the configuration (e.g., 0='assessment', 1='validation')
   * @param {Object} data.content The JSON content of the configuration
   * @param {Object} options Additional configuration parameters
   * @returns {Promise<Object>} The created configuration
   */
  async createConfiguration(data, options) {
    if (!(await this.isAdmin())) {
      throw new Error("You do not have permission to create configurations for other users.");
    }
    const payload = {
      name: data.name,
      description: data.description || "",
      userId: this.userId,
      type: data.type,
      content: data.content,
    };
    const configuration = await this.models["configuration"].add(payload, { transaction: options.transaction });
    return configuration;
  }

  init() {
    this.createSocket("configurationUpdate", this.updateConfiguration, {}, true);
    this.createSocket("configurationAdd", this.createConfiguration, {}, true);
    this.createSocket("configurationGet", this.getConfiguration, {}, false);
  }
}

module.exports = ConfigurationSocket;
