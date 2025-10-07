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
     * Copy a submission and all its associated documents
     *
     * This method creates a complete copy of a submission including:
     * - The submission record itself (with parentSubmissionId set to original)
     * - All associated documents with their files and metadata
     *
     * @param {Object} data - The data object containing submission copy parameters
     * @param {number} data.submissionId - The ID of the submission to copy
     * @param {Object} options - Database options including transaction
     * @returns {Promise<Object>} A promise that resolves with the copied submission and document
     * @throws {Error} If the submission doesn't exist or copying fails
     */
    static async copy(data, options = {}) {
        const originalSubmissionId = data.submissionId;
        const transaction = options.transaction;

        // 1. Get the original submission
        const originalSubmission = await this.getById(originalSubmissionId);
        if (!originalSubmission) {
            throw new Error(`Submission with id ${originalSubmissionId} not found`);
        }

        // 2. Create the copied submission with parentSubmissionId
        const copiedSubmission = await this.add(
            {
                userId: data.userId,
                createdByUserId: originalSubmission.userId, // TODO: Is this correct?
                projectId: originalSubmission.projectId || null,
                parentSubmissionId: originalSubmissionId, // Link to parent
                extId: null, // TODO: Should extId be copied or reset?
                group: originalSubmission.group || null, // TODO: Should group be copied or reset?
                additionalSettings: originalSubmission.additionalSettings || null,
                validationConfigurationId: originalSubmission.validationConfigurationId || null,
                deleted: false,
            },
            { transaction }
        );

        // 3. Get all documents associated with the original submission
        const originalDocuments = await sequelize.models.document.getAllByKey("submissionId", originalSubmissionId);

        const copiedDocuments = [];

        // 4. Copy every associated document
        for (const originalDoc of originalDocuments) {
            try {
                const copiedDoc = await this.copyDocument(originalDoc, copiedSubmission.id, transaction);
                copiedDocuments.push(copiedDoc);
            } catch (error) {
                throw new Error(`Failed to copy document "${originalDoc.name}" (id: ${originalDoc.id}): ${error.message}`);
            }
        }

        return {
            copiedSubmission,
            copiedDocuments,
            originalSubmissionId,
        };
    }

    init() {
        // TODO: Remove these socket names.
        // this.createSocket("settingGetData", this.sendSettings, {}, false);
        // this.createSocket("settingSave", this.saveSettings, {}, true);
    }
}

module.exports = SubmissionSocket;
