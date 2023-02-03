'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class Setting extends MetaModel {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
        }
    }


    Setting.init({
        key: DataTypes.STRING,
        value: DataTypes.TEXT,
        type: DataTypes.STRING,
        description: DataTypes.STRING,

    }, {
        sequelize,
        modelName: 'setting',
        tableName: 'setting'
    });

    Setting.removeAttribute('id');

    return Setting;
};