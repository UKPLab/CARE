"use strict";
const MetaModel = require("../MetaModel.js");
const {Op} = require("sequelize");
const fs = require("fs");
const path = require("path");

const UPLOAD_PATH = `${__dirname}/../../../files`;

module.exports = (sequelize, DataTypes) => {
    class Submission extends MetaModel {
        static autoTable = true;
        static accessMap = [
			{
				right: "frontend.dashboard.assignments.admin.view",
				columns: this.getAttributes(),
			},
		];

        static fields = [];

        static associate(models) {
            Submission.hasMany(models["document"], {
                foreignKey: "submissionId",
                as: "documents",
            });

            Submission.belongsTo(models["assignment"], {
                foreignKey: "assignmentId",
                as: "assignment",
            });

            Submission.belongsTo(models["submission"], {
                foreignKey: "parentSubmissionId",
                as: "parentSubmission",
            });
        }

        /**
         * Filter and return existing extIds from a given list
         * @param {number[]} extIds a list of external ids to check
         * @returns {Promise<array>} a list of extIds
         */
        static async filterExistingExtIds(extIds) {
            return await Submission.findAll({
                where: {
                    extId: {[Op.in]: extIds},
                    deleted: false,
                },
                attributes: ["extId"],
                raw: true,
            });
        }

        /**
         * Assign group and additional settings to multiple submissions
         *
         * @param {Array<number>} submissionIds - Array of submission IDs to update
         * @param {number} group - The group number to assign
         * @param {Object} additionalSettings - Additional settings to assign
         * @param {Object} options - Database options including transaction
         * @returns {Promise<number>} Number of affected rows
         */
        static async assignGroup(submissionIds, group, additionalSettings, options = {}) {
            const updateData = {};

            if (group !== undefined && group !== null) {
                updateData.group = group;
            }

            if (additionalSettings !== undefined && additionalSettings !== null) {
                updateData.additionalSettings = additionalSettings;
            }

            const [affectedCount] = await Submission.update(updateData, {
                where: {id: {[Op.in]: submissionIds}},
                transaction: options.transaction,
                individualHooks: true
            });

            return affectedCount;
        }
        /**
         * Get the most recent submission for a user and project, traversing back through parent submissions
         * 
         * @param {number} userId Id of the user
         * @param {number} projectId Id of the project
         * @param {boolean} root Whether to return the root submission
         * @param {Object} transaction Database transaction object
         * @returns {Object|null} The most recent submission or null if none found
         */
        static async getParentSubmission(userId, projectId, returnRoot, transaction = {}) {
            let submission = await Submission.findOne({
                where: {
                    userId,
                    projectId,
                    deleted: false,
                },
                order: [['createdAt', 'DESC']],
                raw: true
            });
            if(returnRoot && submission && submission.parentSubmissionId) {
                 submission = await this.getRootSubmission(submission);
            }
            return submission ? submission : null;
        }

        /** 
         * Get the root submission from a given submission by traversing back through parent submissions 
         * 
         * @param {Object} submission The starting submission object
         * @returns {Object} The root submission object
         */
        static async getRootSubmission(submission) {
            let currentSubmission = submission;
            while (currentSubmission.parentSubmissionId) {
                currentSubmission = await Submission.findOne({
                    where: {
                        id: currentSubmission.parentSubmissionId,
                        deleted: false,
                    },
                    raw: true,
                });
            }
            return currentSubmission ? currentSubmission : null;
        }

        /**
         * Copy a submission and all its associated documents
         *
         * @param {number} originalSubmissionId - The ID of the submission to copy
         * @param {number} createdByUserId - The ID of the user creating the copy
         * @param {Object} submissionOverrides - Overrides for the submission (e.g., hideInFrontend)
         * @param {Object} documentOverrides - Overrides for documents (e.g., studySessionId, studyStepId)
         * @param {Object} filters - Additional filters for document duplication (eg: {studySessionId: 1}) in case we require certain extra files
         * @param {Object} options - Database options including transaction
         * @returns {Promise<Object>} Object containing copied submission and documents
         */
        static async copySubmission(originalSubmissionId, createdByUserId, submissionOverrides = {}, documentOverrides = {}, filters= {}, options = {}) {

            // Get the original submission
            const originalSubmission = await Submission.findByPk(originalSubmissionId, {
                transaction: options.transaction
            });

            if (!originalSubmission) {
                throw new Error(`Submission with id ${originalSubmissionId} not found`);
            }

            // Create the copied submission with parentSubmissionId and apply submission overrides
            const copiedSubmission = await Submission.add(
                {
                    userId: originalSubmission.userId,
                    createdByUserId: createdByUserId,
                    projectId: originalSubmission.projectId || null,
                    assignmentId: originalSubmission.assignmentId || null,
                    parentSubmissionId: originalSubmissionId, // Link to parent
                    extId: originalSubmission.extId || null,
                    group: originalSubmission.group,
                    additionalSettings: originalSubmission.additionalSettings || null,
                    validationConfigurationId: originalSubmission.validationConfigurationId || null,
                    deleted: false,
                    ...submissionOverrides, // Apply submission-specific overrides (e.g., hideInFrontend)
                },
                {transaction: options.transaction}
            );

            // Get all documents associated with the original submission
            const originalDocuments = await sequelize.models.document.findAll({
                where: {submissionId: originalSubmissionId},
                transaction: options.transaction
            });

            // Copy every associated document and track mapping
            const copiedDocuments = [];
            
            for (const originalDoc of originalDocuments) {
                try {
                    // Merge submissionId with document overrides (studySessionId, studyStepId, etc.)
                    const mergedDocumentOverrides = {
                        ...documentOverrides,
                        submissionId: copiedSubmission.id,
                    };
                    
                    const copiedDoc = await sequelize.models.document.duplicateDocument(
                        originalDoc.id,
                        mergedDocumentOverrides,
                        filters,
                        options
                    );
                    copiedDocuments.push(copiedDoc);
                } catch (error) {
                    throw new Error(
                        `Failed to copy document with id ${originalDoc.id}: ${error.message}`
                    );
                }
            }

            return {
                copiedSubmission,
                copiedDocuments,
                originalSubmissionId,
            };
        }
        /**
         * Load all documents for a submission and convert them to base64.
         *
         * @param {string|number} submissionId - The ID of the submission.
         * @returns {Promise<object>} An object with document types as keys and base64 file contents as values.
         * @throws {Error} If no submissionId is provided or no valid files are found.
         */
        static async loadSubmissionForNlpRequest(submissionId) {

            const originalDocuments = await sequelize.models.document.findAll({
                where: {submissionId},
                raw: true,
            });

            const submissionFiles = {};

            await Promise.all(
                originalDocuments.map(async (doc) => {
                    const base64 = await sequelize.models.document.encodeDocumentFileToBase64(doc);
                    if (!base64) return;

                    const docTypeKey = Object.entries(sequelize.models.document.docTypes).find(
                        ([, value]) => value === doc.type
                    )?.[0];

                    if (!docTypeKey) return;

                    const fileTypeKey = docTypeKey.replace(/^DOC_TYPE_/, '').toLowerCase();
                    submissionFiles[fileTypeKey] = base64;
                })
            );

            if (Object.keys(submissionFiles).length === 0) {
                throw new Error(`No valid files found for submission ${submissionId}`);
            }

            return submissionFiles;
        }
    }

    Submission.init(
        {
            userId: DataTypes.INTEGER,
            createdByUserId: DataTypes.INTEGER,
            projectId: DataTypes.INTEGER,
            assignmentId: DataTypes.INTEGER,
            parentSubmissionId: DataTypes.INTEGER,
            previousSubmissionId: DataTypes.INTEGER,
            extId: DataTypes.INTEGER,
            additionalSettings: DataTypes.JSONB,
            validationConfigurationId: DataTypes.INTEGER,
            deleted: DataTypes.BOOLEAN,
            deletedAt: DataTypes.DATE,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        {
            sequelize,
            modelName: "submission",
            tableName: "submission",
            hooks: {
                afterUpdate: async (submission, options) => {
                    // If the document is deleted, we should also delete the associated db columns
                    if (submission.deleted && !submission._previousDataValues.deleted) {
                        // delete associated studies
                        const documents = await sequelize.models.document.getAllByKey("submissionId", submission.id);

                        for (const document of documents) {
                            await sequelize.models["document"].deleteById(document.id);
                        }
                    }
                }
            },
        }
    );

    return Submission;
};
