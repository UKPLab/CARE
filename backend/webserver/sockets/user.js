const Socket = require("../Socket.js");
const {v4: uuidv4} = require("uuid");
const {genSalt, genPwdHash} = require("../../utils/auth.js");
const {generateMarvelUsername} = require("../../utils/generator.js");
const {inject} = require("../../utils/generic");
const database = require("../../db");

/**
 * Handle user through websocket
 *
 * @author Nils Dycke, Dennis Zyska, Linyin Huang
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
                success: false,
                message: "User rights and argument mismatch",
            });
            this.logger.error("User right and request parameter mismatch");
        }
    }

    /**
     * Get users by their role
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
     * @param {Object} courseData - The data object containing the course ID, Moodle URL and the API token.
     * @param {number} courseData.courseID - The ID of the course to fetch users from.
     * @param {string} courseData.options.apiKey - The API token for the Moodle instance
     * @param {string} courseData.options.url - The URL of the Moodle instance.
     * @returns {Promise<Array>} - An array of objects, each containing the following keys: id, firstname, lastname, email, username, roles
     */
    async getUsersFromCourse(courseData) {
        const {courseID} = courseData;
        const convertedCourseID = Number(courseID);
        const updatedCourseData = {...courseData, convertedCourseID};
        try {
            return await this.server.rpcs["MoodleRPC"].getUsersFromCourse(updatedCourseData);
        } catch (error) {
            this.logger.error(error);
        }
    }

    /**
     * Uploads login data to a Moodle assignment as feedback comments.
     * @param {Object} moodleData - The data required for uploading login data.
     * @param {number} moodleData.courseID - The ID of the course to fetch users from.
     * @param {number} moodleData.assignmentID - The ID of the Moodle assignment.
     * @param {Array<Object>} moodleData.loginData - An array of objects containing user IDs, usernames and passwords.
     * @param {string} moodleData.options.apiKey - The API token for the Moodle instance
     * @param {string} moodleData.options.url - The URL of the Moodle instance.
     * @returns {Promise<void>} - A promise that resolves when the passwords have been uploaded.
     */
    async uploadDataToMoodle(moodleData) {
        const {courseID, assignmentID} = moodleData;
        const convertedCourseID = Number(courseID);
        const convertedAsgID = Number(assignmentID);
        const updatedMoodleData = {...moodleData, convertedCourseID, convertedAsgID};
        try {
            return await this.server.rpcs["MoodleRPC"].uploadLoginDataToMoodle(updatedMoodleData);
        } catch (error) {
            this.logger.error(error);
        }
    }

    /**
     * Bulk create or update users
     * @param {*} users - Users to be created or updated
     * @param {Object} roleMap - A role map that maps an external platform roles to CARE roles
     * @returns {Promise<array>} - A list of created or updated users
     */
    async bulkCreateUsers(data) {
        const {users, roleMap} = data;

        const createdUsers = [];
        const errors = [];
        for (const user of users) {
            // Create transaction for every user, so each creation process could be isolated
            const transaction = await this.server.db.sequelize.transaction();

            try {
                let createdUser, password;
                if (user.status === "new") {
                    password = uuidv4().replace(/-/g, "").substring(0, 8);
                    const salt = genSalt();
                    const pwdHash = await genPwdHash(password, salt);

                    let username;
                    let retries = 0;
                    const maxRetries = 5;

                    while (retries < maxRetries) {
                        username = generateMarvelUsername();
                        try {
                            createdUser = await this.models["user"].create(
                                {
                                    firstName: user.firstname,
                                    lastName: user.lastname,
                                    userName: username,
                                    email: user.email,
                                    passwordHash: pwdHash,
                                    salt,
                                    moodleId: Number(user.id),
                                    acceptTerms: false,
                                    acceptStats: false,
                                    createdAt: new Date(),
                                    updatedAt: new Date(),
                                },
                                {
                                    hooks: true,
                                    individualHooks: true,
                                    transaction,
                                    context: {
                                        userRoles: user.roles,
                                        roleMap,
                                    },
                                }
                            );
                            break;
                        } catch (error) {
                            if (error.name === "SequelizeUniqueConstraintError" && error.errors[0].path === "userName") {
                                retries++;
                            } else {
                                throw error;
                            }
                        }
                    }

                    if (!createdUser) {
                        throw new Error("Failed to create user with unique username");
                    }
                } else {
                    await this.models["user"].update(
                        {
                            firstName: user.firstname,
                            lastName: user.lastname,
                            moodleId: user.id,
                        },
                        {
                            where: {email: user.email},
                            hooks: true,
                            individualHooks: true,
                            transaction,
                            context: {
                                userRoles: user.roles,
                                roleMap,
                            },
                        }
                    );

                    createdUser = await this.models["user"].findOne({
                        where: {email: user.email},
                    });
                }

                createdUsers.push({
                    id: createdUser.moodleId,
                    firstname: createdUser.firstName,
                    lastname: createdUser.lastName,
                    username: createdUser.userName,
                    email: createdUser.email,
                    roles: user.roles,
                    password: user.status === "new" ? password : "",
                    status: user.status,
                });
            } catch (error) {
                if (error.name === "SequelizeUniqueConstraintError" && error.errors[0].path === "email") {
                    errors.push({
                        userId: user.id,
                        message: "duplicate email",
                    });
                } else {
                    errors.push({
                        userId: user.id,
                        message: error.errors[0].message,
                    });
                }
                this.logger.error("Failed to bulk create user: " + error);
            }
        }

        return {createdUsers, errors};
    }

    init() {
        // Upload moodleIDs, usernames and passwords to Moodle
        this.socket.on("userUploadToMoodle", async (moodleData, callback) => {
            try {
                const {success, data} = await this.uploadDataToMoodle(moodleData);
                callback({
                    success,
                    users: data,
                });
            } catch (error) {
                this.logger.error(error);
                callback({
                    success: false,
                    message: "Failed to upload to Moodle",
                });
            }
        });

        this.socket.on("userGetMoodleData", async (courseData, callback) => {
            try {
                const {success, data} = await this.getUsersFromCourse(courseData);
                callback({
                    success,
                    users: data,
                });
            } catch (error) {
                this.logger.error(error);
                callback({
                    success: false,
                    message: "Failed to get users from Moodle",
                });
            }
        });

        this.socket.on("userGetData", async (data) => {
            try {
                await this.sendUserData();
            } catch (e) {
                this.socket.emit("userData", {
                    success: false,
                    message: "Failed to retrieve all users",
                });
                this.logger.error("DB error while loading all users from database" + JSON.stringify(e));
            }
        });

        // Update user's consent
        this.socket.on("userUpdateConsent", async (consentData, callback) => {
            try {
                await this.models["user"].updateUserConsent(this.userId, consentData);
                callback({
                    success: true,
                    message: "Successfully updated user consent!",
                });
            } catch (error) {
                callback({
                    success: false,
                    message: "Failed to updated user consent!",
                });
                this.logger.error(error);
            }
        });

        // Get users by their role
        this.socket.on("userGetByRole", async (role) => {
            try {
                const users = await this.getUsers(role);
                this.socket.emit("userByRole", {
                    success: true,
                    users,
                });
            } catch (error) {
                const errorMsg = "User rights and request parameter mismatch";
                this.socket.emit("userByRole", {
                    success: false,
                    message: errorMsg,
                });
                this.logger.error(errorMsg);
            }
        });

        // Get specific user's details
        this.socket.on("userGetDetails", async (userId) => {
            try {
                const user = await this.models["user"].getUserDetails(userId);
                this.socket.emit("userDetails", {
                    success: true,
                    user,
                });
            } catch (error) {
                this.socket.emit("userDetails", {
                    success: false,
                    message: "Failed to load user details",
                });
                this.logger.error(error);
            }
        });

        // Get right associated with the user
        this.socket.on("userGetRight", async (userId) => {
            try {
                const userRight = await this.models["user"].getUserRight(userId);
                this.socket.emit("userRight", {
                    success: true,
                    userRight,
                });
            } catch (error) {
                this.socket.emit("userRight", {
                    success: false,
                    message: "Failed to get user right",
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
                    success: true,
                    message: "Successfully updated user!",
                });
            } catch (error) {
                callback({
                    success: false,
                    message: "Failed to update user details",
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
                    success: true,
                    message: "Successfully reset password!",
                });
            } catch (error) {
                callback({
                    success: false,
                    message: "Failed to reset password",
                });
                this.logger.error(error);
            }
        });

        // Send in users to check against the DB if the users are already in the DB
        this.socket.on("userCheckDuplicatesByEmail", async (users, callback) => {
            try {
                const emails = users.map((user) => user.email);
                const existingEmails = await this.models["user"].filterExistingEmails(emails);
                const duplicateEmails = existingEmails.map((item) => item.email);
                users.forEach((user) => {
                    user.status = duplicateEmails.includes(user.email) ? "duplicate" : "new";
                });
                callback({
                    success: true,
                    users,
                });
            } catch (error) {
                callback({
                    success: false,
                    message: "Failed to check for duplicate users",
                });
                this.logger.error(error);
            }
        });

        this.createSocket("userBulkCreate", this.bulkCreateUsers, {}, false);
        /*
        // Bulk create users
        this.socket.on("userBulkCreate", async (userData, callback) => {


          const { users, moodleCareRoleMap } = userData;
          try {
            const { createdUsers, errors } = await this.bulkCreateUsers(users, moodleCareRoleMap);
            callback({
              success: true,
              message: "Users successfully created",
              createdUsers,
              errors
            });
          } catch (error) {
            this.logger.error(error);
            callback({
              success: false,
              message: "Failed to bulk create users",
            });
          }
        });*/
    }
};
