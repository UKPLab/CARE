const fs = require("fs");
const path = require("path");


const UPLOAD_PATH = `${__dirname}/../../../files`;

const Socket = require("../Socket.js");

/**
 * Handle all uploads through websocket
 *
 * Uploading a file through websocket
 *
 * @author Alexander Bürkle, Dennis Zyska
 * @type {MoodleSocket}
 */
module.exports = class MoodleSocket extends Socket {
    async getUsersFromCourse(data) {
        this.logger.info("Calling MoodleRPC with: " + JSON.stringify(data));

        const response = await this.server.rpcs["MoodleRPC"].getUsersFromCourse(data);

        this.logger.info("Response: " + response);

        this.socket.emit("courseUsersCSV", response);
    };

    async getUsersFromAssignment(data) {
        this.logger.info("Calling MoodleRPC with: " + JSON.stringify(data));

        const response = await this.server.rpcs["MoodleRPC"].getUsersFromAssignment(data);

        this.logger.info("Response: " + response);

        this.socket.emit("assignmentUsersCSV", response);
    };

    async getSubmissionInfosFromAssignment(data) {
        this.logger.info("Calling MoodleRPC with: " + JSON.stringify(data));

        const response = await this.server.rpcs["MoodleRPC"].getSubmissionInfosFromAssignment(data);

        this.logger.info("Response: " + response);

        this.socket.emit("submissionInfos", response);
    }

    async downloadSubmissionsFromUser(data) {
        this.logger.info("Calling MoodleRPC with: " + JSON.stringify(data));

        const response = await this.server.rpcs["MoodleRPC"].downloadSubmissionsFromUser(data);

        this.logger.info("Response: " + response);

        this.socket.emit("downloadSubmissions", response);
    }

    async uploadLoginDataTomoodle(data) {
        this.logger.info("Calling MoodleRPC with: " + JSON.stringify(data));

        const response = await this.server.rpcs["MoodleRPC"].uploadLoginDataTomoodle(data);

        this.logger.info("Response: " + response);
        
        this.socket.emit("uploadPasswords", response);
    }

    init() {
        this.socket.on("getUsersFromCourse", async (data) => {
            try {
                await this.getUsersFromCourse(data);
            } catch (err) {
                this.logger.error("Couldn't get users from course. Error: " + err);
            }
        });

        this.socket.on("getUsersFromAssignment", async (data) => {
            try {
                await this.getUsersFromAssignment(data);
            } catch (err) {
                this.logger.error("Couldn't get users from assignment. Error: " + err);
            }
        });

        this.socket.on("getSubmissionInfosFromAssignment", async (data) => {
            try {
                await this.getSubmissionInfosFromAssignment(data);
            } catch (err) {
                this.logger.error("Couldn't get submission infos from assignment. Error: " + err);
            }
        });

        this.socket.on("downloadSubmissionsFromUser", async (data) => {
            try {
                await this.downloadSubmissionsFromUser(data);
            } catch (err) {
                this.logger.error("Couldn't download submissions from user. Error: " + err);
            }
        });

        this.socket.on("uploadPasswordsToMoodle", async (data) => {
            try {
                await this.uploadPasswordsToMoodle(data);
            } catch (err) {
                this.logger.error("Couldn't upload passwords to Moodle. Error: " + err);
            }
        });
}
}