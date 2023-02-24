'use strict';
const MetaModel = require("../MetaModel.js");
const {Op} = require("sequelize");

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

        /**
         * Find a user by username or email
         * @param {string} userName username or email
         * @param {boolean} includeSystem include system user
         * @returns {Promise<object>} user
         */
        static async find(userName, includeSystem = false) {
            try {
                return await this.findOne({
                    where: {
                        [Op.or]: [{
                            userName: userName
                        }, {
                            email: userName
                        }],
                        [Op.not]: (!includeSystem) ? {
                            sysrole: "system"
                        } : {
                            sysrole: ""
                        }
                    }, raw: true
                });
            } catch (err) {
                console.log("Error in User.find: " + err);
            }
        }

        /**
         * Get user id by username or email
         * @param {string} userName username or email
         * @returns {Promise<integer>} user id
         */
        static async getUserIdByName(userName) {
            const user = await User.find(userName, true);
            if (user) {
                return user.id;
            } else {
                return 0;
            }
        }

        /**
         * Get user name by id
         * @param {number} userId user id
         * @returns {Promise<string>} user name
         */
        static async getUserName(userId) {
            try {
                const user = await User.getById(userId);
                if (user) {
                    return user.userName;
                } else {
                    return "System";
                }
            } catch (e) {
                console.log(e);
            }
        }

        /**
         * Get user id by email
         * @param {string} email email
         * @returns {Promise<integer>}} user id
         */
        static async getUserIdByEmail(email) {
            const user = await User.getByKey('email', email);
            if (user) {
                return user.id;
            } else {
                return 0;
            }
        }

        /**
         * Register a new login
         * @param {string} userId user id
         * @returns {Promise<boolean>}} true if successufl
         */
        static async registerUserLogin(userId) {
            try {
                const updatedObject = await this.update({lastLoginAt: Date.now()}, {
                        where: {
                            id: userId
                        },
                        returning: true,
                        plain: true
                    }
                );
                return updatedObject !== null && updatedObject !== undefined;
            } catch (e) {
                console.log(e);
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