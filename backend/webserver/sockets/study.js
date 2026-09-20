const TranslatableError = require("../../utils/TranslatableError");
const Socket = require("../Socket.js");
const {getEmailContent} = require("../../utils/helper/email");

/** Coordinator and createStudySteps use workflowStepId as `id`. */
function stepDocumentsFromStudySteps(studySteps) {
    return (studySteps || [])
        .filter((step) => step.workflowStepId)
        .map((step) => ({
            id: step.workflowStepId,
            documentId: step.documentId,
            configuration: step.configuration || {},
        }));
}

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
            throw new TranslatableError("errors.studies.noPermissionManageStudies");
        }
    }

    /**
     * Studies a bulk action may touch.
     *
     * Two client shapes: explicit ids (rows ticked in the table) or a query-scoped selection
     * ("select all matching" — the same filter / search the list used, minus rows unticked
     * afterwards). Both are resolved against the viewer's row scope, so `canManageStudies` alone
     * never decides which rows are written: an id outside what the user may list is dropped.
     *
     * @param {Object} data
     * @param {number[]} [data.studyIds] explicitly selected rows
     * @param {Object} [data.selection] query-scoped selection
     * @param {boolean} data.selection.allMatching must be true to use the query path
     * @param {Array} [data.selection.filter] queryTable filter items
     * @param {Object} [data.selection.query] { search, columnFilters, searchColumns }
     * @param {number[]} [data.selection.excludeIds] rows unticked after select-all
     * @returns {Promise<number[]>}
     */
    async resolveBulkStudyIds(data) {
        const selection = data?.selection;
        if (selection && selection.allMatching) {
            return await this.resolveQueryTableIds({
                table: "study",
                filter: selection.filter || [],
                query: selection.query || {},
                excludeIds: selection.excludeIds || [],
            });
        }
        return await this.resolveQueryTableIds({
            table: "study",
            includeIds: Array.isArray(data?.studyIds) ? data.studyIds : [],
        });
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
            const {stepDocuments, study_step, ...templateFields} = data.templateData;
            return await this.models['study'].add({
                ...templateFields,
                userId: this.userId,
                template: true,
            }, {
                transaction: options.transaction,
                context: {
                    stepDocuments: Array.isArray(stepDocuments) && stepDocuments.length
                        ? stepDocuments
                        : stepDocumentsFromStudySteps(study_step),
                }
            });
        } else {
            const currentStudy = await this.models['study'].getById(data['id']);

            if (await this.checkUserAccess(currentStudy.userId)) {
                const studySteps = await this.models['study_step'].getAllByKey("studyId", currentStudy.id);

                const newStudyData = {
                    ...currentStudy,
                    id: undefined,
                    hash: undefined,
                    template: true,
                };
                
                return await this.models['study'].add(newStudyData, {
                    transaction: options.transaction,
                    context: { stepDocuments: stepDocumentsFromStudySteps(studySteps) }
                });
            } else {
                throw new TranslatableError("errors.studies.noPermissionSaveAsTemplate");
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
            throw new TranslatableError("errors.studies.studyIdRequired");
        }

        const study = await this.models["study"].getById(data.studyId, {transaction: options.transaction});
        if (!study) {
            throw new TranslatableError("errors.studies.studyNotFound");
        }
        if (!(await this.checkUserAccess(study.userId))) {
            throw new TranslatableError("errors.studies.noPermissionCloseStudy");
        }

        if (study.closed) {
            throw new TranslatableError("errors.studies.studyAlreadyClosed");
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
     * @param {number[]} [data.studyIds] IDs of the studies to close
     * @param {object} [data.selection] query-scoped selection (see resolveBulkStudyIds)
     * @param {boolean} [data.notifySessions] if true, send emails to participants with open sessions
     * @param {string} [data.progressId] optional id for progressUpdate events
     * @returns {Promise<{ closedCount: number }>}
     */
    async closeBulk(data, options) {
        await this.hasManageStudiesPermission();

        const notifySessions = data.notifySessions === true;
        const studyIds = await this.resolveBulkStudyIds(data);

        // One broadcast for the whole bulk: a query-scoped selection can be the entire table, and
        // a per-row broadcast would fan that out to every connected socket (same as deleteBulk).
        const pendingChanges = [];
        const closedCount = await this.runBulkWithProgress(studyIds, data.progressId, async (id, transaction) => {
            await this.models["study"].updateById(
                id,
                { closed: true, userIdClosed: this.userId },
                { transaction }
            );
            transaction.afterCommit(async () => {
                if (transaction.changes?.length) {
                    pendingChanges.push(...transaction.changes);
                }
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

        if (pendingChanges.length) {
            await this.broadcastTransactionChanges({changes: pendingChanges});
        }

        return { closedCount };
    }

    /**
     * Reopens studies identified by studyIds.
     *
     * @socketEvent studyOpenBulk
     * @param {object} data
     * @param {number[]} [data.studyIds] IDs of the studies to reopen
     * @param {object} [data.selection] query-scoped selection (see resolveBulkStudyIds)
     * @param {string} [data.progressId] optional id for progressUpdate events
     * @returns {Promise<{ openedCount: number }>}
     */
    async openBulk(data, options) {
        await this.hasManageStudiesPermission();

        const studyIds = await this.resolveBulkStudyIds(data);

        const pendingChanges = [];
        const openedCount = await this.runBulkWithProgress(studyIds, data.progressId, async (id, transaction) => {
            await this.models["study"].updateById(
                id,
                { closed: null, userIdClosed: null },
                { transaction }
            );
            transaction.afterCommit(() => {
                if (transaction.changes?.length) {
                    pendingChanges.push(...transaction.changes);
                }
            });
        });

        if (pendingChanges.length) {
            await this.broadcastTransactionChanges({changes: pendingChanges});
        }

        return { openedCount };
    }

    /**
     * Soft-deletes studies identified by studyIds.
     *
     * @socketEvent studyDeleteBulk
     * @param {object} data
     * @param {number[]} [data.studyIds] IDs of the studies to delete
     * @param {object} [data.selection] query-scoped selection (see resolveBulkStudyIds)
     * @param {string} [data.progressId] optional id for progressUpdate events
     * @returns {Promise<{ deletedCount: number }>}
     */
    async deleteBulk(data, options) {
        await this.hasManageStudiesPermission();

        const studyIds = await this.resolveBulkStudyIds(data);

        const pendingChanges = [];
        const deletedCount = await this.runBulkWithProgress(studyIds, data.progressId, async (id, transaction) => {
            await this.models["study"].updateById(
                id,
                {deleted: true},
                {transaction}
            );
            // Collect hooks' changes; broadcast once after the whole bulk
            transaction.afterCommit(() => {
                if (transaction.changes?.length) {
                    pendingChanges.push(...transaction.changes);
                }
            });
        });

        if (pendingChanges.length) {
            await this.broadcastTransactionChanges({changes: pendingChanges});
        }

        return {deletedCount};
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