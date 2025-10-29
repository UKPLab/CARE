"use strict";
const MetaModel = require("../MetaModel.js");
const {Op} = require("sequelize");
const fs = require("fs");
const path = require("path");

const UPLOAD_PATH = `${__dirname}/../../../files`;

module.exports = (sequelize, DataTypes) => {
    class Submission extends MetaModel {
        static autoTable = true;

        static fields = [];

        static associate(models) {
            Submission.hasMany(models["document"], {
                foreignKey: "submissionId",
                as: "documents",
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
                    extId: { [Op.in]: extIds },
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
                where: { id: { [Op.in]: submissionIds } },
                transaction: options.transaction
            });

            return affectedCount;
        }

        /**
         * Copy a submission and all its associated documents
         * 
         * @param {number} originalSubmissionId - The ID of the submission to copy
         * @param {number} createdByUserId - The ID of the user creating the copy
         * @param {Object} options - Database options including transaction
         * @returns {Promise<Object>} Object containing copied submission and documents
         */
        static async copySubmission(originalSubmissionId, createdByUserId, options = {}) {
            const transaction = options.transaction;

            // Get the original submission
            const originalSubmission = await Submission.findByPk(originalSubmissionId, {
                transaction
            });

            if (!originalSubmission) {
                throw new Error(`Submission with id ${originalSubmissionId} not found`);
            }

            // Create the copied submission with parentSubmissionId
            const copiedSubmission = await Submission.add(
                {
                    userId: originalSubmission.userId,
                    createdByUserId: createdByUserId,
                    projectId: originalSubmission.projectId || null,
                    parentSubmissionId: originalSubmissionId, // Link to parent
                    extId: originalSubmission.extId || null, 
                    group: originalSubmission.group,
                    additionalSettings: originalSubmission.additionalSettings || null,
                    validationConfigurationId: originalSubmission.validationConfigurationId || null,
                    deleted: false,
                },
                { transaction }
            );

            // Get all documents associated with the original submission
            const originalDocuments = await sequelize.models.document.findAll({
                where: { submissionId: originalSubmissionId },
                transaction
            });

            // Copy every associated document
            const copiedDocuments = [];
            for (const originalDoc of originalDocuments) {
                try {
                    const copiedDoc = await Submission.copyDocument(
                        originalDoc, 
                        copiedSubmission.id, 
                        transaction
                    );
                    copiedDocuments.push(copiedDoc);
                } catch (error) {
                    throw new Error(
                        `Failed to copy document with id ${originalDoc.id}): ${error.message}`
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
         * Copy a single document associated with a particular submissionId
         * 
         * @param {Object} originalDoc - The original document to copy
         * @param {number} newSubmissionId - The ID of the new submission to associate with
         * @param {Object} transaction - The database transaction
         * @returns {Promise<Object>} The copied document
         */
        static async copyDocument(originalDoc, newSubmissionId, transaction) {
            const copiedDoc = await sequelize.models.document.add({
                name: `${originalDoc.name}_copy`,
                userId: originalDoc.userId,
                readyForReview: originalDoc.readyForReview || false,
                public: originalDoc.public || false,
                type: originalDoc.type,
                parentDocumentId: originalDoc.id, // Link to original document
                uploadedByUserId: originalDoc.uploadedByUserId || null,
                hideInFrontend: originalDoc.hideInFrontend || false,
                projectId: originalDoc.projectId || null,
                submissionId: newSubmissionId,
                originalFilename: originalDoc.originalFilename || null
            }, { transaction });

            await Submission.copyDocumentFiles(originalDoc, copiedDoc, transaction);

            return copiedDoc;
        }

        /**
         * Copy document files
         * 
         * @param {Object} originalDoc - The original document
         * @param {Object} copiedDoc - The copied document
         * @param {Object} transaction - The database transaction
         */
        static async copyDocumentFiles(originalDoc, copiedDoc, transaction) {
            const docTypes = sequelize.models.document.docTypes;
            if ([docTypes.DOC_TYPE_PDF, docTypes.DOC_TYPE_ZIP].includes(originalDoc.type)) {
                const docType = originalDoc.type;
                const docTypeKey = Object.keys(docTypes)
                    .find(type => docTypes[type] === docType);

                let fileExtension = '';
                if (docTypeKey) {
                    fileExtension = '.' + docTypeKey.replace('DOC_TYPE_', '').toLowerCase();
                }
                
                const originalFilePath = path.join(UPLOAD_PATH, `${originalDoc.hash}${fileExtension}`);
                const copiedFilePath = path.join(UPLOAD_PATH, `${copiedDoc.hash}${fileExtension}`);
                
                if (fs.existsSync(originalFilePath)) {
                    await fs.promises.copyFile(originalFilePath, copiedFilePath);
                }
            }
        }
    }

    Submission.init(
        {
            userId: DataTypes.INTEGER,
            createdByUserId: DataTypes.INTEGER,
            projectId: DataTypes.INTEGER,
            parentSubmissionId: DataTypes.INTEGER,
            extId: DataTypes.INTEGER,
            group: DataTypes.INTEGER,
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
        }
    );

    return Submission;
};
