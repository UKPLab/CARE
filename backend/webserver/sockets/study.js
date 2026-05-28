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
     * Resolve studies for bulk study actions.
     * Supports either explicit id list (studyIds/studyIdsJson) or all studies in a project.
     * Excludes deleted/template studies.
     * @param {object} data
     * @returns {Promise<object[]>}
     */
    async getBulkActionStudies(data) {
        const projectId = Number(data.projectId);
        if (!Number.isFinite(projectId)) {
            throw new Error("projectId is required");
        }
        let studies;

        if (data.bulkCloseUseIdList) {
            let idList = Array.isArray(data.studyIds) ? data.studyIds : [];
            if (idList.length === 0 && typeof data.studyIdsJson === "string") {
                try {
                    const parsed = JSON.parse(data.studyIdsJson);
                    if (Array.isArray(parsed)) {
                        idList = parsed;
                    }
                } catch (e) {
                    this.logger.error("bulk study action: invalid studyIdsJson", e);
                }
            }
            const ids = [...new Set(idList.map((id) => Number(id)).filter((n) => Number.isFinite(n)))];
            if (ids.length === 0) {
                return [];
            }
            const fetched = await this.models["study"].getAllByKeyValues("id", ids);
            const byId = new Map(fetched.map((s) => [s.id, s]));
            studies = ids
                .map((id) => byId.get(id))
                .filter(
                    (s) =>
                        s &&
                        Number(s.projectId) === projectId &&
                        !s.deleted &&
                        !s.template,
                );
        } else {
            studies = await this.models["study"].getAllByKey("projectId", projectId);
            studies = studies.filter((study) => !study.deleted && !study.template);
        }
        return studies;
    }

    async assertBulkManagePermission() {
        const hasPermission = await this.hasAccess("frontend.dashboard.studies.closeAllStudies");
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
     * Closes studies for a project in a loop (entire project or an explicit id list from the client).
     * Each close uses its own transaction. Emits progressUpdate after every item (current / total) when data.progressId is set.
     *
     * @socketEvent studyCloseBulk
     * @param data The data required for the bulk close operation.
     * @param data.projectId the project ID of the studies to close
     * @param data.ignoreClosedState if true, also close studies that are already closed
     * @param data.progressId optional id for progressUpdate events
     * @param data.bulkCloseUseIdList if true, only studyIds / studyIdsJson are processed (must belong to projectId; not deleted or template)
     * @param data.studyIds list of study ids when using bulkCloseUseIdList
     * @param data.studyIdsJson JSON array string of ids when using bulkCloseUseIdList
     * @param options Additional configuration parameters (currently unused).
     * @returns {Promise<{ closedCount: number }>} Number of studies successfully closed in this run.
     */
    async closeBulk(data, options) {
        await this.assertBulkManagePermission();

        const ignoreClosedState = data.ignoreClosedState === true;
        const progressId = data.progressId;
        const studies = await this.getBulkActionStudies(data);

        let closedCount = 0;
        const total = studies.length;

        for (let i = 0; i < total; i++) {
            const study = studies[i];
            const skipBecauseClosed = study.closed && !ignoreClosedState;

            if (!skipBecauseClosed) {
                const transaction = await this.server.db.sequelize.transaction();
                try {
                    await this.models["study"].updateById(
                        study.id,
                        { closed: true, userIdClosed: this.userId },
                        { transaction },
                    );
                    const notifySessions = data.notifySessions === true;
                    transaction.afterCommit(async () => {
                        this.broadcastTransactionChanges(transaction);
                        if (notifySessions) {
                            try {
                                const updatedStudy = await this.models["study"].getById(study.id);
                                await this.sendStudyClosedEmails(updatedStudy);
                            } catch (error) {
                                this.logger.error(`Failed to send study closed emails for study ${study.id}:`, error);
                            }
                        }
                    });
                    await transaction.commit();
                    closedCount++;
                } catch (e) {
                    this.logger.error(e);
                    await transaction.rollback();
                }
            }

            if (progressId) {
                this.socket.emit("progressUpdate", {
                    id: progressId,
                    current: i + 1,
                    total,
                });
            }
        }

        return { closedCount };
    }

    /**
     * Reopens studies for a project in a loop (entire project or an explicit id list from the client).
     * @socketEvent studyReopenBulk
     * @param data
     * @returns {Promise<{ reopenedCount: number }>}
     */
    async reopenBulk(data, options) {
        await this.assertBulkManagePermission();

        const progressId = data.progressId;
        const studies = await this.getBulkActionStudies(data);
        let reopenedCount = 0;
        const total = studies.length;

        for (let i = 0; i < total; i++) {
            const study = studies[i];
            if (study.closed) {
                const transaction = await this.server.db.sequelize.transaction();
                try {
                    await this.models["study"].updateById(
                        study.id,
                        { closed: null, userIdClosed: null },
                        { transaction },
                    );
                    transaction.afterCommit(async () => {
                        this.broadcastTransactionChanges(transaction);
                    });
                    await transaction.commit();
                    reopenedCount++;
                } catch (e) {
                    this.logger.error(e);
                    await transaction.rollback();
                }
            }

            if (progressId) {
                this.socket.emit("progressUpdate", {
                    id: progressId,
                    current: i + 1,
                    total,
                });
            }
        }
        return { reopenedCount };
    }

    /**
     * Soft-deletes studies for a project in a loop (entire project or an explicit id list from the client).
     * @socketEvent studyDeleteBulk
     * @param data
     * @returns {Promise<{ deletedCount: number }>}
     */
    async deleteBulk(data, options) {
        await this.assertBulkManagePermission();

        const progressId = data.progressId;
        const studies = await this.getBulkActionStudies(data);
        let deletedCount = 0;
        const total = studies.length;

        for (let i = 0; i < total; i++) {
            const study = studies[i];
            const transaction = await this.server.db.sequelize.transaction();
            try {
                await this.models["study"].updateById(
                    study.id,
                    { deleted: true },
                    { transaction },
                );
                transaction.afterCommit(async () => {
                    this.broadcastTransactionChanges(transaction);
                });
                await transaction.commit();
                deletedCount++;
            } catch (e) {
                this.logger.error(e);
                await transaction.rollback();
            }

            if (progressId) {
                this.socket.emit("progressUpdate", {
                    id: progressId,
                    current: i + 1,
                    total,
                });
            }
        }
        return { deletedCount };
    }

    async init() {
        this.createSocket("studySaveAsTemplate", this.saveStudyAsTemplate, {}, true);
        this.createSocket("studyCloseBulk", this.closeBulk, {}, false);
        this.createSocket("studyReopenBulk", this.reopenBulk, {}, false);
        this.createSocket("studyDeleteBulk", this.deleteBulk, {}, false);
        this.createSocket("studyClose", this.closeStudy, {}, true);
    }
}

module.exports = StudySocket;