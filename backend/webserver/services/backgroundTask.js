const Service = require("../Service.js");
const fs = require("fs");
const path = require("path");
const UPLOAD_PATH = `${__dirname}/../../../files`;
const backgroundTask = {};

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

        this.emitData = () => {
            this.sendAll("backgroundTaskUpdate", backgroundTask);
            return true;
        };
    }

     /**
     * Overwrite method to handle incoming commands
     * @param client
     * @param {string} command
     * @param {object} data
     */
    async command(client, command, data) {
        // Send the current backgroundTask value to all clients
        if (command === "getBackgroundTask") {
            this.send(client, "backgroundTaskUpdate", backgroundTask);
        }

        // Start preprocessing of submissions by sending requests to NLPService, receiving results, and saving them to the database asynchronously
        if (command === "startPreprocessing") {
            const documentSocket = this.server.availSockets[client.socket.id]?.DocumentSocket;
            if (!documentSocket) {
                this.server.logger.error("No DocumentSocket found for client");
                return { success: false, message: "No DocumentSocket found for client" };
            }
            if (!data || !data.skill || !data.inputFiles) {
                return {
                    success: false,
                    message: "Invalid request data: missing skill or inputFiles"
                };
            }
            try {
                if (await documentSocket.isAdmin()) {
                    const configDoc = await this.server.db.models['document'].getById(data.config);
                    if (!configDoc || configDoc.type !== this.server.db.models['document'].docTypes["DOC_TYPE_CONFIG"]) {
                        this.server.logger.error(`Invalid config document: ${data.config}`);
                        return { success: false, message: "Invalid config document."};
                    }
                    const configFilePath = path.join(UPLOAD_PATH, `${configDoc.hash}.json`);
                    if (!fs.existsSync(configFilePath)) {
                        this.server.logger.error(`Config file not found: ${configFilePath}`);
                        return { success: false, message: "Config file not found on server." };
                    }

                    const configFileContent = await fs.promises.readFile(configFilePath, 'utf8');
                    const assessmentConfig = JSON.parse(configFileContent);
                    const requestIds = [];
                    const preprocessItems = [];
                    backgroundTask.preprocess = {
                        cancelled: false,
                        requests: {},
                        currentSubmissionsCount: 0,
                        batchStartTime: Date.now()
                    };
                    this.emitData();
                    for (const subId of data.inputFiles) {
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
                            docs.map(async (doc) => {
                                docIds.push(doc.id);
                                const docType = doc.type;
                                const docTypeKey = Object.keys(this.server.db.models['document'].docTypes).find(type => this.server.db.models['document'].docTypes[type] === docType);
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
                                    this.server.logger.error(`File not found for document ${doc.id} of submission ${subId} : ${docFilePath}`);
                                }
                            })
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
                        requestIds.push(requestId);
                        preprocessItems.push({ requestId, submissionId: subId, docIds, skill: data.skill, nlpInput });
                        backgroundTask.preprocess.requests[requestId] = { submissionId: subId, docIds, skill: data.skill };
                    }
                    backgroundTask.preprocess.currentSubmissionsCount = preprocessItems.length;
                    this.emitData();
                    const waitForNlpResult = async (requestId, timeoutMs = 3000000, intervalMs = 200) => {
                        const start = Date.now();
                        return await new Promise((resolve) => {
                            const interval = setInterval(() => {
                                if (backgroundTask.preprocess && backgroundTask.preprocess.cancelled) {
                                    clearInterval(interval);
                                    resolve(null);
                                    return;
                                }
                                const result = backgroundTask?.preprocess?.nlpResult;
                                if (result && result.id === requestId) {
                                    clearInterval(interval);
                                    delete backgroundTask.preprocess.nlpResult;
                                    resolve(result);
                                } else if (Date.now() - start > timeoutMs) {
                                    clearInterval(interval);
                                    // TODO: What is to be done if there is a timeout? Should this case be omitted?
                                    if (backgroundTask.preprocess && backgroundTask.preprocess.requests) {
                                        delete backgroundTask.preprocess.requests[requestId];
                                    }
                                    this.emitData();
                                    resolve(null);
                                }
                            }, intervalMs);
                        });
                    };
                    for (const item of preprocessItems) {
                        if (this.server.services['NLPService']) {
                            backgroundTask.preprocess.requests[item.requestId].startTime = Date.now();
                            this.emitData();
                            this.server.services['NLPService'].backgroundRequest(documentSocket, {
                                id: item.requestId,
                                name: item.skill,
                                data: item.nlpInput,
                                clientId: 0
                            });
                        }
                        const nlpResult = await waitForNlpResult(item.requestId);
                        if (!backgroundTask.preprocess.cancelled && nlpResult) {
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
                        } else {
                            this.server.logger.warn(`Timeout: No NLP result received for request ${item.requestId}`);
                        }
                        if (backgroundTask.preprocess && backgroundTask.preprocess.requests) {
                            delete backgroundTask.preprocess.requests[item.requestId];
                            this.emitData();
                        }
                    }
                    if (!Object.keys(backgroundTask.preprocess.requests).length) {
                        delete backgroundTask.preprocess;
                    }
                    this.emitData();
                    return {
                        success: true,
                        count: preprocessItems.length
                    };
                } else {
                    throw new Error("You do not have permission to preprocess submissions");
                }
            } catch (error) {
                this.server.logger.error(`Error in startPreprocessing: ${error.message}`, error);
                return {
                    success: false,
                    message: error.message
                };
            }
        }
        
        // Cancel preprocessing by setting the cancelled flag to true
        if (command === "cancelPreprocessing") {
            const documentSocket = this.server.availSockets[client.socket.id]?.DocumentSocket;
            if (documentSocket && await documentSocket.isAdmin() && backgroundTask.preprocess) {
                backgroundTask.preprocess.cancelled = true;
                backgroundTask.preprocess.requests = {};
                backgroundTask.preprocess.currentSubmissionsCount = 0;
                this.emitData();
                return { 
                    success: true,
                    message: "Preprocessing cancelled successfully." };
            } else {
                this.logger.error(`CancelPreprocessing failed: missing admin rights, or preprocess key in backgroundTask.`);
            }
        }
        else {
            await super.command(client, command, data);
        }
    }

    /**
     * Handles incoming results from the NLP and updates backgroundTask.preprocess
     * @param state
     * @param {object} data - The data forwarded by the NLPService
     */
    async setResult(data) {
        if (backgroundTask.preprocess && backgroundTask.preprocess.requests && !backgroundTask.preprocess.cancelled) {
            if (data) {
                backgroundTask.preprocess.nlpResult = {...data} ;
            } else {
                this.logger.error("setResult command received without result data.");
            }
        }
    }

}