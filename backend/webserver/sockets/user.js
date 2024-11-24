const Socket = require("../Socket.js");
const {v4: uuidv4} = require("uuid");
const {inject} = require("../../utils/generic");

/**
 * Handle user through websocket
 *
 * @author Dennis Zyska, Nils Dycke, Linyin Huang
 * @type {UserSocket}
 */
module.exports = class UserSocket extends Socket {
    /**
     * Adds the username as creator_name of a database entry with column creator
     *
     * Accepts data as a list of objects or a single object
     * Note: Always returns a list of objects
     *
     * @param {object|object[]} data - The data to update
     * @param {string} key - The key of the user ID field
     * @param {string} targetName - The name of the target field
     * @returns {Promise<Awaited<*&{creator_name: string|*|undefined}>[]>}
     */
    async updateCreatorName(data, key = "userId", targetName = "creator_name") {
        return await inject(data, async (userId) => await this.models["user"].getUserName(userId), targetName, key);
    }

    /**
     * Shows only specific fields of a user
     * @param {object} user - The user object
     * @return {{[p: string]: any}}
     */
    minimalFields(user) {
        let include = ["id", "userName"];
        if (this.isAdmin()) {
            include.push("lastLoginAt", "acceptStats");
        }
        const entries = Object.entries(user);
        const filtered = entries.filter(([k, v]) => include.indexOf(k) !== -1);
        return Object.fromEntries(filtered);
    }

    /**
     * Add a user to the database
     * @param data
     * @param options
     * @returns {Promise<*>}
     * @throws {Error} - If the user is not an admin
     */
    async createUser(data, options) {
        if (!this.isAdmin()) {
            throw new Error("User rights and argument mismatch");
        }
        const user = await this.models["user"].add(data, {transaction: options.transaction});
        // TODO: update frontend user data, don't overwrite it was is currently done (see also refreshState in store/utils.js)
        //this.socket.emit("userData", {success: true, users: [user]});
        return user;
    }

    /**
     * Send all user data to the client (only for admins)
     * @return {Promise<void>}
     */
    async sendUserData() {
        if (this.isAdmin()) {
            const users = await this.models["user"].getAll();
            const mappedUsers = users.map((x) => this.minimalFields(x));

            this.socket.emit("userData", {success: true, users: mappedUsers});
        } else {
            this.socket.emit("userData", {
                success: false, message: "User rights and argument mismatch",
            });
            this.logger.error("User right and request parameter mismatch");
        }
    }

    /**
     * Get users by their roleu.status === "duplicate"
     * @param {string} role - The role of the users to fetch. Possible values: "student", "mentor", "all"
     * @returns {string[]} An array of users.
     */
    async getUsers(role) {
        try {
            const rightToFetch = `backend.socket.user.getUsers.${role}`;
            if (!(await this.hasAccess(rightToFetch))) {
                this.logger.error("This user does not have the right to load users by their role.");
                return;
            }

            return role === "all" ? await this.models["user"].getAllUsers() : await this.models["user"].getUsersByRole(role);
        } catch (error) {
            this.logger.error(error);
        }
    }

    /**
     * Retrieves users from a specified moodle course and returns the data as an array.
     *
     * @param {Object} options - The data object containing the course ID, Moodle URL and the API token.
     * @param {number} options.courseID - The ID of the course to fetch users from.
     * @param {string} options.options.apiKey - The API token for the Moodle instance
     * @param {string} options.options.apiUrl - The URL of the Moodle instance.
     * @returns {Promise<*>} - The response from the RPC service
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
     * @param data - The data object containing the users to check - at least email key is required
     * @returns {Promise<Awaited<_.LoDashFp.T|*>[]>} - An array of objects containing the status of the users
     */
    async checkUsersExists(data) {
        const emails = data.map((user) => user.email);
        const existingEmails = await this.models["user"].filterExistingEmails(emails);
        const duplicateEmails = existingEmails.map((item) => item.email);
        return await inject(data, (email) => duplicateEmails.includes(email), "exists", "email");
    }

    /**
     * Uploads login data to a Moodle assignment as feedback comments.
     * @param {Object} data - The data required for uploading login data.
     * @param {Object} data.options - The options object containing the API key and URL of the Moodle instance.
     * @param {number} data.options.courseID - The ID of the course to fetch users from.
     * @param {number} data.options.assignmentID - The ID of the Moodle assignment.
     * @param {string} data.options.apiKey - The API token for the Moodle instance
     * @param {string} data.options.apiUrl - The URL of the Moodle instance.
     * @param {Array<Object>} data.users - An array of objects containing the uploaded users.
     * @returns {Promise<Object>} - A promise that resolves when the passwords have been uploaded.
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
     * Bulk create or update users
     * @param {Object} data - The data object containing the users and role map
     * @dataparam {*} users - Users to be created or updated
     * @dataparam {Object} roleMap - A role map that maps an external platform roles to CARE roles
     * @returns {Promise<{createdUsers: Array, errors: Array}>} - An object containing the created users and errors
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
                    createdUsers.push({...createdUser, roles: user.roles, exists: user.exists});
                    await transaction.commit();
                }

            } catch (error) {
                try {
                    if (error.name === "SequelizeUniqueConstraintError" && error.errors[0].path === "email") {
                        errors.push({
                            userId: user.id, message: "duplicate email",
                        });
                    } else {
                        errors.push({
                            userId: user.id, message: error.errors[0].message,
                        });
                    }
                } catch (e) {
                    errors.push({
                        userId: user.id, message: "unknown error",
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

    init() {
        this.socket.on("userGetData", async (data) => {
            try {
                await this.sendUserData();
            } catch (e) {
                this.socket.emit("userData", {
                    success: false, message: "Failed to retrieve all users",
                });
                this.logger.error("DB error while loading all users from database" + JSON.stringify(e));
            }
        });

        // Update user's consent
        this.socket.on("userUpdateConsent", async (consentData, callback) => {
            try {
                await this.models["user"].updateUserConsent(this.userId, consentData);
                callback({
                    success: true, message: "Successfully updated user consent!",
                });
            } catch (error) {
                callback({
                    success: false, message: "Failed to updated user consent!",
                });
                this.logger.error(error);
            }
        });

        // Get users by their role
        this.socket.on("userGetByRole", async (role) => {
            try {
                const users = await this.getUsers(role);
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
        });

        // Get specific user's details
        this.socket.on("userGetDetails", async (userId) => {
            try {
                const user = await this.models["user"].getUserDetails(userId);
                this.socket.emit("userDetails", {
                    success: true, user,
                });
            } catch (error) {
                this.socket.emit("userDetails", {
                    success: false, message: "Failed to load user details",
                });
                this.logger.error(error);
            }
        });

        // Get right associated with the user
        this.socket.on("userGetRight", async (userId) => {
            try {
                const userRight = await this.models["user"].getUserRight(userId);
                this.socket.emit("userRight", {
                    success: true, userRight,
                });
            } catch (error) {
                this.socket.emit("userRight", {
                    success: false, message: "Failed to get user right",
                });
                this.logger.error(error);
            }
        });

        // Update user's following data: firstName, lastName, email, roles
        this.socket.on("userUpdateDetails", async (data, callback) => {
            const {userId, userData} = data;
            try {
                await this.models["user"].updateUserDetails(userId, userData);
                callback({
                    success: true, message: "Successfully updated user!",
                });
            } catch (error) {
                callback({
                    success: false, message: "Failed to update user details",
                });
                this.logger.error(error);
            }
        });

        // Reset user's password
        this.socket.on("userResetPwd", async (data, callback) => {
            const {userId, password} = data;
            try {
                await this.models["user"].resetUserPwd(userId, password);
                callback({
                    success: true, message: "Successfully reset password!",
                });
            } catch (error) {
                callback({
                    success: false, message: "Failed to reset password",
                });
                this.logger.error(error);
            }
        });

        this.createSocket("userBulkCreate", this.bulkCreateUsers, {}, false);
        this.createSocket("userMoodleUserGetAll", this.getUsersFromCourse, {}, false);
        this.createSocket("userCheckExistsByMail", this.checkUsersExists, {}, false);
        this.createSocket("userCreate", this.createUser, {}, true);
        this.createSocket("userPublishMoodle", this.userPublishMoodle, {}, false);

    }
};
