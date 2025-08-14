
const Service = require("../Service.js");
const {io: io_client} = require("socket.io-client");
const fs = require("fs");
const path = require("path");
const yaml = require('js-yaml');

const UPLOAD_PATH = path.resolve(__dirname, '../../files');

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
                "cancelPreprocessing"
            ],
            resTypes: [
                "backgroundTaskUpdate"
            ]
        });

        this.tasks = server.preprocess;
        function debounce(fn, delay) {
            let timer = null;
            return function(...args) {
                clearTimeout(timer);
                timer = setTimeout(() => fn.apply(this, args), delay);
            };
        }

        this.emitData = () => {
            this.sendAll("backgroundTaskUpdate", server.preprocess);
            return true;
        };
        this.emitUpdate = debounce(this.emitData, 100);

        this.setPreprocess = (newObj) => {
            server.preprocess = newObj || {};
            this.emitData();
            this.emitUpdate();
        };

        this.setPreprocess(server.preprocess || {});
        setInterval(() => {
            this.emitUpdate();
        }, 100);
    }

     /**
     * Overwrite method to handle incoming commands
     * @param client
     * @param {string} command
     * @param {object} data
     */
    async command(client, command, data) {
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
                    console.log("Config Document:", configDoc);
                    if (!configDoc || configDoc.type !== this.server.db.models['document'].docTypes["DOC_TYPE_CONFIG"]) {
                        return { success: false, message: "Invalid or missing config file." };
                    }
                    const configFilePath = path.join(UPLOAD_PATH, `${configDoc.hash}.json`); //TODO: Error Point to resolve
                    if (!fs.existsSync(configFilePath)) {
                        return { success: false, message: "Config file not found on server." };
                    }

                    console.log("Reached mid-way in startPreprocessing");
                    const configFileContent = await fs.promises.readFile(configFilePath, 'utf8');
                    const assessmentConfig = JSON.parse(configFileContent);
                    const requestIds = [];
                    const preprocessItems = [];
                    this.server.preprocess = this.server.preprocess || {};
                    this.server.preprocess.cancelled = false;
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
                            continue; // Skip this submission
                        }
                        const nlpInput = {
                            submission: submissionFiles,
                            assessment_config: assessmentConfig,
                        };
                        const requestId = this.server.uuidv4 ? this.server.uuidv4() : require('uuid').v4();
                        requestIds.push(requestId);
                        preprocessItems.push({ requestId, submissionId: subId, docIds, skill: data.skill, nlpInput });
                        if (!this.server.preprocess.requests) this.server.preprocess.requests = {};
                        this.server.preprocess.requests[requestId] = { submissionId: subId, docIds, skill: data.skill };
                    }
                    this.server.preprocess.currentSubmissionsCount = preprocessItems.length;
                    const waitForNlpResult = async (server, requestId, timeoutMs = 3000000, intervalMs = 200) => {
                        const start = Date.now();
                        return await new Promise((resolve) => {
                            const interval = setInterval(() => {
                                if (server.preprocess && server.preprocess.cancelled) {
                                    clearInterval(interval);
                                    resolve(null);
                                    return;
                                }
                                const result = server.preprocess && server.preprocess.nlpResult;
                                if (result && result.id === requestId) {
                                    clearInterval(interval);
                                    delete server.preprocess.nlpResult;
                                    resolve(result);
                                } else if (Date.now() - start > timeoutMs) {
                                    clearInterval(interval);
                                    if (server.preprocess) {
                                        if (server.preprocess.requests) delete server.preprocess.requests[requestId];
                                    }
                                    resolve(null);
                                }
                            }, intervalMs);
                        });
                    };
                    for (const item of preprocessItems) {
                        if (this.server.services['NLPService']) {
                            this.server.services['NLPService'].backgroundRequest(documentSocket, {
                                id: item.requestId,
                                name: item.skill,
                                data: item.nlpInput,
                                clientId: 0
                            });
                        }
                        const nlpResult = await waitForNlpResult(this.server, item.requestId);
                        if (!this.server.preprocess.cancelled && nlpResult) {
                            try {
                                await Promise.all(
                                    item.docIds.map(docId =>
                                        documentSocket.saveData({
                                            userId: documentSocket.userId,
                                            documentId: docId,
                                            studySessionId: null,
                                            studyStepId: null,
                                            key: `service_nlpGrading_${item.skill}`,
                                            value: nlpResult
                                        }, {})
                                    )
                                );
                            } catch (saveErr) {
                                this.server.logger.error(`Error saving NLP results for request ${item.requestId}: ${saveErr.message}`, saveErr);
                            }
                        } else {
                            this.server.logger.warn(`Timeout: No NLP result received for request ${item.requestId}`);
                        }
                        if (this.server.preprocess && this.server.preprocess.requests) {
                            delete this.server.preprocess.requests[item.requestId];
                        }
                    }
                    this.server.preprocess = {};
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
        } else if (command === "cancelPreprocessing") {
            // TODO: Needs logic check
            const documentSocket = this.server.availSockets[client.socket.id]?.DocumentSocket;
            if (documentSocket && await documentSocket.isAdmin() && this.server.preprocess) {
                this.server.preprocess.cancelled = true;
                this.server.preprocess.requests = {};
                this.server.preprocess.currentSubmissionsCount = 0;
                this.emitData();
            } else {
                this.logger.error(`CancelPreprocessing failed: missing DocumentSocket, admin rights, or preprocess object.`);
            }
        } else {
            await super.command(client, command, data);
        }
    }

}