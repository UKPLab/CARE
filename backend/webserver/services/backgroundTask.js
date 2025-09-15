const Service = require("../Service.js");
const fs = require("fs");
const path = require("path");
const UPLOAD_PATH = `${__dirname}/../../../files`;

/**
 * BackgroundTaskService - manages background tasks and status
 * @class
 * @author Manu Sundar Raj Nandyal
 * @classdesc A service to handle background tasks such as preprocessing documents.
 * @extends Service
 */
module.exports = class BackgroundTaskService extends Service {
    constructor(server) {
        super(server, {
            cmdTypes: [
                "getBackgroundTask",
                "startPreprocessing",
                "cancelPreprocessing",
                "setResult"
            ],
            resTypes: [
                "backgroundTaskUpdate"
            ]
        });

        this.backgroundTask = {};
        this.requestIds = [];
        this.preprocessItems = [];
    }

     /**
     * Overwrite method to handle incoming commands
     * @param client
     * @param {string} command
     * @param {object} data
     */
    async command(client, command, data) {
        switch (command) {
            case "getBackgroundTask":
                return await this.getBackgroundTask(client);
            case "startPreprocessing":
                return await this.startPreprocessing(client, data);
            case "cancelPreprocessing":
                return await this.cancelPreprocessing(client);
            default:
                return await super.command(client, command, data);
        }
    }

    /**
     * Get the current background task status and send it to the requesting client
     * @param {object} client - The client requesting the background task status
     */
    async getBackgroundTask(client) {
        this.send(client, "backgroundTaskUpdate", this.backgroundTask);
    }

    /**
     * Start preprocessing of submissions by orchestrating the preprocessing workflow
     * @param {object} client - The client initiating the preprocessing
     * @param {object} data - Contains skill, inputFiles, and config parameters
     * @param {string} data.skill - The skill to assess
     * @param {Array} data.inputFiles - Array of submission IDs to process
     * @param {string} data.config - Configuration document ID
     * @returns {object} Contains count of processed items
     * @throws {Error} When validation fails or user lacks permissions
     */
    async startPreprocessing(client, data) {
        const documentSocket = this.server.availSockets[client.socket.id]?.DocumentSocket;
        if (!documentSocket) {
            this.server.logger.error("No DocumentSocket found for client");
            throw new Error("No DocumentSocket found for client");
        }
        if (!data || !data.skill || !data.inputFiles) {
            throw new Error("Invalid request data: missing skill or inputFiles");
        }

        if (!(await documentSocket.isAdmin())) {
            throw new Error("You do not have permission to preprocess submissions");
        }

        // Load and validate configuration
        const assessmentConfig = await this.loadAssessmentConfig(data.config);
        
        // Initialize preprocessing state
        this.initializePreprocessingState();
        
        // Prepare NLP input data for all submissions
        await this.prepareNlpInput(data.inputFiles, data.skill, assessmentConfig);
        
        // Process each submission through NLP
        for (const item of this.preprocessItems) {
            await this.sendNlpRequest(documentSocket, item);
            const nlpResult = await this.waitForNlpResult(item.requestId);
            
            if (!this.backgroundTask.preprocess.cancelled && nlpResult) {
                await this.saveNlpResults(documentSocket, item, nlpResult);
            } else {
                this.server.logger.warn(`Timeout: No NLP result received for request ${item.requestId}`);
            }
            
            // Clean up completed request
            if (this.backgroundTask.preprocess && this.backgroundTask.preprocess.requests) {
                delete this.backgroundTask.preprocess.requests[item.requestId];
                this.sendAll("backgroundTaskUpdate", this.backgroundTask);
            }
        }
        
        // Clean up preprocessing state if all requests completed
        if (!Object.keys(this.backgroundTask.preprocess.requests).length) {
            delete this.backgroundTask.preprocess;
        }
        this.sendAll("backgroundTaskUpdate", this.backgroundTask);
        
        return { count: this.preprocessItems.length };
    }

    /**
     * Load and validate the assessment configuration document
     * @param {string} configId - The configuration document ID
     * @returns {object} The parsed assessment configuration
     * @throws {Error} When config is invalid or not found
     */
    async loadAssessmentConfig(configId) {
        const configDoc = await this.server.db.models['document'].getById(configId);
        if (!configDoc || configDoc.type !== this.server.db.models['document'].docTypes["DOC_TYPE_CONFIG"]) {
            this.server.logger.error(`Invalid config document: ${configId}`);
            throw new Error("Invalid config document.");
        }

        const configFilePath = path.join(UPLOAD_PATH, `${configDoc.hash}.json`);
        if (!fs.existsSync(configFilePath)) {
            this.server.logger.error(`Config file not found: ${configFilePath}`);
            throw new Error("Config file not found on server.");
        }

        const configFileContent = await fs.promises.readFile(configFilePath, 'utf8');
        return JSON.parse(configFileContent);
    }

    /**
     * Initialize the preprocessing state and notify clients
     */
    initializePreprocessingState() {
        this.requestIds = [];
        this.preprocessItems = [];
        
        this.backgroundTask.preprocess = {
            cancelled: false,
            requests: {},
            currentSubmissionsCount: 0,
            batchStartTime: Date.now()
        };
        this.sendAll("backgroundTaskUpdate", this.backgroundTask);
    }

    /**
     * Prepare NLP input data for all submissions
     * @param {Array} inputFiles - Array of submission IDs to process
     * @param {string} skill - The skill to assess
     * @param {object} assessmentConfig - The assessment configuration
     */
    async prepareNlpInput(inputFiles, skill, assessmentConfig) {
        for (const subId of inputFiles) {
            let docs;
            try {
                docs = await this.server.db.models['document'].findAll({
                    where: { submissionId: subId },
                    raw: true
                });
            } catch (err) {
                this.server.logger.error(`Error fetching documents for submission ${subId}: ${err.message}`, err);
                continue;
            }

            const docIds = [];
            const submissionFiles = {};
            
            await Promise.all(
                docs.map(doc => this.processDocumentFile(doc, docIds, submissionFiles, subId))
            );

            const hasValidFiles = Object.keys(submissionFiles).length > 0;
            if (!hasValidFiles) {
                this.server.logger.error(`No valid files found for submission ${subId}`);
                continue;
            }

            const nlpInput = {
                submission: submissionFiles,
                assessment_config: assessmentConfig,
            };
            const requestId = this.server.uuidv4 ? this.server.uuidv4() : require('uuid').v4();
            this.requestIds.push(requestId);
            this.preprocessItems.push({ requestId, submissionId: subId, docIds, skill, nlpInput });
            this.backgroundTask.preprocess.requests[requestId] = { submissionId: subId, docIds, skill };
        }
        
        this.backgroundTask.preprocess.currentSubmissionsCount = this.preprocessItems.length;
        this.sendAll("backgroundTaskUpdate", this.backgroundTask);
    }

    /**
     * Process a single document file - read, encode, and add to submission files
     * @param {object} doc - The document object from database
     * @param {Array} docIds - Array to collect document IDs
     * @param {object} submissionFiles - Object to collect encoded file data
     * @param {string} subId - Submission ID for logging purposes
     */
    async processDocumentFile(doc, docIds, submissionFiles, subId) {
        docIds.push(doc.id);
        
        const docType = doc.type;
        const docTypeKey = Object.keys(this.server.db.models['document'].docTypes)
            .find(type => this.server.db.models['document'].docTypes[type] === docType);
        
        let fileExtension = '';
        if (docTypeKey) {
            fileExtension = '.' + docTypeKey.replace('DOC_TYPE_', '').toLowerCase();
        }
        
        const docFilePath = path.join(UPLOAD_PATH, `${doc.hash}${fileExtension}`);
        
        if (fs.existsSync(docFilePath)) {
            try {
                const fileBuffer = await fs.promises.readFile(docFilePath);
                if (fileExtension === '.zip') {
                    submissionFiles.zip = fileBuffer.toString('base64');
                } else if (fileExtension === '.pdf') {
                    submissionFiles.pdf = fileBuffer.toString('base64');
                }
            } catch (readErr) {
                this.server.logger.error(`Error reading file for document ${doc.id} of submission ${subId}: ${readErr.message}`, readErr);
            }
        } else {
            this.server.logger.error(`File not found for document ${doc.id} of submission ${subId}: ${docFilePath}`);
        }
    }

    /**
     * Send an NLP request for a preprocessing item
     * @param {object} documentSocket - The document socket for the client
     * @param {object} item - The preprocessing item containing request details
     */
    async sendNlpRequest(documentSocket, item) {
        if (this.server.services['NLPService']) {
            this.backgroundTask.preprocess.requests[item.requestId].startTime = Date.now();
            this.sendAll("backgroundTaskUpdate", this.backgroundTask);
            this.server.services['NLPService'].backgroundRequest(documentSocket, {
                id: item.requestId,
                name: item.skill,
                data: item.nlpInput,
                clientId: 0
            });
        }
    }

    /**
     * Wait for NLP result with timeout and cancellation support
     * @param {string} requestId - The request ID to wait for
     * @param {number} timeoutMs - Timeout in milliseconds (default: 3000000 = 50 minutes)
     * @param {number} intervalMs - Polling interval in milliseconds (default: 200ms)
     * @returns {Promise<object|null>} The NLP result or null if cancelled/timeout
     */
    async waitForNlpResult(requestId, timeoutMs = 3000000, intervalMs = 200) {
        const start = Date.now();
        return await new Promise((resolve) => {
            const interval = setInterval(() => {
                if (this.backgroundTask.preprocess && this.backgroundTask.preprocess.cancelled) {
                    clearInterval(interval);
                    resolve(null);
                    return;
                }
                const result = this.backgroundTask?.preprocess?.nlpResult;
                if (result && result.id === requestId) {
                    clearInterval(interval);
                    delete this.backgroundTask.preprocess.nlpResult;
                    resolve(result);
                } else if (Date.now() - start > timeoutMs) {
                    clearInterval(interval);
                    // TODO: What is to be done if there is a timeout? Should this case be omitted?
                    if (this.backgroundTask.preprocess && this.backgroundTask.preprocess.requests) {
                        delete this.backgroundTask.preprocess.requests[requestId];
                    }
                    this.sendAll("backgroundTaskUpdate", this.backgroundTask);
                    resolve(null);
                }
            }, intervalMs);
        });
    }

    /**
     * Save NLP results to the database
     * @param {object} documentSocket - The document socket for the client
     * @param {object} item - The preprocessing item containing document IDs and skill
     * @param {object} nlpResult - The NLP result data to save
     */
    async saveNlpResults(documentSocket, item, nlpResult) {
        try {
            await Promise.all(
                item.docIds.flatMap(docId =>
                    Object.keys(nlpResult).map(key =>
                        this.server.db.models['document_data'].upsert({
                            userId: documentSocket.userId,
                            documentId: docId,
                            studySessionId: null,
                            studyStepId: null,
                            key: `${item.skill}_nlpAssessment_${key}`,
                            value: nlpResult[key]
                        }, {})
                    )
                )
            );
        } catch (saveErr) {
            this.server.logger.error(`Error saving NLP results for request ${item.requestId}: ${saveErr.message}`, saveErr);
        }
    }

    /**
     * Cancel preprocessing by setting the cancelled flag to true and clearing all requests
     * @param {object} client - The client requesting cancellation
     * @returns {string} Success message
     * @throws {Error} When user lacks admin rights or no active preprocessing
     */
    async cancelPreprocessing(client) {
        const documentSocket = this.server.availSockets[client.socket.id]?.DocumentSocket;
        if (!documentSocket || !(await documentSocket.isAdmin())) {
            throw new Error("Cannot cancel preprocessing: missing admin rights");
        }
        if (!this.backgroundTask.preprocess) {
            throw new Error("Cannot cancel preprocessing: no active preprocessing");
        }

        this.backgroundTask.preprocess.cancelled = true;
        this.backgroundTask.preprocess.requests = {};
        this.backgroundTask.preprocess.currentSubmissionsCount = 0;
        this.sendAll("backgroundTaskUpdate", this.backgroundTask);
        
        return "Preprocessing cancelled successfully.";
    }

    /**
     * Handles incoming results from the NLP and updates backgroundTask.preprocess
     * @param state
     * @param {object} data - The data forwarded by the NLPService
     */
    async setResult(data) {
        if (this.backgroundTask.preprocess && this.backgroundTask.preprocess.requests && !this.backgroundTask.preprocess.cancelled) {
            if (data) {
                this.backgroundTask.preprocess.nlpResult = {...data} ;
            } else {
                this.logger.error("setResult command received without result data.");
            }
        }
    }

}