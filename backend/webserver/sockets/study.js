const Socket = require("../Socket.js");
const {getEmailContent} = require("../../utils/helper/email");

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
    
    async hasManageStudiesPermission() {
        const hasPermission = await this.hasAccess("frontend.dashboard.studies.canManageStudies");
        if (!hasPermission) {
            throw new Error("No permission to manage studies");
        }
    }

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
                        "studyClosed",
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
        if (!(await this.checkUserAccess(study.userId))) {
            throw new Error("No permission to close this study");
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
     * Closes studies identified by studyIds.
     *
     * @socketEvent studyCloseBulk
     * @param {object} data
     * @param {number[]} data.studyIds IDs of the studies to close
     * @param {number} [data.projectId] optional project scope for validation
     * @param {boolean} [data.notifySessions] if true, send emails to participants with open sessions
     * @param {string} [data.progressId] optional id for progressUpdate events
     * @returns {Promise<{ closedCount: number }>}
     */
    async closeBulk(data, options) {
        await this.hasManageStudiesPermission();

        const notifySessions = data.notifySessions === true;

        const closedCount = await this.runBulkWithProgress(data.studyIds, data.progressId, async (id, transaction) => {
            await this.models["study"].updateById(
                id,
                { closed: true, userIdClosed: this.userId },
                { transaction }
            );
            transaction.afterCommit(async () => {
                this.broadcastTransactionChanges(transaction);
                if (notifySessions) {
                    try {
                        const updated = await this.models["study"].getById(id);
                        await this.sendStudyClosedEmails(updated);
                    } catch (err) {
                        this.logger.error(`Failed to send study closed emails for study ${id}:`, err);
                    }
                }
            });
        });

        return { closedCount };
    }

    /**
     * Reopens studies identified by studyIds.
     *
     * @socketEvent studyOpenBulk
     * @param {object} data
     * @param {number[]} data.studyIds IDs of the studies to reopen
     * @param {string} [data.progressId] optional id for progressUpdate events
     * @returns {Promise<{ openedCount: number }>}
     */
    async openBulk(data, options) {
        await this.hasManageStudiesPermission();

        const openedCount = await this.runBulkWithProgress(data.studyIds, data.progressId, async (id, transaction) => {
            await this.models["study"].updateById(
                id,
                { closed: null, userIdClosed: null },
                { transaction }
            );
            transaction.afterCommit(() => this.broadcastTransactionChanges(transaction));
        });

        return { openedCount };
    }

    /**
     * Soft-deletes studies identified by studyIds.
     *
     * @socketEvent studyDeleteBulk
     * @param {object} data
     * @param {number[]} data.studyIds IDs of the studies to delete
     * @param {number} [data.projectId] optional project scope for validation
     * @param {string} [data.progressId] optional id for progressUpdate events
     * @returns {Promise<{ deletedCount: number }>}
     */
    async deleteBulk(data, options) {
        await this.hasManageStudiesPermission();

        const deletedCount = await this.runBulkWithProgress(data.studyIds, data.progressId, async (id, transaction) => {
            await this.models["study"].updateById(
                id,
                { deleted: true },
                { transaction }
            );
            transaction.afterCommit(() => this.broadcastTransactionChanges(transaction));
        });

        return { deletedCount };
    }

    async init() {
        this.createSocket("studySaveAsTemplate", this.saveStudyAsTemplate, {}, true);
        this.createSocket("studyCloseBulk", this.closeBulk, {}, false);
        this.createSocket("studyOpenBulk", this.openBulk, {}, false);
        this.createSocket("studyDeleteBulk", this.deleteBulk, {}, false);
        this.createSocket("studyClose", this.closeStudy, {}, true);
    }
}

module.exports = StudySocket;