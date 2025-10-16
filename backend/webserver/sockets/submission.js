const Socket = require("../Socket.js");

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
        const { group, isCopied, submissionIds, additionalSettings } = data;
        const transaction = options.transaction;

        await this.models["submission"].assignGroup(submissionIds, group, additionalSettings, { transaction });

        if (isCopied) {
            // Copy submissions after group assignment (copies will inherit the group)
            const copiedResults = [];
            for (const submissionId of submissionIds) {
                try {
                    const copyResult = await this.models["submission"].copySubmission(submissionId, this.userId, { transaction });
                    copiedResults.push(copyResult);
                } catch (error) {
                    throw new Error(`Failed to copy submission with ${submissionId}: ${error.message}`);
                }
            }
            return {
                success: true,
                copiedSubmissions: copiedResults,
                originalSubmissionsUpdated: submissionIds.length,
                copiedSubmissionsCreated: copiedResults.length,
            };
        } else {
            return {
                success: true,
                submissionsUpdated: submissionIds.length,
            };
        }
    }

    init() {
        this.createSocket("submissionAssignGroup", this.assignGroupToSubmissions, {}, true);
    }
}

module.exports = SubmissionSocket;
