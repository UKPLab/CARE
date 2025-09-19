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
  async getConfigFiles(data, options) {
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
      { content, updatedAt: new Date() },
      { transaction: options.transaction }
    );

    return updatedConfig;
  }

  init() {
    this.createSocket("configurationGetByType", this.getConfigFiles, {}, false);
    this.createSocket("configurationUpdate", this.updateConfiguration, {}, true);
  }
}

module.exports = ConfigurationSocket;
