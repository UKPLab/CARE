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
     * Save the current study as a template (create a new study with template: true)
     * @param {object} data
     * @param {number} data.id - the id of the study to save as template
     * @param {object} options - the options for the transaction
     * @returns {Promise<*>}
     */
    async saveStudyAsTemplate(data, options) {
        const currentStudy = await this.models['study'].getById(data['id']);

        if (await this.checkUserAccess(currentStudy.userId)) {

            const newStudyData = {
                ...currentStudy,
                id: undefined,
                hash: undefined,
                template: true,
            };
            return await this.models['study'].add(newStudyData, {transaction: options.transaction});
        } else {
            throw new Error("No permission to save study as template");
        }
    }

    /**
     * Close a bulk of studies
     * @param data
     * @param data.projectId - the project id of the studies to close
     * @param data.ignoreClosedState - if true, also close studies that are already closed
     * @param data.progressId - the id of the progress bar to update
     * @param options - not used
     * @returns {Promise<void>}
     */
    async closeBulk(data, options) {

        const studies = await this.models['study'].getAllByKey('projectId', data.projectId);
        for (const study of studies) {
            if (study.closed) {
                if (!("ignoreClosedState" in data) || !data.ignoreClosedState) {
                    continue;
                }
            }
            const transaction = await this.server.db.sequelize.transaction();

            try {

                await this.models['study'].updateById(study.id, {closed: true}, {transaction: transaction});
                await transaction.commit();
            } catch (e) {
                this.logger.error(e);
                await transaction.rollback();
            }

            // update frontend progress
            this.socket.emit("progressUpdate", {
                id: data["progressId"], current: studies.indexOf(study) + 1, total: studies.length,
            });
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

        this.createSocket("studySaveAsTemplate", this.saveStudyAsTemplate, {}, true);
        this.createSocket("studyCloseBulk", this.closeBulk, {}, false);

    }
}