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
     * @param {object} preprocessingData - Contains skillName, skillParameterMappings, baseFileParameter, and baseFiles
     * @param {string} preprocessingData.skillName - The skill to apply
     * @param {object} preprocessingData.skillParameterMappings - Parameter mappings with table and fileIds
     * @param {string} preprocessingData.baseFileParameter - The base file parameter name
     * @param {object} preprocessingData.baseFiles - Base file selections for validation
     * @returns {object} Contains count of processed items
     * @throws {Error} When validation fails or user lacks permissions
     */
    async startPreprocessing(client, preprocessingData) {
        const documentSocket = this.server.availSockets[client.socket.id]?.DocumentSocket;
        if (!documentSocket) {
            this.server.logger.error("No DocumentSocket found for client");
            throw new Error("No DocumentSocket found for client");
        }
        
        if (!preprocessingData || !preprocessingData.skillName || !preprocessingData.skillParameterMappings) {
            throw new Error("Invalid request data: missing skillName or skillParameterMappings");
        }

        if (!(await documentSocket.isAdmin())) {
            throw new Error("You do not have permission to preprocess submissions");
        }

        this.initializePreprocessingState();

        await this.prepareProcessingItems(preprocessingData);
        
        for (const item of this.preprocessItems) {

            if (this.backgroundTask.preprocess && this.backgroundTask.preprocess.cancelled) {
                break;
            }

            try {
                const nlpInput = await this.prepareNlpInput(item);
                
                if (!nlpInput || Object.keys(nlpInput).length === 0) {
                    this.server.logger.error(`No valid NLP input prepared for item ${item.requestId}`);
                    continue;
                }

                item.nlpInput = nlpInput;                
                await this.sendNlpRequest(documentSocket, item);
                
                const nlpResult = await this.waitForNlpResult(item.requestId);
                
                if (!this.backgroundTask.preprocess.cancelled && nlpResult) {
                    await this.saveNlpResult(documentSocket, item, nlpResult);
                } else if (!nlpResult) {
                    this.server.logger.warn(`Timeout: No NLP result received for request ${item.requestId}`);
                }
                
            } catch (err) {
                this.server.logger.error(`Error processing item ${item.requestId}: ${err.message}`, err);
            }
            
            if (this.backgroundTask.preprocess && this.backgroundTask.preprocess.requests) {
                delete this.backgroundTask.preprocess.requests[item.requestId];
                this.sendAll("backgroundTaskUpdate", this.backgroundTask);
            }
        }
        
        if (!Object.keys(this.backgroundTask.preprocess.requests).length) {
            delete this.backgroundTask.preprocess;
        }
        this.sendAll("backgroundTaskUpdate", this.backgroundTask);
        
        return { count: this.preprocessItems.length };
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
     * Prepare the list of items to be processed based on the new generalized data structure
     * @param {object} preprocessingData - The preprocessing data from ApplySkillsModal
     * @param {string} preprocessingData.skillName - The skill name to apply
     * @param {object} preprocessingData.skillParameterMappings - Parameter mappings with table and fileIds
     * @param {string} preprocessingData.baseFileParameter - The base file parameter name
     * @param {object} preprocessingData.baseFiles - Base file selections for validation
     */
    async prepareProcessingItems(preprocessingData) {
        const { skillName, skillParameterMappings, baseFileParameter, baseFiles } = preprocessingData;
        
        if (!skillParameterMappings) {
            throw new Error("No skill parameter mappings provided");
        }

        this.preprocessItems = [];
        this.requestIds = [];

        const parameterNames = Object.keys(skillParameterMappings);
        const parameterValues = parameterNames.map(paramName => 
            skillParameterMappings[paramName].fileIds.map(fileId => ({
                paramName,
                fileId,
                table: skillParameterMappings[paramName].table
            }))
        );

        const combinations = this.getCartesianProduct(parameterValues);

        for (const combination of combinations) {
            const requestId = this.server.uuidv4 ? this.server.uuidv4() : require('uuid').v4();
            this.requestIds.push(requestId);
            
            const item = {
                requestId,
                skillName,
                combination,
                baseFileParameter,
                baseFiles
            };
            
            this.preprocessItems.push(item);
            this.backgroundTask.preprocess.requests[requestId] = { 
                combination: combination.map(c => `${c.paramName}:${c.fileId}`).join(','),
                skillName 
            };
        }
        
        this.backgroundTask.preprocess.currentSubmissionsCount = this.preprocessItems.length;
        this.sendAll("backgroundTaskUpdate", this.backgroundTask);
    }

    /**
     * Compute the Cartesian product of arrays
     * @param {Array<Array>} arrays - An array of arrays to compute the product of
     * @returns {Array<Array>} The Cartesian product as an array of arrays
     */
    getCartesianProduct(arrays) {
        return arrays.reduce((acc, curr) => {
            const result = [];
            acc.forEach(accItem => {
                curr.forEach(currItem => {
                    result.push([...accItem, currItem]);
                });
            });
            return result;
        }, [[]]);
    }

    /**
     * Prepare NLP input for a single processing item
     * @param {object} item - The processing item
     * @returns {object} The prepared NLP input data
     */
    async prepareNlpInput(item) {
        const { combination } = item;
        const nlpInput = {};

        for (const paramData of combination) {
            const { paramName, fileId, table } = paramData;

            switch (table) {
                case "submission":
                    nlpInput[paramName] = await this.loadSubmission(fileId);
                    break;
                case "document":
                    nlpInput[paramName] = await this.loadDocument(fileId);
                    break;
                case "configuration":
                    nlpInput[paramName] = await this.loadConfiguration(fileId);
                    break;
                default:
                    this.server.logger.warn(`Unknown table type: ${table} for parameter: ${paramName}`);
            }
        }

        return nlpInput;
    }

    /**
     * Load all documents related to a submission and convert to base64
     * @param {number} submissionId - The id of the submission
     * @returns {object} An object with document types as keys and base64 file contents as values
     */
    async loadSubmission(submissionId) {
        let docs;
        try {
            docs = await this.server.db.models['document'].findAll({
                where: { submissionId: submissionId },
                raw: true
            });
        } catch (err) {
            this.server.logger.error(`Error fetching documents for submission ${submissionId}: ${err.message}`, err);
            return {};
        }

        const submissionFiles = {};
        
        await Promise.all(
            docs.map(async (doc) => {
                const processedDoc = await this.processDocument(doc);
                if (processedDoc) {
                    const docType = doc.type;
                    const docTypeKey = Object.keys(this.server.db.models['document'].docTypes)
                        .find(type => this.server.db.models['document'].docTypes[type] === docType);
                    
                    if (docTypeKey) {
                        const fileTypeKey = docTypeKey.replace('DOC_TYPE_', '').toLowerCase();
                        submissionFiles[fileTypeKey] = processedDoc;
                    }
                }
            })
        );

        const hasValidFiles = Object.keys(submissionFiles).length > 0;
        if (!hasValidFiles) {
            this.server.logger.error(`No valid files found for submission ${submissionId}`);
            return {};
        }

        return submissionFiles;
    }

    /**
     * Load and process a single document by its id
     * @param {number} documentId - The id of the document
     * @returns {string|null} The base64 encoded file content or null if not found/error
     */
    async loadDocument(documentId) {
        try {
            const doc = await this.server.db.models['document'].findByPk(documentId, { raw: true });
            if (!doc) {
                this.server.logger.warn(`Document ${documentId} not found`);
                return null;
            }
                        
            return await this.processDocument(doc);
        } catch (err) {
            this.server.logger.error(`Error processing document ${documentId}: ${err.message}`, err);
            return null;
        }
    }

    /**
     * Load a configuration by its id and parse its content
     * @param {number} configId - The id of the configuration
     * @returns {object|null} The parsed configuration object or null if not found/error
     */
    async loadConfiguration(configId) {
        try {
            const config = await this.server.db.models['configuration'].findByPk(configId, { raw: true });
            if (!config) {
                this.server.logger.warn(`Configuration ${configId} not found`);
                return null;
            }

            return JSON.parse(config?.content);
        } catch (err) {
            this.server.logger.error(`Error loading configuration ${configId}: ${err.message}`, err);
            return null;
        }
    }

    /**
     * Process a document to read its file and convert to base64
     * @param {object} doc - The document object from the database
     * @returns {string|null} The base64 encoded file content or null if not found/error
     */
    async processDocument(doc) {
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
                return fileBuffer.toString('base64');
            } catch (readErr) {
                this.server.logger.error(`Error reading file for document ${doc.id}: ${readErr.message}`, readErr);
                return null;
            }
        } else {
            this.server.logger.error(`File not found for document ${doc.id}: ${docFilePath}`);
            return null;
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
                name: item.skillName,
                data: item.nlpInput,
                clientId: 0
            });
        }
    }

    /**
     * Wait for NLP result until a result is received or preprocessing is cancelled
     * If a result is not received, it continues to wait indefinitely until cancelled
     * @param {string} requestId - The request id to wait for
     * @param {number} intervalMs - Polling interval in milliseconds (default: 200ms)
     * @returns {Promise<object|null>} The NLP result or null if cancelled/timeout
     */
    async waitForNlpResult(requestId, intervalMs = 200) {
        const start = Date.now(); // TODO: This can be used to show the start time of the request
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
                }
            }, intervalMs);
        });
    }

    /**
     * Save NLP result to the database
     * @param {object} documentSocket - The document socket for the client
     * @param {object} item - The preprocessing item containing file information and skill
     * @param {object} nlpResult - The NLP result data to save
     */
    async saveNlpResult(documentSocket, item, nlpResult) {
        try {
            const { combination, baseFileParameter, baseFiles } = item;
            
            const baseParamData = combination.find(param => param.paramName === baseFileParameter);
            if (!baseParamData) {
                this.server.logger.error(`Base file parameter '${baseFileParameter}' not found in combination`);
                return;
            }

            const { table, fileId } = baseParamData;
            let baseFileToSave = null;

            if (table === 'submission') {
                const submission = await this.server.db.models['submission'].findByPk(fileId, { raw: true });
                if (!submission) {
                    this.server.logger.error(`Submission ${fileId} not found`);
                    return;
                }

                if (!submission.validationDocumentId || !baseFiles || !baseFiles[submission.validationDocumentId]) {
                    this.server.logger.warn(`Submission ${fileId} does not have a valid validation document id or base file mapping`);
                    return;
                }

                const baseFileType = baseFiles[submission.validationDocumentId];

                const docTypeKey = `DOC_TYPE_${baseFileType.toUpperCase()}`;
                const docTypeValue = this.server.db.models['document'].docTypes[docTypeKey];
                
                if (docTypeKey in this.server.db.models['document'].docTypes) {
                    const doc = await this.server.db.models['document'].findOne({
                        where: { 
                            submissionId: fileId,
                            type: docTypeValue 
                        },
                        raw: true
                    });
                    baseFileToSave = doc ? doc.id : null;
                } else {
                    this.server.logger.warn(`Unknown document type: ${baseFileType} (looking for ${docTypeKey})`);
                    return;
                }
            } else if (table === 'document') {
                baseFileToSave = fileId;
            } else {
                this.server.logger.warn(`Unsupported base table type for saving results: ${table}`);
                return;
            }

            if (!baseFileToSave) {
                this.server.logger.warn(`No valid document found to save results for request ${item.requestId}`);
                return;
            }
           
            const resultData = nlpResult.data || {};
            
            await Promise.all(
                Object.keys(resultData).map(key =>
                    this.server.db.models['document_data'].upsert({
                        userId: documentSocket.userId,
                        documentId: baseFileToSave,
                        studySessionId: null,
                        studyStepId: null,
                        key: `${item.skillName}_nlpRequest_${key}`,
                        value: resultData[key]
                    }, {}) 
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