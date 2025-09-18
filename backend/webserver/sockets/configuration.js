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

  init() {
    this.createSocket("configurationGetByType", this.getConfigFiles, {}, false);
  }
}

module.exports = ConfigurationSocket;
