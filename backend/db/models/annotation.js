'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Annotation extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
        }
    }

    function test() {
        console.log("TEST");
    }

    Annotation.init({
        userId: DataTypes.STRING,
        text: DataTypes.STRING,
        tagId: DataTypes.INTEGER,
        documentId: DataTypes.INTEGER,
        selectors: DataTypes.JSONB,
        draft: DataTypes.BOOLEAN,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    }, {
        sequelize,
        modelName: 'annotation',
        tableName: 'annotation'
    });
    return Annotation;
};