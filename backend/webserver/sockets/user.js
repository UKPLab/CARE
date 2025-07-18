const Socket = require("../Socket.js");
const {v4: uuidv4} = require("uuid");
const {inject} = require("../../utils/generic");
const _ = require("lodash");

/**
 * Handle user through websocket
 *
 * @author Dennis Zyska, Nils Dycke, Linyin Huang
 * @type {UserSocket}
 * @class UserSocket
 */
class UserSocket extends Socket {
    /**
     * Adds the username as creator_name of a database entry with column creator
     *
     * Accepts data as a list of objects or a single object
     * Note: Always returns a list of objects
     *
     * @param {object|object[]} data The data to update
     * @param {string} key The key of the user ID field
     * @param {string} targetName The name of the target field
     * @returns {Promise<Awaited<*&{creator_name: string|*|undefined}>[]>} A promise that resolves with an array of the input objects, each changed with a new field containing the creator's username.
     */
    async updateCreatorName(data, key = "userId", targetName = "creator_name") {
        return await inject(data, async (userId) => {
            if (userId in this.server.cache["userName"]) {
                return this.server.cache["userName"][userId];
            } else {
                const userName = await this.models["user"].getUserName(userId);
                this.server.cache["userName"][userId] = userName;
                return userName;
            }
        }, targetName, key);
    }

    /**
     * Filters a user object to include only a predefined set of essential fields.
     * This is useful for sending minimal, non-sensitive user information to clients.
     * 
     * @param {object} user The user object
     * @return {Object} A new object containing only the allowed fields (e.g., 'id', 'userName') from the original user object.
     */
    minimalFields(user) {
        let include = ["id", "userName"];
        const entries = Object.entries(user);
        const filtered = entries.filter(([k, v]) => include.indexOf(k) !== -1);
        return Object.fromEntries(filtered);
    }

    /**
     * Adds a new user to the database.
     * This operation is restricted to users with administrator privileges.
     * 
     * @socketEvent userCreate
     * @param data An object containing the properties for the new user record
     * @param options Configuration for the database operation.
     * @returns {Promise<*>}A promise that resolves with the newly created user object from the database.
     * @throws {Error} Throws an error if the requesting user is not an administrator.
     */
    async createUser(data, options) {
        if (!(await this.isAdmin())) {
            throw new Error("User rights and argument mismatch");
        }
        const user = await this.models["user"].add(data, {transaction: options.transaction});
        // TODO: update frontend user data, don't overwrite it was is currently done (see also refreshState in store/utils.js)
        //this.socket.emit("userData", {success: true, users: [user]});
        return user;
    }

    /**
     * Get users by their roleu.status === "duplicate"
     * 
     * @param {string} role The role of the users to fetch. Possible values: "student", "mentor", "all"
     * @returns {Promise<Object[] | void>} A promise that resolves with an array of user objects if successful, or with no value if the user lacks permission or an error occurs.
     */
    async getUsers(role) {
        try {
            const rightToFetch = `backend.socket.user.getUsers.${role}`;
            if (!(await this.hasAccess(rightToFetch))) {
                this.logger.error("This user does not have the right to load users by their role.");
                return;
            }
            return role === "all" ? await this.models["user"].getAll() : await this.models["user"].getUsersByRole(role);
        } catch (error) {
            this.logger.error(error);
        }
    }

    /**
     * Retrieves a list of users from a Moodle course via an RPC call.
     * The returned user data is then augmented with an external ID and checked for local existence in the database.
     *
     * @socketEvent userMoodleUserGetAll
     * @param {Object} options The data object containing the course ID, Moodle URL and the API token.
     * @param {number} options.courseID The ID of the course to fetch users from.
     * @param {string} options.options.apiKey The API token for the Moodle instance
     * @param {string} options.options.apiUrl The URL of the Moodle instance.
     * @returns {Promise<*>} The response from the RPC service
     */
    async getUsersFromCourse(options) {

        let userTable = await this.server.rpcs["MoodleRPC"].getUsersFromCourse(
            {
                options: {
                    courseID: Number(options.courseID),
                    apiKey: options.apiKey,
                    apiUrl: options.apiUrl,
                }
            }
        );
        userTable = await inject(userTable, (user) => user.id, "extId");
        userTable = await this.checkUsersExists(userTable);

        return userTable;
    }

    /**
     * Check a list of users if they already exist in the database by email
     * 
     * @socketEvent userCheckExistsByMail
     * @param data The data object containing the users to check at least email key is required
     * @param options The options object
     * @returns {Promise<Awaited<_.LoDashFp.T|*>[]>} An array of objects containing the status of the users
     */
    async checkUsersExists(data, options) {
        const emails = data.map((user) => user.email);
        const existingEmails = await this.models["user"].filterExistingEmails(emails);
        const duplicateEmails = existingEmails.map((item) => item.email);
        return await inject(data, (email) => duplicateEmails.includes(email), "exists", "email");
    }

    /**
     * Uploads login data to a Moodle assignment as feedback comments.
     * 
     * @socketEvent userPublishMoodle
     * @param {Object} data The data required for uploading login data.
     * @param {Object} data.options The options object containing the API key and URL of the Moodle instance.
     * @param {number} data.options.courseID The ID of the course to fetch users from.
     * @param {number} data.options.assignmentID The ID of the Moodle assignment.
     * @param {string} data.options.apiKey The API token for the Moodle instance
     * @param {string} data.options.apiUrl The URL of the Moodle instance.
     * @param {Array<Object>} data.users An array of objects containing the uploaded users.
     * @returns {Promise<Object>} A promise that resolves when the passwords have been uploaded.
     */
    async userPublishMoodle(data) {
        const feedback = data['users'].map((user) => ({
            extId: user.extId,
            text: "Username: " + user.userName + "\nPassword: " + user.password,
        }));

        return await this.server.rpcs["MoodleRPC"].publishAssignmentTextFeedback({
            options: data.options,
            feedback: feedback,
        });
    }

    /**
     *  Creates or updates a list of users in bulk.
     * Each user is processed in an isolated database transaction. Errors for individual users are caught,
     * logged, and added to an error array without halting the entire process. Progress is reported to the client.
     * 
     * @socketEvent userBulkCreate
     * @param {Object} data The data object containing the users and role map
     * @param {*} users Users to be created or updated
     * @param {Object} roleMap A role map that maps an external platform roles to CARE roles
     * @returns {Promise<{createdUsers: Array, errors: Array}>} An object containing the created users and errors
     */
    async bulkCreateUsers(data) {
        const users = data["users"];

        const createdUsers = [];
        const errors = [];
        for (const user of users) {
            // Create transaction for every user, so each creation process could be isolated
            const transaction = await this.server.db.sequelize.transaction();

            try {
                let createdUser;
                if (!user.exists) {
                    createdUser = await this.models["user"].add(user, {
                        transaction, context: {
                            userRoles: user.roles, roleMap: data["moodleCareRoleMap"],
                        },
                    })

                } else {
                    const currentUserId = await this.models["user"].getUserIdByEmail(user.email);
                    if (currentUserId) {
                        createdUser = await this.models["user"].updateById(currentUserId, {
                            firstName: user.firstName, lastName: user.lastName, extId: user.extId,
                        }, {
                            transaction, context: {
                                userRoles: user.roles, roleMap: data["moodleCareRoleMap"],
                            }
                        });
                    } else {
                        errors.push({
                            email: user.email, message: "User with mail " + user.email + " not found",
                        });
                    }
                }

                if (!createdUser) {
                    await transaction.rollback();
                } else {
                    await transaction.commit();
                    createdUsers.push({...createdUser, roles: user.roles, exists: user.exists});
                }

            } catch (error) {
                try {
                    if (error.name === "SequelizeUniqueConstraintError" && error.errors[0].path === "email") {
                        errors.push({
                            extId: user.extId, message: "duplicate email",
                        });
                    } else {
                        errors.push({
                            extId: user.extId, message: error.errors[0].message,
                        });
                    }
                } catch (e) {
                    errors.push({
                        extId: user.extId, message: e.message,
                    });
                }
                this.logger.error("Failed to bulk create user: " + user.email);
                await transaction.rollback();
            }

            // update frontend progress
            this.socket.emit("progressUpdate", {
                id: data["progressId"], current: users.indexOf(user) + 1, total: users.length,
            });
        }

        return {createdUsers, errors};
    }

    /**
     * Update user's consent data
     * It first verifies the user exists before proceeding with the update.
     * 
     * @socketEvent userConsentUpdate
     * @param {Object} data The consent data object
     * @param {boolean} data.acceptTerms Indicates whether the user has consented to the terms of service
     * @param {boolean} data.acceptStats Indicates whether the user has agreed to tracking
     * @param {boolean} data.acceptDataSharing Indicates whether the user has agreed to donate their annotation data
     * @param {string} data.acceptedAt Time when the user made the consent
     * @param {Object} options Sequelize transaction options
     * @param {Object} options.transaction A Sequelize DB transaction object.
     * @returns {Promise<Object>} A promise that resolves with the updated user object, excluding sensitive and timestamp fields.
     * @throws {Error} Throws an error if the current user cannot be found in the database.
     */
    async updateUserConsent(data, options) {
        const user = await this.models['user'].getById(this.userId);
        if (!user) {
            throw new Error("Failed to update user: User not found");
        }

        return _.omit(await this.models["user"].updateById(user.id,
                {
                    acceptStats: data.acceptStats,
                    acceptDataSharing: data.acceptDataSharing,
                    acceptTerms: data.acceptTerms,
                    acceptedAt: (user.acceptedAt === null) ? new Date() : user.acceptedAt,
                }, {transaction: options.transaction}),
            ['passwordHash', 'salt', 'initialPassword', 'createdAt', 'updatedAt', 'deletedAt', 'deleted']);

    }

    /**
     * Reset user's password
     * A user can only reset their own password unless they are an administrator.
     * 
     * @socketEvent userResetPwd
     * @param {Object} data The input data from the frontend
     * @param {number} data.userId The ID of the user
     * @param {string} data.password The new password
     * @param {Object} options Additional configuration parameter
     * @param {Object} options.transaction Sequelize DB transaction options
     * @returns {Promise<void>} A promise that resolves (with no value) once the password has been successfully reset.
     * @throws {Error} If the user is not an admin or the user tries to reset other's password
     */
    async resetUserPwd(data, options) {
        const {userId, password} = data;
        if (!await this.isAdmin() && userId !== this.userId) {
            throw new Error("User rights and argument mismatch");
        }
        await this.models["user"].resetUserPwd(userId, password);
    }

    /**
     * Get users by their role
     * 
     * @socketEvent userGetByRole
     * @param {Object} data The input data from the frontend
     * @param {string} data.role The role of the user
     * @param {Object} options Additional configuration parameter
     * @param {Object} options.transaction Sequelize DB transaction options
     * @returns {Promise<void>} A promise that resolves (with no value) once the data or an error message has been emitted.
     * @throws {Error} If the user does not have right 
     */
    async getUsersByRole(data, options) {
        try {
            const users = await this.getUsers(data.role);
            this.socket.emit("userByRole", {
                success: true, users,
            });
        } catch (error) {
            const errorMsg = "User rights and request parameter mismatch";
            this.socket.emit("userByRole", {
                success: false, message: errorMsg,
            });
            this.logger.error(errorMsg);
        }
    }

    /***
     * Emits rights associated with a user
     * Handles potential database errors by catching them and emitting a failure event.
     * 
     * @socketEvent userGetRight
     * @param {Object} data The data object containing the user identifier.
     * @param {number} data.userId the user ID
     * @param {Object} options Sequelize transaction options.
     * @returns {Promise<void>} A promise that resolves (with no value) once the user rights or an error message have been emitted.
     */
    async getUserRights(data, options) {
        try {
            const userRight = await this.models["user"].getUserRights(data.userId);
            this.socket.emit("userRight", {
                success: true, userRight,
            });
        }   catch (error) {
            this.socket.emit("userRight", {
                success: false, message: "Failed to get user right",
            });
            this.logger.error(error);
        }
    }

    init() {
        this.createSocket("userGetByRole", this.getUsersByRole, {}, false);
        this.createSocket("userGetRight", this.getUserRights, {}, false);
        this.createSocket("userUpdateDetails", this.models["user"].updateUserDetails, {}, true);
        this.createSocket("userResetPwd", this.resetUserPwd, {}, false);
        this.createSocket("userGetDetails", this.models["user"].getUserDetails, {}, false);
        this.createSocket("userConsentUpdate", this.updateUserConsent, {}, true);
        this.createSocket("userBulkCreate", this.bulkCreateUsers, {}, false);
        this.createSocket("userMoodleUserGetAll", this.getUsersFromCourse, {}, false);
        this.createSocket("userCheckExistsByMail", this.checkUsersExists, {}, false);
        this.createSocket("userCreate", this.createUser, {}, true);
        this.createSocket("userPublishMoodle", this.userPublishMoodle, {}, false);
    }
};

module.exports = UserSocket;