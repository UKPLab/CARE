const Socket = require("../Socket.js");
const {v4: uuidv4} = require('uuid');
const {Op} = require("sequelize");
const {inject} = require("../../utils/generic");

/**
 * Handle all studies through websocket
 *
 * Loading the studies through websocket
 *
 * @author Dennis Zyska
 * @type {DocumentSocket}
 */
module.exports = class StudySocket extends Socket {

    /**
     * Add a new study
     * @param study
     * @returns {Promise<void>}
     */
    async addStudy(study) {
        study.userId = this.userId;
        if (this.getSocket("DocumentSocket")) {
            this.getSocket("DocumentSocket").saveDocument(study.documentId);
        }
        const newStudy = await this.models['study'].add(study);
        this.emit("studyRefresh", newStudy);
        return newStudy;
    }

    /**
     * Send all studies to the client
     * @param {number|null} userId if null, all studies will be sent (admin only)
     * @returns {Promise<*>}
     */
    async sendStudies(userId = null) {
        try {
            if (await this.isAdmin()) {
                if (userId) {
                    this.emit("studyRefresh", await this.models['study'].getAllByKey('userId', userId));
                } else {
                    this.emit("studyRefresh", await this.models['study'].getAll());
                }
            } else {
                this.emit("studyRefresh", await this.models['study'].getAllByKey('userId', this.userId));
            }
        } catch (err) {
            this.logger.error(err);
        }
    }

    /**
     * Send a study by hash
     * @param {string} studyHash
     * @returns {Promise<void>}
     */
    async sendStudyByHash(studyHash) {
        const study = await this.models['study'].getByHash(studyHash);
        // TODO: study db info, workflows in study where the studies are referenced , workflow steps, study step 
        if (study) {
            const workflow = await this.models['workflow'].getById(study.workflowId);
            if (workflow) {
                const workflowSteps = await this.models['workflow_step'].getAllByKey('workflowId', workflow.id);
                if (workflowSteps) {
                    const studySteps = await this.models['study_step'].getAllByKey('studyId', study.id);
                    const studySession = await this.models['study_session'].findAll({
                        where:
                            {"userId": this.userId, "studyId": study.id}, raw: true,
                    });
                    this.emit("workflowRefresh", workflow);
                    this.emit("workflow_stepRefresh", workflowSteps);
                    this.emit("study_stepRefresh", studySteps);
                    this.emit("study_sessionRefresh", studySession);
                    this.emit("studyRefresh", await inject(study, async (x) => {
                            return await this.models['study_session'].count({
                                where: {
                                    studyId: x
                                }
                            });
                        }, "totalNumberOfOpenedSessions", "id")
                    );

                } else {
                    this.socket.emit("studyError", {
                        studyHash: studyHash, message: "No workflow steps found!"
                    });
                }
            } else {
                this.socket.emit("studyError", {
                    studyHash: studyHash, message: "No workflow found!"
                });
            }

            /*
            const responseData = {
                ...study,
                workflow: workflow ? {
                    id: workflow.id,
                    name: workflow.name,
                    description: workflow.description
                } : null,
                workflowSteps: workflowSteps? workflowSteps.map(step => {
                    return {
                        id: step.id,
                        workflowId: step.workflowId,
                        stepType: step.stepType,
                        workflowStepPrevious: step.workflowStepPrevious,
                        allowBackward: step.allowBackward,
                        workflowStepDocument: step.workflowStepDocument,
                        configuration: step.configuration,
                    }
                })
                : null,
                studySteps: studySteps? studySteps.map(step => {
                    return {
                        id: step.id,
                        studyId: step.study,
                        workflowStepId: step.workflowStepId,
                        documentId: step.documentId,
                    }
                })
                : null
            };
            */

        } else {
            this.socket.emit("studyError", {
                studyHash: studyHash, message: "Not found!"
            });
        }
    }

    /**
     * Send a study by id
     * @param {number} studyId
     * @returns {Promise<void>}
     */
    async sendStudy(studyId) {
        const study = await this.models['study'].getById(studyId);
        if (study) {
            this.emit("studyRefresh", study);
        } else {
            this.socket.emit("studyError", {
                studyHash: data.studyHash, message: "Not found!"
            });
        }
    }

    /**
     * Publish a study
     * @param {object} data
     * @return {Promise<void>}
     */
    async publishStudy(data) {
        const doc = await this.models['document'].getById(data.documentId);
        if (this.checkUserAccess(doc.userId)) {
            let study;
            if (data.id) {
                study = await this.models['study'].updateById(data.id, data);
                this.emit("studyRefresh", study);
            } else {
                study = await this.addStudy(data);
            }

            if (study) {
                this.socket.emit("studyPublished", {success: true, studyHash: study.hash});
            } else {
                this.socket.emit("studyPublished", {
                    success: false, message: "Error publishing study."
                });
            }
        } else {
            this.logger.error("No permission to publish study: " + data.documentId);
            this.socket.emit("studyPublished", {
                success: false, message: "No permission to publish study"
            });
        }
    }

    /**
     * Save the current study as a template (create a new study with template: true)
     * @param {number} studyId - The ID of the study to be saved as a template
     * @returns {Promise<*>}
     */
    async saveStudyAsTemplate(studyId) {
        try {
            const currentStudy = await this.models['study'].getById(studyId);

            if (this.checkUserAccess(currentStudy.userId)) {

                const newStudyData = {
                    ...currentStudy,
                    id: undefined, 
                    template: true,
                };
                const newStudy = await this.models['study'].create(newStudyData);

                this.emit("studyRefresh", newStudy);

                return newStudy;
            } else {
                this.sendToast("You are not allowed to save this study as a template", "Error", "Danger");
            }
        } catch (error) {
            this.logger.error("Error saving study as template:", error);
            throw error;
        }
    }

    async init() {

        this.socket.on("studyGet", async (data) => {
            try {
                await this.sendStudy(data.studyId);
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studyGetAll", async (data) => {
            try {
                await this.sendStudies((data && data.userId) ? data.userId : null);
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studyGetByHash", async (data) => {
            try {
                await this.sendStudyByHash(data.studyHash);
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("studyPublish", async (data) => {
            try {
                await this.publishStudy(data)
            } catch (e) {
                this.logger.error(e);
                this.socket.emit("studyPublished", {
                    success: false, message: "Error while publishing study"
                });

            }
        });

        this.socket.on("studySaveAsTemplate", async (data) => {
            try {
                if (data.studyId && data.studyId !== 0) {
                    await this.saveStudyAsTemplate(data.studyId);
                }
            } catch (err) {
                this.logger.error(err);
                this.sendToast(err, "Error saving study as template", "Danger");
            }
        });

    }
}