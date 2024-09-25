const RPC = require("../RPC.js");
const {io: io_client} = require("socket.io-client");
const {spawn} = require("child_process");
const path = require("path");

/**
 * Hold connection and data for external RPC test service
 *
 * @class
 * @author Alexander Bürkle, Dennis Zyska, Nils Dycke
 * @classdesc A service that connects to an external RPC service via socket.ic.
 * @extends RPC
 */
module.exports = class MoodleRPC extends RPC {
    
    constructor(server) {
        const url = "ws://" + process.env.RPC_MOODLE_HOST + ":" + process.env.RPC_MOODLE_PORT;
        super(server, url);

    }

    async init() {
        await this.reset();

        // connect to test service
        this.socket = io_client(this.url,
            {
                reconnection: true,
                timeout: this.timeout,
            }
        );
        this.updateEvents(this.socket);
        this.logger.info("Connect to RPC server at " + this.url);
        this.socket.connect();

        this.logger.info("RPC initialized");

        
}

async updateEvents(socket) {
    const self = this;

    // Handle connection errors
    socket.on("connect_error", async () => {
        setTimeout(() => {
            if (socket) {
                socket.connect();
            }
        }, self.retryDelay);

    });

    // Handle reconnection attempts
    socket.on("reconnection_attempt", () => {
        self.logger.error("RPC Test Reconnection attempt...");
    });

    // establishing a connection
    socket.on("connect", function () {
        self.logger.info(`Connection to RPC server established: ${socket.connected}`);

    });

    // deal with broken connection
    socket.on("disconnect", function () {
        self.logger.error(`Connection to RPC server disrupted: ${!socket.connected}`);
    });
}

    /**
     * This method should be overwritten to handle the call to the RPC service
     * @param data
     * @returns {Promise<*>}
     */
    async call(data) {
        this.logger.info("Calling RPC service...");

        try {
            this.logger.info(data);
            return this.emit("call", data);
            
        } catch (err) {
            throw err
        }

    }


    /**
     * Retrieves users from a specified moodle course and returns the data in csv format.
     *
     * @param {Object} data - The data object containing the course ID, Moodle URL and the API token.
     * @param {number} data.courseID - The ID of the course to fetch users from.
     * @param {string} data.options.apiKey - The API token for the Moodle instance
     * @param {string} data.options.url - The URL of the Moodle instance.
     * @returns {Promise<Object>} - User information in csv format. (Columns: id, firstname, lastname, email, username, password)
     * @throws {Error} If the RPC service call fails or returns an unsuccessful response.
     */
    async getUsersFromCourse(data) {
        this.logger.info("Calling RPC service...");

        try {
            this.logger.info(data);
            const response = this.emit("getUsersFromCourse", data);
            if (response.success === false) {
                throw new Error(response.message);
            }
            return response;
            
        } catch (err) {
            throw err
        }
    }

    /**
     * Retrieves users from a specified moodle assignment and returns the data in csv format.
     *
     * @param {Object} data - The data object containing the course ID, assignment ID, Moodle URL and the API token.
     * @param {number} data.courseID - The ID of the course to fetch users from.
     * @param {number} data.assignmentID - The ID of the assignment to fetch users from.
     * @param {string} data.options.apiKey - The API token for the Moodle instance
     * @param {string} data.options.url - The URL of the Moodle instance.
     * @returns {Promise<Object>} - User information in csv format. (Columns: id, firstname, lastname, email, username, password)
     * @throws {Error} If the RPC service call fails or returns an unsuccessful response.
     */
    async getUsersFromAssignment(data) {
        this.logger.info("Calling RPC service...");

        try {
            this.logger.info(data);
            const response = this.emit("getUsersFromAssignment", data);
            if (response.success === false) {
                throw new Error(response.message);
            }
            return response;
            
        } catch (err) {
            throw err
        }
    }

    /**
     * Retrieves submission information from a specified moodle assignment. This includes a list of users and their corresponding submission files (name and url).
     *
     * @param {Object} data - The data object containing the course ID, assignment ID, Moodle URL and the API token.
     * @param {number} data.courseID - The ID of the course to fetch users from.
     * @param {number} data.assignmentID - The ID of the assignment to fetch users from.
     * @param {string} data.options.apiKey - The API token for the Moodle instance
     * @param {string} data.options.url - The URL of the Moodle instance.
     * @returns {Promise<List>} - A list of dictionaries, each containing:
            - 'userid' (int): The ID of the user who made the submission.
            - 'submissionURLs' (list): A list of dictionaries, each containing:
                - 'filename' (str): The name of the submitted file.
                - 'fileurl' (str): The URL to access the submitted file.
     * @throws {Error} If the RPC service call fails or returns an unsuccessful response.
     */
    async getSubmissionInfosFromAssignment(data) {
        this.logger.info("Calling RPC service...");

        try {
            this.logger.info(data);
            const response = this.emit("getSubmissionInfosFromAssignment", data);
            if (response.success === false) {
                throw new Error(response.message);
            }
            return response;
            
        } catch (err) {
            throw err
        }
    }

    /**
     * Downloads submissions from a user by their id.
     *
     * @param {List<String>} data - Containing the urls of the submissions to download. The urls can be retrieved from the 'submissionURLs' field of the response from 'getSubmissionInfosFromAssignment'.
     * @returns {Promise<Object>} The submission file data in binary format.
     * @throws {Error} If the RPC service returns a failure response or an error occurs during the process.
     */
    async downloadSubmissionsFromUser(data) {
        this.logger.info("Calling RPC service...");

        try {
            this.logger.info(data);
            const response = this.emit("downloadSubmissionsFromUser", data);
            if (response.success === false) {
                throw new Error(response.message);
            }
            return response;
            
        } catch (err) {
            throw err
        }
    }

    /**
     * Uploads passwords to a Moodle assignment as feedback comments.
     *
     * @param {Object} data - The data required for uploading passwords.
     * @param {number} data.courseID - The ID of the course to fetch users from.
     * @param {number} data.assignment_id - The ID of the Moodle assignment.
     * @param {Array<Object>} data.passwords - A list of dictionaries containing user IDs and passwords.
     * @param {string} data.options.apiKey - The API token for the Moodle instance
     * @param {string} data.options.url - The URL of the Moodle instance.
     * @returns {Promise<void>} - A promise that resolves when the passwords have been uploaded.
     */
    async uploadPasswordsToMoodle(data) {
        this.logger.info("Calling RPC service...");

        try {
            this.logger.info(data);
            const response = this.emit("uploadPasswordsToMoodle", data);
            if (response.success === false) {
                throw new Error(response.message);
            }
            return response;
            
        } catch (err) {
            throw err
        }
    }


}
