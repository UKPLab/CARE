'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class Tag extends MetaModel {
        static autoTable = true;
        static fields = [
            {
                key: "name",
                label: "common.name",
                placeholder: "tags.fields.tag.name.placeholder",
                type: "text",
                required: true,
                default: "",
            },
            {
                key: "colorCode",
                label: "tags.fields.tag.colorCode.label",
                type: "select",
                default: "info",
                options: [
                    {
                        name: "tags.fields.tag.colorCode.options.info",
                        value: "info",
                        class: "border border-info"
                    },
                    {
                        name: "tags.fields.tag.colorCode.options.warning",
                        value: "warning",
                        class: "border border-warning"
                    },
                    {
                        name: "tags.fields.tag.colorCode.options.success",
                        value: "success",
                        class: "border-2 border-success"
                    },
                    {
                        name: "tags.fields.tag.colorCode.options.danger",
                        value: "danger",
                        class: "border-2 border-danger"
                    },
                ],
                required: true,
            },
            {
                key: "description",
                label: "common.description",
                placeholder: "tags.fields.tag.description.placeholder",
                type: "text",
                required: true,
                default: "",
            },

        ]

        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            Tag.belongsTo(models["user"], {
                foreignKey: "userId",
                as: "user",
            });
        }
    }

    Tag.init({
        name: DataTypes.STRING,
        description: DataTypes.STRING,
        colorCode: DataTypes.STRING,
        userId: DataTypes.INTEGER,
        public: DataTypes.BOOLEAN,
        updatedAt: DataTypes.DATE,
        tagSetId: DataTypes.INTEGER,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE
    }, {
        sequelize,
        modelName: 'tag',
        tableName: 'tag'
    });
    return Tag;
};