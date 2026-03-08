const Socket = require("../Socket.js");
const {getEmailContent} = require("../../utils/emailHelper");

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
     * Creates a new study template based on an existing study or directly from data.
     * This operation is restricted to the owner of the original study or an administrator.
     * 
     * @socketEvent studySaveAsTemplate
     * @param {object} data The data object containing the identifier for the source study or template data.
     * @param {number} data.id the ID of the study to save as template (required if onlyTemplate is false)
     * @param {boolean} data.onlyTemplate if true, creates template directly from provided data without creating a study
     * @param {object} data.templateData the template data when onlyTemplate is true
     * @param {object} options Configuration for the database operation.
     * @param {Object} options.transaction A Sequelize DB transaction object.
     * @returns {Promise<*>} A promise that resolves with the newly created study template object from the database.
     * @throws {Error} Throws an error if the user does not have permission to access the source study.
     */
    async saveStudyAsTemplate(data, options) {
        if (data.onlyTemplate && data.templateData) {
            const templateData = {
                ...data.templateData,
                userId: this.socket.user.id,
                template: true,
            };
            
            return await this.models['study'].add(templateData, {
                transaction: options.transaction,
                context: { stepDocuments: data.templateData.stepDocuments || [] }
            });
        } else {
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
    }

    /**
     * Send study closed email to users with open/unfinished sessions.
     * Uses Type 6 templates configured in settings.
     * @param {Object} study - Study object
     * @returns {Promise<void>}
     */
    async sendStudyClosedEmails(study) {
        const baseUrl = await this.models["setting"].get("system.baseUrl") || "localhost:3000";

        try {
            const openSessions = await this.models["study_session"].getAllByKey(
                "studyId",
                study.id,
            );
            
            const unfinishedSessions = openSessions.filter(
                (s) => s.end === null && !s.deleted,
            );

            if (unfinishedSessions.length === 0) {
                this.logger.info(`No open sessions found for study ${study.id}, skipping study close emails`);
                return;
            }

            const userIds = [...new Set(unfinishedSessions.map(s => s.userId))];

            for (const sessionOwnerId of userIds) {
                try {
                    const user = await this.models['user'].getById(sessionOwnerId);
                    if (!user || !user.email) {
                        this.logger.warn(`Cannot send study closed email: user ${sessionOwnerId} has no email`);
                        continue;
                    }

                    const emailContent = await getEmailContent(
                        "email.template.studyClosed",
                        "CARE - Study Closed",
                        `Hello,

The study "${study.name}" has been closed.

Best regards,
The CARE Team`,
                        {
                            userId: sessionOwnerId,
                            studyId: study.id,
                            studyName: study.name,
                            baseUrl: baseUrl,
                            templateType: 6
                        },
                        this.models,
                        this.logger
                    );

                    await this.server.sendMail(user.email, emailContent.subject, emailContent.body, { isHtml: emailContent.isHtml });
                } catch (error) {
                    this.logger.error(`Failed to send study closed email to user ${sessionOwnerId}:`, error);
                }
            }
        } catch (error) {
            this.logger.error(`Failed to send study closed emails for study ${study.id}:`, error);
        }
    }

    /**
     * Close a single study by setting its closed flag.
     * Validates that the study exists and is not already closed.
     * Sends study closed emails after the transaction commits (optional, based on notifySessions flag).
     *
     * @socketEvent studyClose
     * @param {object} data The data required to close the study.
     * @param {number} data.studyId The ID of the study to close.
     * @param {object} options Configuration for the database operation.
     * @param {Object} options.transaction A Sequelize DB transaction object to ensure atomicity.
     * @returns {Promise<Object>} The updated study object.
     */
    async closeStudy(data, options) {
        if (!data.studyId) {
            throw new Error("studyId is required");
        }

        const study = await this.models["study"].getById(data.studyId, {transaction: options.transaction});
        if (!study) {
            throw new Error("Study not found");
        }

        if (study.closed) {
            throw new Error("Study is already closed");
        }

        const updatedStudy = await this.models["study"].updateById(
            data.studyId,
            {closed: true},
            {transaction: options.transaction}
        );

        const notifySessions = data.notifySessions === true;

        options.transaction.afterCommit(async () => {
            if (!notifySessions) {
                return;
            }
            try {
                const updatedStudy = await this.models["study"].getById(data.studyId);
                await this.sendStudyClosedEmails(updatedStudy);
            } catch (error) {
                this.logger.error(`Failed to send study closed emails for study ${data.studyId}:`, error);
            }
        });

        return updatedStudy;
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
                const notifySessions = data.notifySessions === true;
                transaction.afterCommit(async () => {
                    this.broadcastTransactionChanges(transaction);
                    // Send study closed emails after transaction commits (optional, based on notifySessions flag)
                    if (notifySessions) {
                        try {
                            const updatedStudy = await this.models['study'].getById(study.id);
                            await this.sendStudyClosedEmails(updatedStudy);
                        } catch (error) {
                            this.logger.error(`Failed to send study closed emails for study ${study.id}:`, error);
                        }
                    }
                });
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
        this.createSocket("studyClose", this.closeStudy, {}, true);
    }
}

module.exports = StudySocket;