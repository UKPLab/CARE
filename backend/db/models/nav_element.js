'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class NavElement extends MetaModel {
        static autoTable = true;

        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
        }
    }

    NavElement.init({
        name: DataTypes.STRING,
        icon: DataTypes.STRING,
        description: DataTypes.STRING,
        admin: DataTypes.BOOLEAN,
        order: DataTypes.INTEGER,
        groupId: DataTypes.INTEGER,
        path: DataTypes.STRING,
        default: DataTypes.BOOLEAN,
        component: DataTypes.STRING,
        alias: DataTypes.JSONB,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE
    }, {
        sequelize,
        modelName: 'nav_element',
        tableName: 'nav_element'
    });
    return NavElement;
};