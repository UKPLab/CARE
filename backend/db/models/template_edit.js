"use strict";
const MetaModel = require("../MetaModel.js");

/**
 * TemplateEdit model for storing draft edits on templates
 *
 * This model mirrors document_edit and enables the draft/save mechanism for templates.
 * Draft edits (draft=true) are merged into template.content when the editor is closed.
 *
 * @author Mohammad Elwan
 */
module.exports = (sequelize, DataTypes) => {
  class TemplateEdit extends MetaModel {
    // No need to sync to frontend - internal use only
    static autoTable = false;

    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      TemplateEdit.belongsTo(models["template"], {
        foreignKey: "templateId",
        as: "template",
      });
    }

    /**
     * Unmerged draft edits for a template language, in the order they must be composed.
     *
     * @param {number} templateId
     * @param {string} language
     * @param {Object} [options]
     * @returns {Promise<Array<Object>>}
     */
    static async getDrafts(templateId, language, options = {}) {
      return await this.findAll({
        where: { templateId, language, draft: true, deleted: false },
        order: [
          ["createdAt", "ASC"],
          ["order", "ASC"],
        ],
        raw: true,
        ...options,
      });
    }

    /**
     * Soft-delete every draft edit for a template language without merging it.
     *
     * @param {number} templateId
     * @param {string} language
     * @param {Object} [options]
     * @returns {Promise<*>}
     */
    static async discardDrafts(templateId, language, options = {}) {
      return await this.update(
        { deleted: true, deletedAt: new Date() },
        {
          where: { templateId, language, draft: true, deleted: false },
          transaction: options.transaction,
        }
      );
    }

    /**
     * Clear the draft flag on edits that have been merged into template_content.
     *
     * @param {Array<number>} ids
     * @param {Object} [options]
     * @returns {Promise<*>}
     */
    static async markMerged(ids, options = {}) {
      return await this.update(
        { draft: false },
        { where: { id: ids }, transaction: options.transaction }
      );
    }
  }

  TemplateEdit.init(
    {
      userId: DataTypes.INTEGER,
      templateId: DataTypes.INTEGER,
      language: DataTypes.STRING,
      draft: DataTypes.BOOLEAN,
      offset: DataTypes.INTEGER,
      operationType: DataTypes.INTEGER, // 0: Insert, 1: Delete, 2: Attribute-Change (only retain)
      span: DataTypes.INTEGER,
      text: DataTypes.STRING,
      attributes: DataTypes.JSONB,
      order: DataTypes.INTEGER,
      deleted: DataTypes.BOOLEAN,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
    },
    {
      sequelize: sequelize,
      modelName: "template_edit",
      tableName: "template_edit",
    }
  );
  return TemplateEdit;
};
