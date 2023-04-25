'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class Tag extends MetaModel {
        static autoTable = true;
        static fields = [
            {
                key: "name",
                label: "Name",
                placeholder: "Name of the Tag",
                type: "text",
                required: true,
                default: "",
            },
            {
                key: "color",
                label: "Color",
                type: "select",
                default: "info",
                options: [
                    {
                        name: "info",
                        value: "info",
                        class: "border border-info"
                    },
                    {
                        name: "warning",
                        value: "warning",
                        class: "border border-warning"
                    },
                    {
                        name: "success",
                        value: "success",
                        class: "border-2 border-success"
                    },
                    {
                        name: "danger",
                        value: "danger",
                        class: "border-2 border-danger"
                    },
                ],
                required: true,
            },
            {
                key: "description",
                label: "Description",
                placeholder: "Tag description",
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
            // define association here
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