"use strict";
const MetaModel = require("../MetaModel.js");
const {Op} = require("sequelize");
const {genSalt, genPwdHash} = require("../../utils/auth.js");
const {v4: uuidv4} = require("uuid");
const {generateMarvelUsername} = require("../../utils/generator");

module.exports = (sequelize, DataTypes) => {
    class User extends MetaModel {
        static roleIdMap = null;
        static accessMap = [
            {
                right: "frontend.dashboard.studies.view.userPrivateInfo",
                columns: ["firstName", "lastName", "email", "extId"]
            },
        ];

        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
            User.hasMany(models["user_role_matching"], {
                foreignKey: "userId",
                as: "roles",
            });
        }

        /**
         * Adds a new user to the database.
         * @param data
         * @param options
         * @returns {Promise<{password: string}>}
         */
        static async add(data, options) {
            if (!data.salt) {
                data.salt = genSalt();
            }
            if (!data.password) {
                data.password = uuidv4().replace(/-/g, "").substring(0, 8);
                data.initialPassword = data.password;
            }
            data.passwordHash = await genPwdHash(data.password, data.salt);
            if (!data.userName) {
                data.userName = generateMarvelUsername();
            }

            return await super.add(data, options);
        }

        /**
         * Retrieves or creates a map of role names to role Ids.
         * @returns {Promise<Object>} - an object that maps role names to role Ids.
         */
        static async getRoleIdMap() {
            if (!this.roleIdMap) {
                const roles = await this.sequelize.models["user_role"].findAll({
                    attributes: ["id", "name"],
                    raw: true,
                });
                this.roleIdMap = roles.reduce((acc, role) => {
                    acc[role.name] = role.id;
                    return acc;
                }, {});
            }
            return this.roleIdMap;
        }

        /**
         * Find a user by username or email
         * @param {string} userName username or email
         * @returns {Promise<object>} user
         */
        static async find(userName) {
            try {
                return await this.findOne({
                    where: {
                        [Op.or]: [
                            {
                                userName: userName,
                            },
                            {
                                email: userName,
                            },
                        ],
                    },
                    raw: true,
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
            const user = await User.find(userName);
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
            const user = await User.getByKey("email", email);
            if (user) {
                return user.id;
            } else {
                return 0;
            }
        }

        /**
         * Filter and return existing emails from a given list
         * @param {string[]} emails a list of emails to check
         * @returns {Promise<array>} a list of emails
         */
        static async filterExistingEmails(emails) {
            return await User.findAll({
                where: {
                    email: {
                        [Op.in]: emails,
                    },
                    deleted: false,
                },
                attributes: ["email"],
                raw: true,
            });
        }

        /**
         * Register a new login
         * @param {string} userId user id
         * @returns {Promise<boolean>}} true if successful
         */
        static async registerUserLogin(userId) {
            try {
                const updatedObject = await this.update(
                    {lastLoginAt: Date.now()},
                    {
                        where: {
                            id: userId,
                        },
                        returning: true,
                        plain: true,
                    }
                );
                return updatedObject !== null && updatedObject !== undefined;
            } catch (e) {
                console.log(e);
            }
        }

        /**
         * Get all users
         * @returns {string[]} An array of all users.
         */
        static async getAllUsers() {
            try {
                return await User.getAll(false, ["passwordHash", "salt"]);
            } catch (error) {
                console.error(error);
            }
        }

        /**
         * Get users by their role
         * @param {string} roleName - The role of the users to fetch.
         * @returns {string[]} An array of users with the specified role.
         */
        static async getUsersByRole(roleName) {
            try {
                const roleIdMap = await User.getRoleIdMap();
                const roleId = roleIdMap[roleName];

                if (!roleId) {
                    console.error(`Role not found: ${roleName}`);
                    return [];
                }

                const matchedUsers = await this.sequelize.models["user_role_matching"].findAll({
                    where: {userRoleId: roleId},
                    attributes: ["userId"],
                    raw: true,
                });
                const userIds = matchedUsers.map((user) => user.userId);
                return await User.findAll({
                    attributes: {
                        exclude: ["passwordHash", "salt"],
                    },
                    where: {
                        id: {[Op.in]: userIds},
                    },
                    raw: true,
                });
            } catch (error) {
                console.error(error);
            }
        }


        /**
         * Gets the rights associated with the user
         * @param {number} userId - The ID of the user
         * @returns {Object<string, array>}
         */
        static async getUserRight(userId) {
            try {
                let roles = await this.sequelize.models["user_role_matching"].findAll({
                    where: {userId},
                    raw: true,
                });
                if (roles.length === 0) {
                    return {};
                }
                roles = roles.map((role) => role.userRoleId);
                let userRight = {};
                await Promise.all(
                    roles.map(async (role) => {
                        const matchedRoles = await this.sequelize.models["role_right_matching"].findAll({
                            where: {userRoleId: role},
                            raw: true,
                        });

                        userRight[role] = matchedRoles.map((role) => role.userRightName);
                    })
                );
                return userRight;
            } catch (error) {
                console.error(error);
            }
        }

        /**
         * Get specific user's details
         * @param {number} userId - The ID of the user
         * @returns {Object}
         */
        static async getUserDetails(userId) {
            try {
                const roleIdMap = await User.getRoleIdMap();
                const user = await User.findOne({
                    where: {
                        id: userId,
                        deleted: false,
                    },
                    attributes: {
                        exclude: ["passwordHash", "salt", "deleted"],
                    },
                    include: [
                        {
                            model: this.sequelize.models["user_role_matching"],
                            as: "roles",
                            attributes: ["userRoleId"],
                            where: {
                                deleted: false,
                            },
                            // Ensures we get the user even if they have no roles
                            required: false,
                        },
                    ],
                });

                if (!user) {
                    console.error("User not found");
                    return;
                }
                const userDetails = user.get({plain: true});
                userDetails.roles = userDetails.roles.map((role) => {
                    const roleName = Object.keys(roleIdMap).find((key) => roleIdMap[key] === role.userRoleId);
                    return roleName;
                });
                return userDetails;
            } catch (error) {
                console.error(error);
            }
        }

        /**
         * Updates user's details
         * @param {number} userId - The ID of the user
         * @param {Object} userData - Includes firstName, lastName, email, roles
         * @returns {Promise<void>}
         */
        static async updateUserDetails(userId, userData) {
            const transaction = await sequelize.transaction();
            const UserRoleMatching = this.sequelize.models["user_role_matching"];
            try {
                const roleIdMap = await User.getRoleIdMap();
                const [updatedRowsCount] = await User.update(
                    {
                        firstName: userData.firstName,
                        lastName: userData.lastName,
                        email: userData.email,
                    },
                    {
                        where: {id: userId},
                        returning: true,
                        transaction,
                    }
                );

                if (updatedRowsCount === 0) {
                    console.error("Failed to update user: User not found");
                    return;
                }

                // Get current roles
                const currentRoles = await UserRoleMatching.findAll({
                    where: {userId},
                    transaction,
                });

                // Determine roles to add and remove
                const currentRoleIds = currentRoles.map((role) => role.userRoleId);
                const currentRoleNames = currentRoleIds.map((id) =>
                    Object.keys(roleIdMap).find((key) => roleIdMap[key] === id)
                );

                const rolesToAdd = userData.roles.filter((roleName) => !currentRoleNames.includes(roleName));
                const rolesToRemove = currentRoleIds.filter(
                    (roleId) => !userData.roles.includes(Object.keys(roleIdMap).find((key) => roleIdMap[key] === roleId))
                );

                // Add new roles
                await Promise.all(
                    rolesToAdd.map((roleName) =>
                        UserRoleMatching.create({userId, userRoleId: roleIdMap[roleName]}, {transaction})
                    )
                );

                // Remove roles
                await UserRoleMatching.destroy({
                    where: {
                        userId,
                        userRoleId: rolesToRemove,
                    },
                    individualHooks: true,
                    transaction,
                });
                await transaction.commit();
            } catch (error) {
                await transaction.rollback();
                console.error("Failed to update user: " + error);
            }
        }

        /**
         * Resets user's password
         * @param {number} userId - The ID of the user
         * @param {string} pwd - The new password
         * @returns {Promise<void>}
         */
        static async resetUserPwd(userId, pwd) {
            try {
                const salt = genSalt();
                const passwordHash = await genPwdHash(pwd, salt);
                const [updatedRowsCount] = await User.update(
                    {passwordHash, salt},
                    {
                        where: {id: userId},
                        returning: true,
                    }
                );

                if (updatedRowsCount === 0) {
                    console.log("Failed to update user: User not found");
                    return;
                }
            } catch (error) {
                console.log(error);
            }
        }

        /**
         * Update user's consent data
         * @param {number} userId - ID of the user
         * @param {Object} consentData - The consent data object
         * @param {boolean} consentData.acceptTerms - Indicates whether the user has consented to the terms of service
         * @param {boolean} consentData.acceptStats - Indicates whether the user has agreed to tracking
         * @param {boolean} consentData.acceptDataSharing - Indicates whether the user has agreed to donate their annotation data
         * @param {string} consentData.acceptedAt - Time when the user made the consent
         * @returns {void}
         */
        static async updateUserConsent(userId, consentData) {
            const [updatedRowsCount] = await User.update(consentData, {
                where: {id: userId},
                returning: true,
            });
            if (updatedRowsCount === 0) {
                throw new Error("Failed to update user: User not found");
            }
        }
    }

    /**
     * Assigns roles to a user, either default user role ('user') or other specific roles
     * @param {Object} user Sequelize user model instance
     * @param {string|undefined} roles A string list of user roles with each role separated by a comma
     * @param {Object|undefined} roleMap A role map of external roles to CARE system roles
     * @param {boolean} isUpdated Whether the operation is to update the existing user
     * @param {Object} transaction Sequelize transaction
     * @returns {Promise<void>}
     */
    async function assignUserRoles(user, roles, roleMap, isUpdated = false, transaction) {
        try {
            // User created via CARE registration procedure
            if (!roles) {
                const userRole = await user.sequelize.models["user_role"].findOne({
                    where: {name: "user"},
                    transaction,
                });
                await user.sequelize.models["user_role_matching"].create(
                    {
                        userId: user.id,
                        userRoleId: userRole.id,
                    },
                    {transaction}
                );
                return;
            }

            // User updated via import procedure
            // To ensure user roles are consistent across different platforms, delete the existing roles first.
            if (isUpdated) {
                await user.sequelize.models["user_role_matching"].destroy({
                    where: {userId: user.id},
                    transaction,
                });
            }

            // User created via import procedure
            const userRoles = roles.split(", ").map((role) => role.trim());
            for (let roleName of userRoles) {
                const userRole = await user.sequelize.models["user_role"].findOne({
                    where: {name: roleMap[roleName]},
                    transaction,
                });

                if (userRole) {
                    await user.sequelize.models["user_role_matching"].create(
                        {
                            userId: user.id,
                            userRoleId: userRole.id,
                        },
                        {transaction}
                    );
                }
            }
        } catch (error) {
            throw error;
        }
    }

    User.init(
        {
            firstName: DataTypes.STRING,
            lastName: DataTypes.STRING,
            userName: DataTypes.STRING,
            email: DataTypes.STRING,
            passwordHash: DataTypes.STRING,
            acceptTerms: DataTypes.BOOLEAN,
            acceptStats: DataTypes.BOOLEAN,
            acceptDataSharing: DataTypes.BOOLEAN,
            salt: DataTypes.STRING,
            deleted: DataTypes.BOOLEAN,
            lastLoginAt: DataTypes.DATE,
            deletedAt: DataTypes.DATE,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
            acceptedAt: DataTypes.DATE,
            rolesUpdatedAt: DataTypes.DATE,
            extId: DataTypes.INTEGER,
            initialPassword: DataTypes.STRING,
        },
        {
            sequelize,
            modelName: "user",
            tableName: "user",
            hooks: {
                afterCreate: async (user, options) => {
                    const {context, transaction} = options;
                    const {userRoles, roleMap} = context || {};
                    await assignUserRoles(user, userRoles, roleMap, false, transaction);
                },
                afterUpdate: async (user, options) => {
                    const {context, transaction} = options;
                    const {userRoles, roleMap} = context || {};
                    if (userRoles && roleMap) {
                        await assignUserRoles(user, userRoles, roleMap, true, transaction);
                    }
                },
            },
        }
    );

    return User;
};
