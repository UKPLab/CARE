const Socket = require("../Socket.js");
const TranslatableError = require("../../utils/TranslatableError");

/**
 * Handle submissions through websocket
 *
 * @author Linyin Huang
 * @type {SubmissionSocket}
 * @class SubmissionSocket
 */
class SubmissionSocket extends Socket {
    /**
     * Assign group to submissions and optionally copy them
     *
     * @param {Object} data - The data object containing submission parameters
     * @param {number} data.group - The group number to be assigned to the submissions
     * @param {boolean} data.isCopied - Indicates whether the submissions should be copied
     * @param {Array<number>} data.submissionIds - Array containing the IDs of the submissions
     * @param {Object} data.additionalSettings - Additional settings for the submissions
     * @param {Object} options - Database options including transaction
     * @returns {Promise<Object>} A promise that resolves with operation results
     * @throws {Error} If the operation fails
     */
    async assignGroupToSubmissions(data, options = {}) {
        const {group, isCopied, submissionIds, additionalSettings} = data;
        const transaction = options.transaction;
        if (isCopied) {
            // Copy submissions after group assignment (copies will inherit the group)
            const copiedResults = [];
            for (const submissionId of submissionIds) {
                try {
                    const copyResult = await this.models["submission"].copySubmission(submissionId, this.userId, {transaction});
                    copiedResults.push(copyResult);
                } catch (error) {
                    throw new TranslatableError(null, "errors.submission.copyWithIdFailed", {submissionId, message: error.message});
                }
            }
            const copiedSubmissionIds = copiedResults.map(({copiedSubmission}) => copiedSubmission.id);
            await this.models["submission"].assignGroup(copiedSubmissionIds, group, additionalSettings, {transaction});
            return {
                success: true,
                copiedSubmissions: copiedResults,
            };
        } else {
            await this.models["submission"].assignGroup(submissionIds, group, additionalSettings, {transaction});
            return {
                success: true,
                submissionsUpdated: submissionIds.length,
            };
        }
    }

    /**
     * Update a submission document
     *
     * @param {Object} data - The data object containing submission parameters
     * @param {number} data.id - The ID of the submission to be updated
     * @param {Object} options - Database options including transaction
     * @returns {Promise<void>} A promise that resolves when the update is complete
     * @throws {Error} If the user is not allowed to update the document
     */
    async updateSubmission(data, options) {
        const submission = await this.models['submission'].getById(data['id']);
        if (!(await this.checkUserAccess(submission.userId))) {
            throw new Error("errors.submission.updateNotAllowed");
        }

        const newSubmission = await this.models['submission'].updateById(submission.id, data);
        options.transaction.afterCommit(async () => {
            this.emit("submissionRefresh", await this.updateCreatorName(newSubmission));
        });
    }

    /**
     * Publishes grades for an assignment to Moodle.
     *
     * @param {Object} data - The data required for uploading assignment grade.
     * @param {Object} data.options - The options object containing the API key and URL of the Moodle instance.
     * @param {Array<Object>} data.grades - An array of objects containing the grade data.
     * @returns {Promise<Object>} - A promise that resolves when the grades have been uploaded.
     * @throws {Error} If the user does not have admin permission.
     * @see MoodleRPC#publishAssignmentGrade
     */
    async publishGrades(data) {
        if (!(await this.isAdmin())) {
            throw new Error("errors.submission.noGradeUploadPermission");
        }
        return await this.server.rpcs["MoodleRPC"].publishAssignmentGrade({
            options: data.options,
            grades: data.grades,
        });
    }

    init() {
        this.createSocket("submissionAssignGroup", this.assignGroupToSubmissions, {}, true);
        this.createSocket("submissionUpdate", this.updateSubmission, {}, true);
        this.createSocket("submissionPublishGrades", this.publishGrades, {}, false);
    }
}

module.exports = SubmissionSocket;
