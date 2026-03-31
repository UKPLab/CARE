'use strict';
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class LlmProvider extends MetaModel {
        static autoTable = true;
        static publicTable = true;

        static associate(models) {
        }

        /**
         * Get provider by slug
         * @param {string} slug
         * @returns {Promise<Object|null>}
         */
        static async getBySlug(slug) {
            return await this.findOne({
                where: {slug: slug, deleted: false},
                raw: true,
            });
        }

        /**
         * Get all enabled providers
         * @returns {Promise<Object[]>}
         */
        static async getEnabled() {
            return await this.findAll({
                where: {enabled: true, deleted: false},
                raw: true,
            });
        }
    }

    LlmProvider.init({
        name: DataTypes.STRING,
        slug: DataTypes.STRING,
        apiBaseUrl: DataTypes.STRING,
        enabled: DataTypes.BOOLEAN,
        models: DataTypes.JSONB,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'llm_provider',
        tableName: 'llm_provider',
    });

    return LlmProvider;
};
