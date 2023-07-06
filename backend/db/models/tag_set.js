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
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
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
        createdAt: DataTypes.DATE
    }, {
        sequelize,
        modelName: 'tag_set',
        tableName: 'tag_set'
    });
    return TagSet;
};