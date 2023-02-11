'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class User extends MetaModel {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
        }

        static async getUserIdByName(userName) {
            const user = await this.getByKey('userName', userName);
            if (user) {
                return user.id;
            } else {
                return 0;
            }
        }

    }

    User.init({
        sysrole: DataTypes.STRING,
        firstName: DataTypes.STRING,
        lastName: DataTypes.STRING,
        userName: DataTypes.STRING,
        email: DataTypes.STRING,
        passwordHash: DataTypes.STRING,
        acceptTerms: DataTypes.BOOLEAN,
        acceptStats: DataTypes.BOOLEAN,
        salt: DataTypes.STRING,
        deleted: DataTypes.BOOLEAN,
        lastLoginAt: DataTypes.DATE,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    }, {
        sequelize,
        modelName: 'user',
        tableName: 'user'
    });
    return User;
};