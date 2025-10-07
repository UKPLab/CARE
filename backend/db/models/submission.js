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

        /**
         * Copy a single document and all its associated data
         * 
         * @param {Object} originalDoc - The original document to copy
         * @param {number} newSubmissionId - The ID of the new submission to associate with
         * @param {Object} transaction - The database transaction
         * @returns {Promise<Object>} The copied document
         */
        static async copyDocument(originalDoc, newSubmissionId, transaction) {

            const copiedDoc = await sequelize.models.document.add({
                name: `${originalDoc.name || 'Untitled'}_submission`,
                type: originalDoc.type,
                userId: originalDoc.userId || null,
                uploadedByUserId: originalDoc.uploadedByUserId || null,
                public: false,
                readyForReview: originalDoc.readyForReview || false,
                parentDocumentId: originalDoc.id, // Link to original document
                hideInFrontend: originalDoc.hideInFrontend || false,
                projectId: originalDoc.projectId || null,
                submissionId: newSubmissionId,
                originalFilename: originalDoc.originalFilename || null
            }, { transaction });

            await this.copyDocumentFiles(originalDoc, copiedDoc, transaction);

            return copiedDoc;
        }

        /**
         * Copy document files and associated data based on document type
         * 
         * @param {Object} originalDoc - The original document
         * @param {Object} copiedDoc - The copied document
         * @param {Object} transaction - The database transaction
         */
        static async copyDocumentFiles(originalDoc, copiedDoc, transaction) {
            const docTypes = sequelize.models.document.docTypes;

            if (originalDoc.type === docTypes.DOC_TYPE_HTML || originalDoc.type === docTypes.DOC_TYPE_MODAL) {
                // Copy the delta file
                const originalFilePath = path.join(UPLOAD_PATH, `${originalDoc.hash}.delta`);
                const newFilePath = path.join(UPLOAD_PATH, `${copiedDoc.hash}.delta`);
                
                if (fs.existsSync(originalFilePath)) {
                    await fs.promises.copyFile(originalFilePath, newFilePath);
                }

                // Copy document edits
                const existingEdits = await sequelize.models.document_edit.findAll({
                    where: { documentId: originalDoc.id },
                    raw: true,
                    transaction
                });

                if (existingEdits.length > 0) {
                    const newEdits = existingEdits.map(edit => ({
                        ...edit,
                        id: undefined,
                        documentId: copiedDoc.id,
                        updatedAt: new Date(),
                        studySessionId: null,
                        studyStepId: null,
                    }));

                    await sequelize.models.document_edit.bulkCreate(newEdits, { transaction });
                    console.log(`Copied ${newEdits.length} edits from document ${originalDoc.id} to copied document ${copiedDoc.id}`);
                } else {
                    console.log(`No edits found for document ${originalDoc.id}, skipping edit copy.`);
                }
            }
            else if ([docTypes.DOC_TYPE_PDF, docTypes.DOC_TYPE_CONFIG, docTypes.DOC_TYPE_ZIP].includes(originalDoc.type)) {
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
                // TODO: IS copying annotations and comments needed here for PDFs?
            }
        }

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
            configurationId: DataTypes.INTEGER,
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
