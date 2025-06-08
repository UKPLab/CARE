const RPC = require("../RPC.js");
const {io: io_client} = require("socket.io-client");

/**
 * PDFRPC - Handles PDF annotation operations via a remote RPC service
 *
 * This class provides methods to interact with a remote PDF RPC service for retrieving, embedding, and deleting annotations in PDF files, as well as other PDF-related operations.
 *
 * @class
 * @author Alexander Bürkle, Dennis Zyska, Nils Dycke, Karim Ouf
 * @classdesc Connects to the PDF RPC service and exposes PDF annotation and manipulation methods.
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
     * Retrieves annotations from a PDF file via the PDF RPC service.
     *
     * @param {Object} data - The data object containing the file and document info.
     * @param {Buffer} data.file - The PDF file as a buffer or binary data.
     * @param {Object} data.document - The document metadata object.
     * @param {string} data.fileType - The file type (e.g., ".pdf").
     * @returns {Promise<Array>} - Resolves to an array of annotation objects, each containing selectors, tagId, studySessionId, studyStepId, text, etc.
     * @throws {Error} If the RPC service call fails or returns an unsuccessful response.
     */
    async getAnnotations(data) {
        try {
            const response = await this.request("annotationsExtract", data);
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
    /**
     * Embeds annotations into a PDF file via the PDF RPC service.
     *
     * @param {Object} data - The data object containing the file, annotations, and document info.
     * @param {Buffer} data.file - The PDF file as a buffer or binary data.
     * @param {Array} data.annotations - The annotations to embed.
     * @param {Object} data.document - The document metadata object.
     * @returns {Promise<Object>} - The response from the RPC service.
     * @throws {Error} If the RPC service call fails or returns an unsuccessful response.
     */
    async embeddAnnotations(data) {
        try {
            const response = await this.request("embedAnnotations", data);
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

    /**
     * Deletes all annotations from a PDF file via the PDF RPC service.
     *
     * @param {Object} data - The data object containing the file and document info.
     * @param {Buffer} data.file - The PDF file as a buffer or binary data.
     * @param {Object} data.document - The document metadata object.
     * @returns {Promise<Buffer>} - Resolves to the processed PDF file buffer with all annotations removed.
     * @throws {Error} If the RPC service call fails or returns an unsuccessful response.
     */
    async deleteAllAnnotations(data) {
        try {
            const response = await this.request("deleteAllAnnotations", data);
            if (!response['success']) {
                this.logger.error("Error in request deleteAllAnnotations: " + response['message']);
                throw new Error(response['message']);
            }
            this.logger.info("Response from RPC service: " + response['message']);
            return response['data'];
        } catch (err) {
            throw err;
        }
    }

}
