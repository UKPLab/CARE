const RPC = require("../RPC.js");
const {io: io_client} = require("socket.io-client");

/**
 * Connects to the Moodle RPC service
 *
 * @class
 * @author Alexander Bürkle, Dennis Zyska, Nils Dycke
 * @classdesc This class connects to the Moodle RPC service and provides methods to interact with it.
 * @extends RPC
 */
module.exports = class MoodleRPC extends RPC {

    constructor(server) {
        const url = "ws://" + process.env.RPC_MOODLE_HOST + ":" + process.env.RPC_MOODLE_PORT;
        super(server, url);

    }

    /**
     * Send request to moodle RPC service
     *
     * @param {Object} data - The data object
     * @param {String} eventName - The request name to send to the RPC service
     * @returns {Promise<Object>} - The response from the RPC service
     * @throws {Error} If the RPC service call fails or returns an unsuccessful response.
     */
    async request(eventName, data) {
        this.logger.info("Calling RPC service with request: " + eventName);

        const response = await this.emit(eventName, data);
        if (!response['success']) {
            this.logger.error("Error in request " + eventName + ": " + response['message']);
            throw new Error(response['message']);
        }
        return response;
    }


    /**
     * Retrieves users from a specified moodle course and returns the data as an array.
     *
     * @param {Object} data - The data object containing the course ID, Moodle URL and the API token.
     * @param {number} data.courseID - The ID of the course to fetch users from.
     * @param {string} data.options.apiKey - The API token for the Moodle instance
     * @param {string} data.options.url - The URL of the Moodle instance.
     * @returns {Promise<List>} - List of dictionaries, each containing the following keys: id, firstname, lastname, email, username, roles
     * @throws {Error} If the RPC service call fails or returns an unsuccessful response.
     */
    async getUsersFromCourse(data) {
        try {
            const response = await this.request("getUsersFromCourse", data);
            return response['data'];
        } catch (err) {
            throw err;
        }
    }

    /**
     * Retrieves users from a specified assignment in a moodle course and returns the data as an array.
     *
     * WARNING: This method only works, if at least one submission has been made to the assignment.
     * If you need to use it before any students have submitted, you can submit a dummy file to the assignment.
     *
     * @param {Object} data - The data object containing the course ID, assignment ID, Moodle URL and the API token.
     * @param {number} data.courseID - The ID of the course to fetch users from.
     * @param {number} data.assignmentID - The ID of the assignment to fetch users from.
     * @param {string} data.options.apiKey - The API token for the Moodle instance
     * @param {string} data.options.url - The URL of the Moodle instance.
     * @returns {Promise<List>} - List of dictionaries, each containing the following keys: id, firstname, lastname, email, username, roles@
     * @throws {Error} If the RPC service call fails or returns an unsuccessful response.
     */
    async getUsersFromAssignment(data) {
        try {
            return this.request("getUsersFromAssignment", data);
        } catch (err) {
            throw err;
        }
    }

    /**
     * Retrieves information about all assignments in a specified Moodle course.
     *
     * @param {Object} data - The data object containing the course ID, Moodle URL and the API token.
     * @param {number} data.options.courseID - The ID of the course to fetch assignments from.
     * @param {string} data.options.apiKey - The API token for the Moodle instance
     * @param {string} data.options.url - The URL of the Moodle instance.
     * TODO: the return data structure to be decided
     * @returns {Promise<List>} - Information about the assignments in the course
     * @throws {Error} If the RPC service call fails or returns an unsuccessful response.
     */
    async getAssignmentInfoFromCourse(data) {
        try {
            return this.request("getAssignmentInfoFromCourse", data);
        } catch (err) {
            throw err;
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
        const results = await this.request("getSubmissionInfosFromAssignment", data);
        return results['data'];
    }

    /**
     * Downloads submissions from a user by their id.
     *
     * @param {List<String>} data - Containing the urls of the submissions to download. The urls can be retrieved from the 'submissionURLs' field of the response from 'getSubmissionInfosFromAssignment'.
     * @returns {Promise<Object>} The submission file data in binary format.
     * @throws {Error} If the RPC service returns a failure response or an error occurs during the process.
     */
    async downloadSubmissionsFromUrl(data) {
        const response = await this.request("downloadSubmissionsFromUrl", data);
        if (!response.success) {
            throw new Error(response.message);
        }
        return response['data'];
    }

    /**
     * Publishes the text feedback for an assignment to Moodle.
     *
     * @param {Object} data - The data required for uploading login data.
     * @param {Object} data.options - The options object containing the API key and URL of the Moodle instance.
     * @param {number} data.options.courseID - The ID of the course to fetch users from.
     * @param {number} data.options.assignmentID - The ID of the Moodle assignment.
     * @param {string} data.options.apiKey - The API token for the Moodle instance
     * @param {string} data.options.apiUrl - The URL of the Moodle instance.
     * @param {Array<Object>} data.feedback - An array of objects containing the uploaded users:
     * @param {number} data.feedback.extId - The ID of the user.
     * @param {string} data.feedback.feedback - The feedback text.
     * @returns {Promise<Object>} - A promise that resolves when the passwords have been uploaded.
     */
    async publishAssignmentTextFeedback(data) {
        return await this.request("publishAssignmentTextFeedback", data);
    }
}
