"use strict";

const TranslatableError = require("../../utils/TranslatableError");
const Socket = require("../Socket");
const {Op, literal, where: sqlWhere} = require("sequelize");
const {canOf, pickFields} = require("../utils/restHelpers");

/**
 * Configuration actions for /rest/v1 only (assessment rubrics and criteria, validation schemas,
 * dialogue plans). The socket methods below do not call these. Writing needs the right
 * frontend.dashboard.configurations.manage on the token; only REST checks that right.
 */

const CONFIGURATIONS_MANAGE = "frontend.dashboard.configurations.manage";
const CONFIGURATION_TYPES = {assessment: 0, validation: 1, dialoguePlan: 2};
const CONFIGURATION_PUBLIC_FIELDS = [
    "id", "name", "description", "type", "userId", "hideInFrontend", "content", "createdAt", "updatedAt",
];

function publicConfiguration(configuration) {
    return pickFields(configuration, CONFIGURATION_PUBLIC_FIELDS);
}

function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Check configuration content for its type. Assessment: rubrics with criteria, each with a name and
 * minPoints <= maxPoints. Validation: a rules object. Dialogue plan: any object.
 * Other keys are kept as they are, so files exported from the dashboard stay valid.
 * @returns {string|null} an error key, or null when the content fits
 */
function checkConfigurationContent(type, content) {
    if (!isObject(content)) {
        return "errors.rest.invalidConfigurationContent";
    }
    const isScore = (value) => typeof value === "number" && Number.isFinite(value);
    const pointsOk = (item) => isScore(item.minPoints) && isScore(item.maxPoints) && item.minPoints <= item.maxPoints;
    if (type === CONFIGURATION_TYPES.assessment) {
        if (!Array.isArray(content.rubrics) || content.rubrics.length === 0) {
            return "errors.rest.invalidConfigurationContent";
        }
        for (const rubric of content.rubrics) {
            if (!isObject(rubric) || typeof rubric.name !== "string" || !rubric.name
                || !Array.isArray(rubric.criteria) || rubric.criteria.length === 0) {
                return "errors.rest.invalidConfigurationContent";
            }
            for (const criterion of rubric.criteria) {
                if (!isObject(criterion) || typeof criterion.name !== "string" || !criterion.name || !pointsOk(criterion)) {
                    return "errors.rest.invalidConfigurationContent";
                }
            }
        }
    }
    if (type === CONFIGURATION_TYPES.validation && !isObject(content.rules)) {
        return "errors.rest.invalidConfigurationContent";
    }
    return null;
}

/**
 * Configurations the caller may read: not hidden, or their own. Configurations are a public table in
 * the dashboard too.
 */
async function listConfigurations({userId}, options) {
    const rows = await options.models["configuration"].findAll({
        where: {deleted: false, [Op.or]: [{hideInFrontend: {[Op.not]: true}}, {userId}]},
        order: [["id", "ASC"]],
        raw: true,
    });
    return rows.map(publicConfiguration);
}

async function getConfiguration({userId, id}, options) {
    const row = await options.models["configuration"].getById(id);
    if (!row) {
        return null;
    }
    if (row.hideInFrontend && row.userId !== userId) {
        throw new TranslatableError("errors.rest.configurationNoAccess");
    }
    return publicConfiguration(row);
}

async function loadOwnConfiguration(options, userId, id) {
    if (!(await canOf(options)(CONFIGURATIONS_MANAGE))) {
        throw new TranslatableError("errors.rest.missingTokenRight");
    }
    const row = await options.models["configuration"].getById(id, {transaction: options.transaction});
    if (!row) {
        return null;
    }
    if (row.userId !== userId) {
        throw new TranslatableError("errors.rest.configurationNoAccess");
    }
    return row;
}

/**
 * Mirrors ConfigurationSocket.createConfiguration (configurationAdd). Differs: needs the manage right
 * instead of admin, and the content is checked for its type.
 */
async function createConfiguration({userId, name, description, type, content, hideInFrontend}, options) {
    if (!(await canOf(options)(CONFIGURATIONS_MANAGE))) {
        throw new TranslatableError("errors.rest.missingTokenRight");
    }
    const problem = checkConfigurationContent(type, content);
    if (problem) {
        throw new TranslatableError(problem);
    }
    const row = await options.models["configuration"].add({
        name, description: description ?? "", userId, type, content, hideInFrontend: hideInFrontend === true,
    }, {transaction: options.transaction});
    return publicConfiguration(row);
}

/**
 * Mirrors ConfigurationSocket.updateConfiguration (configurationUpdate). Differs: own configurations
 * only, needs the manage right, and name, description, and hideInFrontend can change too.
 */
async function updateConfiguration({userId, id, fields}, options) {
    const row = await loadOwnConfiguration(options, userId, id);
    if (!row) {
        return null;
    }
    if (fields.content !== undefined) {
        const problem = checkConfigurationContent(row.type, fields.content);
        if (problem) {
            throw new TranslatableError(problem);
        }
    }
    const updated = await options.models["configuration"].updateById(row.id, fields, {transaction: options.transaction});
    return publicConfiguration(updated);
}

/**
 * Soft-delete an own configuration that nothing uses: no assignment or submission validates
 * against it and no study step assesses with it.
 */
async function deleteConfiguration({userId, id}, options) {
    const models = options.models;
    const row = await loadOwnConfiguration(options, userId, id);
    if (!row) {
        return null;
    }
    const transaction = options.transaction;
    const usedByAssignments = await models["assignment"].count({where: {validationConfigurationId: row.id, deleted: false}, transaction});
    const usedBySubmissions = await models["submission"].count({where: {validationConfigurationId: row.id, deleted: false}, transaction});
    const usedBySteps = await models["study_step"].count({
        where: {
            deleted: false,
            [Op.and]: [sqlWhere(literal(models["study_step"].assessmentConfigurationSql("study_step")), String(row.id))],
        },
        transaction,
    });
    if (usedByAssignments + usedBySubmissions + usedBySteps > 0) {
        throw new TranslatableError("errors.rest.configurationInUse");
    }
    await models["configuration"].deleteById(row.id, {transaction});
    return true;
}


/**
 * Handle configuration files through websocket
 *
 * @author Linyin Huang
 * @type {ConfigurationSocket}
 * @class ConfigurationSocket
 */
class ConfigurationSocket extends Socket {
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
      throw new TranslatableError("errors.configuration.idRequiredNoPeriod");
    }

    if (!content) {
      throw new TranslatableError("errors.configuration.contentRequiredNoPeriod");
    }

    // Get the existing configuration
    const existingConfig = await this.models["configuration"].getById(configurationId);

    if (!existingConfig) {
      throw new TranslatableError("errors.configuration.notFound");
    }

    // Check if user has access to update this configuration
    await this.assertWriteAccess("configuration", configurationId, options);

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
      throw new TranslatableError("errors.configuration.createForOtherUsersDenied");
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
  }
}

module.exports = ConfigurationSocket;
module.exports.CONFIGURATION_TYPES = CONFIGURATION_TYPES;
module.exports.listConfigurations = listConfigurations;
module.exports.getConfiguration = getConfiguration;
module.exports.createConfiguration = createConfiguration;
module.exports.updateConfiguration = updateConfiguration;
module.exports.deleteConfiguration = deleteConfiguration;
