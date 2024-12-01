'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class TagSet extends MetaModel {
        static autoTable = true;
        static fields = [
            {
                key: "name",
                label: "Name of the Tagset:",
                placeholder: "My tagset",
                type: "text",
                required: true,
                default: "",
            },
            {
                key: "description",
                label: "Description of the Tagset:",
                placeholder: "Tagset description",
                type: "text",
                required: true,
                default: "",
            },
            {
                key: "tags",
                label: "Tags:",
                type: "table",
                options: {
                    table: "tag", id: "tagSetId"
                },
                required: true,
            }
        ]

        /**
         * Delete all tags from tagSet
         * @param tagSet
         * @param options
         * @returns {Promise<void>}
         */
        static async deleteTags(tagSet, options) {
            const tags = await sequelize.models['tag'].getAllByKey("tagSetId", tagSet.id, {transaction: options.transaction});

            for (const tag of tags) {
                await sequelize.models['tag'].deleteById(tag.id, {transaction: options.transaction});
            }
        }


        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
            TagSet.belongsTo(models["project"], {
                foreignKey: "projectId",
                as: "project",
            });
        }
    }

    TagSet.init({
        name: DataTypes.STRING,
        description: DataTypes.STRING,
        userId: DataTypes.INTEGER,
        public: DataTypes.BOOLEAN,
        updatedAt: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        projectId: DataTypes.INTEGER

    }, {
        sequelize,
        modelName: 'tag_set',
        tableName: 'tag_set',
        hooks: {
            afterUpdate: async (tagSet, options) => {
                if (tagSet.deleted && !tagSet._previousDataValues.deleted) {
                    await TagSet.deleteTags(tagSet, options);
                }
            }
        }
    });
    return TagSet;
};