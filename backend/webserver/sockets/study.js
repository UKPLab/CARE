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
     * Normalizes study id list from bulk-close payload (array may be lost or re-shaped in transit).
     * @param {object} data
     * @returns {number[]}
     */
    static resolveBulkCloseStudyIds(data) {
        let raw = data.studyIds;
        if (Array.isArray(raw) && raw.length > 0) {
            return raw.map((id) => Number(id)).filter((n) => Number.isFinite(n));
        }
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
            raw = Object.values(raw);
            if (Array.isArray(raw) && raw.length > 0) {
                return raw.map((id) => Number(id)).filter((n) => Number.isFinite(n));
            }
        }
        if (typeof data.studyIdsJson === "string" && data.studyIdsJson.trim().length > 0) {
            try {
                const parsed = JSON.parse(data.studyIdsJson);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed.map((id) => Number(id)).filter((n) => Number.isFinite(n));
                }
            } catch (e) {
                // fall through
            }
        }
        return [];
    }

    /**
     * Loads study rows for bulk close when the client sent an explicit id list.
     * @param {number} projectId
     * @param {number[]} resolvedStudyIds
     * @returns {Promise<object[]>}
     */
    async loadStudiesForBulkCloseByIds(projectId, resolvedStudyIds) {
        const studies = [];
        const seen = new Set();
        const pid = Number(projectId);
        for (const rawId of resolvedStudyIds) {
            const id = Number(rawId);
            if (!Number.isFinite(id) || seen.has(id)) {
                continue;
            }
            seen.add(id);
            const s = await this.models['study'].getById(id, {}, false);
            if (!s || s.template || s.deleted) {
                continue;
            }
            if (Number(s.projectId) !== pid) {
                continue;
            }
            studies.push(s);
        }
        return studies;
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
     * Closes studies associated with a given project ID in a loop.
     * Each study is updated in its own database transaction. Progress is reported to the client after each study is processed.
     *
     * @socketEvent studyCloseBulk
     * @param data The data required for the bulk close operation.
     * @param data.projectId the project ID of the studies to close
     * @param data.ignoreClosedState if true, also close studies that are already closed
     * @param data.progressId the ID of the progress bar to update
     * @param data.workflowId optional; when set, only studies with this workflowId are closed
     * @param data.studyUserId optional; when set, only studies with this userId (study owner) are closed
     * @param data.userRoleName optional; when set (e.g. "guest"), only studies whose userId has this role are closed (takes precedence over studyUserId)
     * @param data.studyIds optional; when non-empty, only these study IDs are closed (must belong to projectId, not template, not deleted). Preferred over workflow/user filters so server matches the client preview exactly.
     * @param data.studyIdsJson optional; JSON array string of study ids (used if studyIds is missing after transport, e.g. some socket clients).
     * @param data.bulkCloseUseIdList when true, only the id list is used; missing ids after transport causes an error instead of falling back to closing the whole project.
     * @param options Additional configuration parameters (currently unused).
     * @returns {Promise<{closedCount: number}>} Number of studies that were closed (updated).
     */
    async closeBulk(data, options) {

        const pid = Number(data.projectId);
        if (!Number.isFinite(pid)) {
            throw new Error("Invalid projectId");
        }

        const resolvedStudyIds = StudySocket.resolveBulkCloseStudyIds(data);
        const idListMode = data.bulkCloseUseIdList === true;

        let studies;
        if (idListMode) {
            if (resolvedStudyIds.length === 0) {
                throw new Error(
                    "Bulk close: expected a study id list from the client but none arrived (try refreshing the page)"
                );
            }
            studies = await this.loadStudiesForBulkCloseByIds(pid, resolvedStudyIds);
        } else if (resolvedStudyIds.length > 0) {
            studies = await this.loadStudiesForBulkCloseByIds(pid, resolvedStudyIds);
        } else {
            studies = await this.models['study'].getAllByKey('projectId', pid);
            const wf = data.workflowId;
            if (wf !== undefined && wf !== null && Number(wf) > 0) {
                const workflowId = Number(wf);
                studies = studies.filter((s) => Number(s.workflowId) === workflowId);
            }

            const roleName = typeof data.userRoleName === "string" ? data.userRoleName.trim() : "";
            if (roleName.length > 0) {
                const role = await this.models['user_role'].getByKey('name', roleName);
                if (!role) {
                    throw new Error(`Unknown role: ${roleName}`);
                }
                const matchings = await this.models['user_role_matching'].getAllByKey('userRoleId', role.id);
                const userIds = new Set(matchings.map((m) => Number(m.userId)));
                studies = studies.filter((s) => userIds.has(Number(s.userId)));
            } else {
                const su = data.studyUserId;
                if (su !== undefined && su !== null && Number(su) > 0) {
                    const studyUserId = Number(su);
                    studies = studies.filter((s) => Number(s.userId) === studyUserId);
                }
            }
        }

        let closedCount = 0;
        for (let i = 0; i < studies.length; i++) {
            const study = studies[i];
            if (study.closed) {
                if (!("ignoreClosedState" in data) || !data.ignoreClosedState) {
                    continue;
                }
            }
            const transaction = await this.server.db.sequelize.transaction();

            try {

                await this.models['study'].updateById(study.id, {closed: true, userIdClosed: this.userId}, {transaction: transaction});
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
                closedCount += 1;
            } catch (e) {
                this.logger.error(e);
                await transaction.rollback();
            }

            // update frontend progress
            this.socket.emit("progressUpdate", {
                id: data["progressId"], current: i + 1, total: studies.length,
            });

        }

        return {closedCount};
    }

    async init() {
        this.createSocket("studySaveAsTemplate", this.saveStudyAsTemplate, {}, true);
        this.createSocket("studyCloseBulk", this.closeBulk, {}, false);
        this.createSocket("studyClose", this.closeStudy, {}, true);
    }
}

module.exports = StudySocket;