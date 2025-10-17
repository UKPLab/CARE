const Socket = require("../Socket.js");

/**
 * Handle all studies through websocket
 *
 * Loading the studies through websocket
 *
 * @author Dennis Zyska
 * @type {DocumentSocket}
 * @class StudySocket
 */
class StudySocket extends Socket {

    /**
     * Creates a new study template based on an existing study.
     * This operation is restricted to the owner of the original study or an administrator.
     * 
     * @socketEvent studySaveAsTemplate
     * @param {object} data The data object containing the identifier for the source study.
     * @param {number} data.id the ID of the study to save as template
     * @param {object} options Configuration for the database operation.
     * @param {Object} options.transaction A Sequelize DB transaction object.
     * @returns {Promise<*>} A promise that resolves with the newly created study template object from the database.
     * @throws {Error} Throws an error if the user does not have permission to access the source study.
     */
    async saveStudyAsTemplate(data, options) {
        const currentStudy = await this.models['study'].getById(data['id']);

        if (await this.checkUserAccess(currentStudy.userId)) {
            const studySteps = await this.models['study_step'].getAllByKey("studyId", currentStudy.id);
            
            const stepDocuments = [];
            for (const step of studySteps) {
                if (step.workflowStepId) {
                    stepDocuments.push({
                        id: step.workflowStepId,
                        documentId: step.documentId,
                        configuration: step.configuration
                    });
                }
            }

            const newStudyData = {
                ...currentStudy,
                id: undefined,
                hash: undefined,
                template: true,
            };
            
            return await this.models['study'].add(newStudyData, {
                transaction: options.transaction,
                context: { stepDocuments: stepDocuments }
            });
        } else {
            throw new Error("No permission to save study as template");
        }
    }

    /**
     * Closes all studies associated with a given project ID in a loop.
     * Each study is updated in its own database transaction. Progress is reported to the client after each study is processed.
     * 
     * @socketEvent studyCloseBulk
     * @param data The data required for the bulk close operation.
     * @param data.projectId the project ID of the studies to close
     * @param data.ignoreClosedState if true, also close studies that are already closed
     * @param data.progressId the ID of the progress bar to update
     * @param options Additional configuration parameters (currently unused).
     * @returns {Promise<void>} A promise that resolves (with no value) once all studies in the project have been processed.
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
        this.createSocket("studySaveAsTemplate", this.saveStudyAsTemplate, {}, true);
        this.createSocket("studyCloseBulk", this.closeBulk, {}, false);

    }
}

module.exports = StudySocket;