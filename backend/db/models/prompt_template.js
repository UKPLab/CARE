'use strict';
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class PromptTemplate extends MetaModel {
        static autoTable = true;

        static associate(models) {
            PromptTemplate.belongsTo(models['user'], {
                foreignKey: 'userId',
                as: 'creator',
            });
        }

        /**
         * Get all templates accessible to a user (own + shared)
         * @param {number} userId
         * @returns {Promise<Object[]>}
         */
        static async getAccessible(userId) {
            const {Op} = require('sequelize');
            return await this.findAll({
                where: {
                    deleted: false,
                    [Op.or]: [
                        {userId: userId},
                        {shared: true},
                    ],
                },
                raw: true,
            });
        }
    }

    PromptTemplate.init({
        userId: DataTypes.INTEGER,
        name: DataTypes.STRING,
        description: DataTypes.TEXT,
        provider: DataTypes.STRING,
        model: DataTypes.STRING,
        promptText: DataTypes.TEXT,
        inputMapping: DataTypes.JSONB,
        defaultOutputMapping: DataTypes.JSONB,
        shared: DataTypes.BOOLEAN,
        sharedScope: DataTypes.STRING,
        sharedTargetId: DataTypes.INTEGER,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'prompt_template',
        tableName: 'prompt_template',
    });

    return PromptTemplate;
};
