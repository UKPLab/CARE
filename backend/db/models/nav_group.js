'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class NavGroup extends MetaModel {
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

    NavGroup.init({
        name: DataTypes.STRING,
        icon: DataTypes.STRING,
        description: DataTypes.STRING,
        admin: DataTypes.BOOLEAN,
        order: DataTypes.INTEGER,
    }, {
        sequelize,
        modelName: 'nav_group',
        tableName: 'nav_group'
    });
    return NavGroup;
};