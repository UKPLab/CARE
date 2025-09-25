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
   * Get configuration files filtered by type
   *
   * @param {Object} data The data object containing the configuration type filter
   * @param {number} data.type The type of configuration to retrieve (e.g., 0='assessment', 1='validation')
   * @param {Object} options Additional configuration parameters
   * @returns {Promise<Object[]>} A list of configuration files
   */
  async getConfigurations(data, options) {
    const { type } = data;

    if (typeof type === "undefined" || type === null) {
      throw new Error("Configuration type is required");
    }

    if (typeof type !== "number") {
      throw new Error("Unknown configuration type");
    }

    // Apply access filters
    const baseWhere = { deleted: false, type };
    const { filter, attributes, accessAllowed } = await this.getFiltersAndAttributes(
      this.userId,
      baseWhere,
      { exclude: ["deleted", "deletedAt"] },
      "configuration"
    );
    if (!accessAllowed) {
      throw new Error("Access denied");
    }

    const rows = await this.models["configuration"].getAll({ where: filter, attributes });

    const configs = rows.map((cfg) => ({
      id: cfg.id,
      name: cfg.name,
      userId: cfg.userId,
      config: cfg.content,
    }));

    return configs;
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
    this.createSocket("configurationGetByType", this.getConfigurations, {}, false);
    this.createSocket("configurationUpdate", this.updateConfiguration, {}, true);
    this.createSocket("configurationAdd", this.createConfiguration, {}, true);
  }
}

module.exports = ConfigurationSocket;
