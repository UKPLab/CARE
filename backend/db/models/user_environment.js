'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    /**
     * UserEnvironment model
     * This model is used to store user-specific environment variables.
     * It can be used to store settings, preferences, or any other user-specific data.
     */

    
    class UserEnvironment extends MetaModel {
        static autoTable = true;
        static associate(models) {

        }
    }

    UserEnvironment.init({
        userId: DataTypes.INTEGER,
        documentId: DataTypes.INTEGER,
        studySessionId: DataTypes.INTEGER,
        studyStepId: DataTypes.INTEGER,
        key: DataTypes.STRING,
        value: DataTypes.STRING,
        updatedAt: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE
    }, {
        sequelize: sequelize,
        modelName: 'user_environment',
        tableName: 'user_environment'
    });
    return UserEnvironment;
};
