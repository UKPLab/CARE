'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class TagSet extends Model {
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