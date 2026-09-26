"use strict";

const TranslatableError = require("../../utils/TranslatableError");
const MetaModel = require("../MetaModel.js");
const {Op, literal, where} = require("sequelize");
const {genSalt, genPwdHash, genPwd} = require("../../webserver/auth/utils.js");
const {generateAnimalUsername} = require("../../utils/helper/generator");
const SequelizeSimpleCache = require("sequelize-simple-cache");
const {includesCondition} = require("../../utils/helper/queryTableSearch.js");
const {positiveInt} = require("../../utils/helper/positiveInt.js");

module.exports = (sequelize, DataTypes) => {
    class User extends MetaModel {
        static roleIdMap = null;
        static autoTable = true;
        static accessMap = [
            {
                right: "frontend.dashboard.studies.view.userPrivateInfo",
                columns: ["firstName", "lastName", "email", "extId"]
            },
            {
                right: "frontend.dashboard.studies.view.userPublicInfo",
                columns:["id", "userName"]
            }
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
                data.password = genPwd(10, true);
                data.initialPassword = data.password;
            } else {
                User.validatePasswordContent(data.password);
            }
            data.passwordHash = await genPwdHash(data.password, data.salt);
            if (!data.userName) {
                data.userName = generateAnimalUsername();
            }

            return await super.add(data, options);
        }

        /**
         * Retrieves or creates a map of role names to role Ids.
         * @returns {Promise<Object>} - an object that maps role names to role Ids.
         */
        static async getRoleIdMap() {
            if (!this.roleIdMap) {
                const roles = await User.sequelize.models["user_role"].findAll({
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
         * @returns {Promise<Number>} user id
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
         * @returns {Promise<Number>}} user id
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
         * @param {object} options sequelize transaction
         */
        static async registerUserLogin(userId, options) {
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
        }

        /**
         * Get all users
         * @param {Object} options - Sequelize query options
         * @returns {string[]} An array of all users.
         */
        static async getAll(options = {}) {
            // make sure passwordHash and salt are excluded
            if (options.attributes) {
                if (!options.attributes.exclude) {
                    options.attributes['exclude'] = ["passwordHash", "salt"];
                } else {
                    options.attributes.exclude.push("passwordHash", "salt");
                }
            } else {
                options['attributes'] = {
                    exclude: ["passwordHash", "salt"],
                }
            }

            // includes role matching as roles (ids)
            const include =
                [{
                    model: User.sequelize.models["user_role_matching"],
                    as: "roles",
                    attributes: ["userRoleId"],
                    where: {
                        deleted: false,
                    },
                    required: false, // Ensures we get the user even if they have no roles
                }];
            if (options.include) {
                options.include = options.include.concat(include);
            } else {
                options.include = include;
            }            
            options.plain = false;
            options.nest = false;
            
            return await super.getAll(options).then((users) => {
                const result = users.reduce((acc, item) => {
                    if (!acc[item.id]) {
                        // Extract user roles from the result
                        let extractedRoles = [];
                        
                        if (item['roles.userRoleId'] !== undefined && item['roles.userRoleId'] !== null) {
                            // Flattened format (expected)
                            extractedRoles.push(item['roles.userRoleId']);
                            // { id: 1, firstName: "admin", "roles.userRoleId": 2 }
                        } else if (Array.isArray(item.roles)) {
                            // Nested format from cache - array of numbers
                            extractedRoles = item.roles.filter(r => typeof r === 'number');
                            // { id: 1, firstName: "admin", roles: [2] }
                        }
                        
                        acc[item.id] = item;
                        acc[item.id].roles = extractedRoles;
                    } else {
                        // User already exists, add role if not already present
                        const roleId = item['roles.userRoleId'] || (Array.isArray(item.roles) ? item.roles[0] : null);
                        if (roleId !== null && roleId !== undefined && !acc[item.id].roles.includes(roleId)) {
                            acc[item.id].roles.push(roleId);
                        }
                    }
                    return acc;
                }, {});
                // return only list of values
                const finalUsers = Object.values(result).map((item) => {
                    // delete key roles.userRoleId
                    delete item['roles.userRoleId'];
                    if (item.roles && !Array.isArray(item.roles)) { 
                        delete item.roles;
                    }
                    if (!item.roles) {
                        item.roles = [];
                    }
                    return item;
                });

                return finalUsers; 
            });
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

                const matchedUsers = await User.sequelize.models["user_role_matching"].findAll({
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
        static async getUserRights(userId) {
            try {
                let roles = await User.sequelize.models["user_role_matching"].findAll({
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
                        const matchedRoles = await User.sequelize.models["role_right_matching"].findAll({
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
                            model: sequelize.models["user_role_matching"],
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
                    throw new TranslatableError("errors.users.userNotFound");
                }
                const userDetails = user.get({plain: true});
                userDetails.roles = userDetails.roles.map((role) => {
                    const roleName = Object.keys(roleIdMap).find((key) => roleIdMap[key] === role.userRoleId);
                    return roleName;
                });
                return userDetails;
            } catch (error) {
                throw error;
            }
        }

        /**
         * Updates user's details
         * @param {Object} data the input to the function
         * @param {number} data.userId - The ID of the user
         * @param {Object} data.userData - Includes firstName, lastName, email, roles
         * @param {Object} options including the transaction
         * @returns {Promise<void>}
         */
        static async updateUserDetails(data, options) {
            const {userId, userData} = data;

            const UserRoleMatching = User.sequelize.models["user_role_matching"];

            const existingUser = await User.getById(userId, options);
            if (!existingUser) {
                throw new Error("User not found");
            }

            const roleIdMap = await User.getRoleIdMap();
            // Profile fields may be unchanged; Sequelize then reports 0 updated rows.
            // Still continue so role matching runs.
            await User.update(
                {
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    email: userData.email,
                },
                {
                    where: {id: userId},
                    returning: true,
                    individualHooks: true,
                    transaction: options.transaction,
                }
            );

            // Get current roles
            const currentRoles = await UserRoleMatching.findAll({
                where: {userId},
                transaction: options.transaction,
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
                    UserRoleMatching.create({
                        userId,
                        userRoleId: roleIdMap[roleName]
                    }, {transaction: options.transaction})
                )
            );

            // Remove roles
            await UserRoleMatching.destroy({
                where: {
                    userId,
                    userRoleId: rolesToRemove,
                },
                individualHooks: true,
                transaction: options.transaction,
            });

            // Rebuild role ids and force a user broadcast that includes `roles`,
            // so Vuex table/user (and the edit modal checkboxes) stay in sync.
            const updatedRoleRows = await UserRoleMatching.findAll({
                where: {userId, deleted: false},
                attributes: ["userRoleId"],
                transaction: options.transaction,
                raw: true,
            });
            const roleIds = updatedRoleRows.map((row) => row.userRoleId);

            // individualHooks so this update is queued on transaction.changes (for roles below).
            await User.update(
                {rolesUpdatedAt: new Date()},
                {
                    where: {id: userId},
                    individualHooks: true,
                    transaction: options.transaction,
                }
            );

            if (options.transaction && Array.isArray(options.transaction.changes)) {
                for (const entry of options.transaction.changes) {
                    if (entry.constructor?.tableName === "user" && Number(entry.id) === Number(userId)) {
                        entry.dataValues.roles = roleIds;
                    }
                }
            }

            // Role rows live on user_role_matching; User.findAll (via getAll) is cached.
            // Clear after commit so the next dashboard load cannot serve a pre-commit cache entry.
            options.transaction.afterCommit(() => {
                if (User.cache) {
                    User.cache.clear();
                }
            });
        }

        /**
         * Validates that a password is acceptable (printable, no emojis, not whitespace-only).
         * @param {string} pwd - The password to validate
         * @throws {Error} If the password is invalid
         */
        static validatePasswordContent(pwd) {
            if (typeof pwd !== "string" || pwd.length < 8) {
                throw new TranslatableError("errors.validation.auth.passwordMinLengthNoLong");
            }
            if (/^\s*$/.test(pwd)) {
                throw new TranslatableError("errors.validation.auth.passwordWhitespaceOnly");
            }
            if (/[\x00-\x1F\x7F]/.test(pwd)) {
                throw new TranslatableError("errors.validation.auth.passwordControlChars");
            }
            if ([...pwd].some((c) => (c.codePointAt(0) || 0) > 0xFFFF)) {
                throw new TranslatableError("errors.validation.auth.passwordUnsupportedCharacters");
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
                User.validatePasswordContent(pwd);
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
                    throw new TranslatableError("errors.users.failedToUpdateUser");
                }
                // clear the user cache so the updated pwd is loaded immediately
                if (User.cache){
                    User.cache.clear();
                }
            } catch (error) {
                throw error;
            }
        }

        /**
         * @param {Object} [ctx]
         * @returns {Promise<boolean>}
         */
        static async canReadReviewerCounts(ctx = {}) {
            if (typeof ctx.hasAccess !== "function") return false;
            return await ctx.hasAccess("frontend.dashboard.studies.addBulkAssignments")
                || await ctx.hasAccess("frontend.dashboard.studies.addSingleAssignments");
        }

        /**
         * Extra columns on the reviewer picker: how many open study sessions,
         * how many ready-for-review documents, and role names joined with ", ".
         * @returns {Object<string, string>} alias → SQL
         */
        static assignmentReviewerColumnSql() {
            return {
                studySessions:
                    '(SELECT COUNT(*)::int FROM "study_session" AS "ss"'
                    + ' INNER JOIN "study" AS "s" ON "s"."id" = "ss"."studyId"'
                    + ' AND "s"."deleted" = false AND "s"."closed" IS NULL'
                    + ' WHERE "ss"."userId" = "user"."id" AND "ss"."deleted" = false)',
                documents:
                    '(SELECT COUNT(*)::int FROM "document" AS "d"'
                    + ' WHERE "d"."userId" = "user"."id" AND "d"."deleted" = false'
                    + ' AND "d"."readyForReview" = true)',
                rolesNames:
                    '(SELECT COALESCE(STRING_AGG("ur"."name", \', \' ORDER BY "ur"."name"), \'\')'
                    + ' FROM "user_role_matching" AS "urm"'
                    + ' INNER JOIN "user_role" AS "ur" ON "ur"."id" = "urm"."userRoleId"'
                    + ' AND "ur"."deleted" = false'
                    + ' WHERE "urm"."userId" = "user"."id" AND "urm"."deleted" = false)',
            };
        }

        /**
         * Reviewer picker scope: optionally restrict to users behind a session selection
         * ("from previous selected") or an explicit id list (document/submission path).
         *
         * @param {Object} scope
         * @param {Object} [scope.assignmentReviewer]
         * @param {Object} [ctx]
         * @param {function(Object): Promise<number[]>} [ctx.resolveQueryTableIds]
         * @returns {Promise<Object|null>}
         */
        static async getQueryTableScopeFilter(scope, ctx = {}) {
            const reviewer = scope?.assignmentReviewer;
            if (!reviewer) {
                return null;
            }

            const conditions = [];

            if (reviewer.hasDocuments && await User.canReadReviewerCounts(ctx)) {
                const columns = User.assignmentReviewerColumnSql();
                conditions.push(where(literal(columns.documents), {[Op.gte]: 1}));
            }

            if (Array.isArray(reviewer.userIds)) {
                const ids = [...new Set(
                    reviewer.userIds.map((id) => positiveInt(id)).filter(Boolean)
                )];
                if (ids.length === 0) {
                    conditions.push({id: {[Op.in]: [-1]}});
                } else {
                    conditions.push({id: {[Op.in]: ids}});
                }
            } else if (reviewer.fromSessions && typeof ctx.resolveQueryTableIds === "function") {
                const fromSessions = reviewer.fromSessions;
                const sessionIds = await ctx.resolveQueryTableIds({
                    table: "study_session",
                    filter: fromSessions.filter || [],
                    query: fromSessions.query || {},
                    scope: fromSessions.scope || null,
                    excludeIds: fromSessions.excludeIds || [],
                    includeIds: fromSessions.allMatching ? null : (fromSessions.ids || []),
                });
                if (sessionIds.length === 0) {
                    conditions.push({id: {[Op.in]: [-1]}});
                } else {
                    const idList = sessionIds.join(",");
                    const userExpr =
                        '(SELECT "study"."userId" FROM "study" WHERE "study"."id" = "study_session"."studyId")';
                    conditions.push({
                        id: {
                            [Op.in]: sequelize.literal(
                                `(SELECT DISTINCT ${userExpr} FROM "study_session"`
                                + ` WHERE "study_session"."id" IN (${idList})`
                                + ' AND "study_session"."deleted" = false)'
                            ),
                        },
                    });
                }
            }

            if (conditions.length === 0) {
                // Empty assignmentReviewer object: still a known consumer, no extra WHERE.
                return null;
            }
            if (conditions.length === 1) {
                return conditions[0];
            }
            return {[Op.and]: conditions};
        }

        /**
         * @returns {Promise<Array<Object>>}
         */
        static async getQueryTableInjects(ctx = {}) {
            const columns = User.assignmentReviewerColumnSql();
            const fields = {rolesNames: columns.rolesNames};
            if (await User.canReadReviewerCounts(ctx)) {
                fields.studySessions = columns.studySessions;
                fields.documents = columns.documents;
            }
            return [{
                type: "sql",
                table: "user",
                on: "id",
                fields,
            }];
        }

        /**
         * @param {Object} ctx
         * @returns {Promise<string[]>}
         */
        static async getQueryTableSearchColumns(ctx = {}) {
            const columns = ["id", "rolesNames"];
            if (await User.canReadReviewerCounts(ctx)) {
                columns.push("studySessions", "documents");
            }
            const privateInfo = typeof ctx.hasAccess === "function"
                && await ctx.hasAccess("frontend.dashboard.studies.view.userPrivateInfo");
            if (privateInfo) {
                columns.push("extId", "firstName", "lastName");
            }
            return columns;
        }

        static getQueryTableSearchConditions(needle, ctx = {}) {
            const canSearch = typeof ctx.canSearch === "function" ? ctx.canSearch : () => false;
            return Object.entries(User.assignmentReviewerColumnSql())
                .filter(([key]) => canSearch(key))
                .map(([, sql]) => includesCondition(literal(sql), needle));
        }

        /**
         * @returns {Promise<Object>}
         */
        static async getQueryTableFilterColumns(ctx = {}) {
            const columns = User.assignmentReviewerColumnSql();
            const privateInfo = typeof ctx.hasAccess === "function"
                && await ctx.hasAccess("frontend.dashboard.studies.view.userPrivateInfo");
            const spec = {
                id: {type: "numeric", operators: ["=", ">", ">=", "<", "<=", "%"]},
                rolesNames: {type: "text", sql: columns.rolesNames},
            };
            if (await User.canReadReviewerCounts(ctx)) {
                spec.studySessions = {
                    type: "numeric",
                    operators: ["=", ">", ">=", "<", "<=", "%"],
                    sql: columns.studySessions,
                };
                spec.documents = {
                    type: "numeric",
                    operators: ["=", ">", ">=", "<", "<=", "%"],
                    sql: columns.documents,
                };
            }
            if (privateInfo) {
                spec.extId = {type: "numeric", operators: ["=", ">", ">=", "<", "<=", "%"]};
            }
            return spec;
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
            const roleModel = user.sequelize.models["user_role"];
            const roleMatchingModel = user.sequelize.models["user_role_matching"];

            // User updated via import procedure
            // To ensure user roles are consistent across different platforms, delete the existing roles first.
            if (isUpdated) {
                await roleMatchingModel.destroy({
                    where: {userId: user.id},
                    transaction,
                });
            }

            const addedRoleNames = new Set(["user"]);

            if (roles) {
                const userRoles = roles.split(",").map((role) => role.trim()).filter(Boolean);
                for (let roleName of userRoles) {
                    const mappedRoleName = roleMap ? roleMap[roleName] : roleName;
                    if (mappedRoleName) {
                        addedRoleNames.add(mappedRoleName);
                    }
                }
            }

            for (let roleName of addedRoleNames) {
                const userRole = await roleModel.findOne({
                    where: {name: roleName},
                    transaction,
                });

                if (userRole) {
                    await roleMatchingModel.create(
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

    // NOTE: unique fields (email, userName, extId, orcidId, samlNameId) are unique
    // only among non-deleted users, via a partial unique index, not a plain
    // `unique: true` here. After adding a new unique column (and its migration
    // that adds `unique: true`), add a follow-up migration that calls
    // addPartialUniqueIndexes(queryInterface, "user", transaction) from
    // utils/helper/softDeleteUniqueIndex.js (removePartialUniqueIndexes for its
    // down()) — otherwise the field stays globally unique and can't be reused
    // once its owner is soft-deleted.
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
            emailVerified: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            resetToken: DataTypes.STRING,
            emailVerificationToken: DataTypes.STRING,
            lastPasswordResetEmailSent: DataTypes.DATE,
            lastVerificationEmailSent: DataTypes.DATE,
            // Email OTP for 2FA
            twoFactorOtp: DataTypes.STRING,
            twoFactorOtpExpiresAt: DataTypes.DATE,
            // Multi-method 2FA configuration
            twoFactorMethods: {
                type: DataTypes.JSON,
                defaultValue: [],
            },
            // TOTP for 2FA
            totpSecret: DataTypes.STRING,
            // External login method identifiers
            orcidId: DataTypes.STRING,
            ldapUsername: DataTypes.STRING,
            samlNameId: DataTypes.STRING,
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
            indexes: [
                {
                unique: true,
                using: 'BTREE',
                fields: ["id"]
                }
            ]
        }
    );

    // To debug the cache, pass additional parameter: {debug: true}
    User.cache = new SequelizeSimpleCache({user: {limit: 50, ttl: false}});
    return User.cache.init(User);
};
