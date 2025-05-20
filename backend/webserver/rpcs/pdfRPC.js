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
module.exports = class PDFRPC extends RPC {

    constructor(server) {
        const url = "ws://" + process.env.RPC_PDF_HOST + ":" + process.env.RPC_PDF_PORT;
        super(server, url);

        this.timeout = 30000; //default timeout for connection

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
    async test(data) {
        try {
            const response = await this.request("test", data);
            if (!response['success']) {
                this.logger.error("Error in request " + eventName + ": " + response['message']);
                throw new Error(response['message']);
            }
            this.logger.info("Response from RPC service: " + response['message']);
            return response['data'];
        } catch (err) {
            throw err;
        }
    }

    async getAnnotations(data) {
        try {
            const response = await this.request("annotations", data);
            if (!response['success']) {
                this.logger.error("Error in request " + eventName + ": " + response['message']);
                throw new Error(response['message']);
            }
            this.logger.info("Response from RPC service: " + response['message']);
            return response['data'];
        } catch (err) {
            throw err;
        }
    }

    async emmbedAnnotations(data) {
        try {
            const response = await this.request("emmbedAnnotations", data);
            if (!response['success']) {
                this.logger.error("Error in request " + eventName + ": " + response['message']);
                throw new Error(response['message']);
            }
            this.logger.info("Response from RPC service: " + response['message']);
            return response['data'];
        } catch (err) {
            throw err;
        }
    }

}
