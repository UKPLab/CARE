'use strict';
const MetaModel = require("../MetaModel.js");
const path = require("path");
const fs = require('fs')
const UPLOAD_PATH = `${__dirname}/../../../files`;


const docTypes = Object.freeze({
    DOC_TYPE_PDF: 0,
    DOC_TYPE_HTML: 1,
    DOC_TYPE_MODAL: 2,
});

module.exports = (sequelize, DataTypes) => {
    class Document extends MetaModel {
        static docTypes = docTypes;

        static autoTable = true;

        static fields = [
            {
                key: "name",
                label: "Name of the document:",
                placeholder: "My document",
                type: "text",
                required: true,
                default: "",
            },
            {
                key: "hash",
                label: "Hash ID of the document",
                placeholder: "#",
                type: "text",
                required: false,
                default: "",
            },
            {
                key: "userId",
                label: "User ID of the document",
                placeholder: "#",
                type: "text",
                required: false,
                default: "",
            },
            {
                key: "public",
                label: "Is the document published?",
                type: "switch",
                required: false,
                default: false
            },
        ]

        /**
         * Add a new document (and create a delta file for HTML documents)
         * @param data
         * @param options
         * @returns {Promise<Object|undefined>}
         */
        static async add(data, options = {}) {
            const newDocument = await super.add(data, options);

            // Create a new delta file on disk for HTML documents
            if (newDocument.type === this.docTypes.DOC_TYPE_HTML) {
                fs.writeFileSync(path.join(UPLOAD_PATH, `${newDocument.hash}.delta`), JSON.stringify({}));
            }
            // TODO: what if transaction failes? --> need to delete the file again

            return newDocument;
        }

        /**
         * Cascade delete study steps and sessions for a document.
         * Deletes all study steps with the given documentId and related study sessions.
         * @param {number} documentId
         * @param {Object} options
         * @returns {Promise<void>}
         */
        static async cascadeDeletionByDocument(documentId, options) {
            const transaction = options.transaction;

            const studySteps = await sequelize.models.study_step.getStudyStepsByDocumentId(documentId);

            for (const step of studySteps) {
                const studyId = step.studyId;

                // Delete the study using this documentId and all corresponding sessions and study_steps for the studyId
                const study = await sequelize.models.study.findByPk(studyId, { transaction });
                if (study) {
                    await sequelize.models.study.deleteById(study.id, { transaction });
                    await await sequelize.models.study.deleteStudySessions(study, options);
                    await await sequelize.models.study.deleteStudySteps(study, options);
                }
            }
        }

        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
            Document.belongsTo(models["document"], {
                foreignKey: 'parentDocumentId',
                as: 'parentDocument',
            });

            Document.belongsTo(models["project"], {
                foreignKey: 'projectId',
                as: 'project',
            });
        }

        /**
         * Retrieve documents that are ready for review
         * @returns {Promise<Array<Object>>} An array of objects. Each contains a document's info such as name, hash, etc.
         */
        static async getReviewDocuments() {
            try {
                // Get documents that are ready for review
                const reviewReadyDocuments = await Document.findAll({
                    where: {
                        readyForReview: true,
                        uploadedByUserId: true,
                        deleted: false,
                    },
                    attributes: ["id", "name", "type", "userId", "hash", "createdAt"],
                    raw: true,
                });

                // Process each document to get additional information
                const processedDocuments = await Promise.all(
                    reviewReadyDocuments.map(async (doc) => {
                        // Find associated studyIds for this document
                        const associatedStudies = await this.sequelize.models["study_step"].findAll({
                            where: {documentId: doc.id},
                            attributes: ["studyId"],
                            raw: true,
                        });

                        const studyIds = associatedStudies.map((study) => study.studyId);

                        // Count the number of study sessions for these studyIds
                        const sessionCount = await this.sequelize.models["study_session"].count({
                            where: {studyId: studyIds},
                        });

                        // Get the document owner's information
                        const owner = await this.sequelize.models["user"].findOne({
                            where: {id: doc.userId},
                            attributes: ["firstName", "lastName"],
                            raw: true,
                        });

                        return {
                            ...doc,
                            sessionCount,
                            firstName: owner.firstName,
                            lastName: owner.lastName,
                        };
                    })
                );
                return processedDocuments;
            } catch (error) {
                this.logger.error("Error in getReviewDocuments:", error);
            }
        }
    }

    Document.init({
        name: DataTypes.STRING,
        hash: DataTypes.STRING,
        userId: DataTypes.INTEGER,
        public: DataTypes.BOOLEAN,
        readyForReview: DataTypes.BOOLEAN,
        uploadedByUserId: DataTypes.BOOLEAN,
        updatedAt: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        type: DataTypes.INTEGER, // 0 is for pdf and 1 is for html
        parentDocumentId: DataTypes.INTEGER,
        hideInFrontend: DataTypes.BOOLEAN,
        projectId: DataTypes.INTEGER,
    }, {
        sequelize: sequelize,
        modelName: 'document',
        tableName: 'document',
        hooks: {
            afterUpdate: async (document, options) => {
                // If the document is deleted, we should also delete the associated db columns
                if (document.deleted && !document._previousDataValues.deleted) {
                    // delete associated studies
                    const studies = await sequelize.models.study_step.getAllByKey("documentId", document.id);
                    const uniqueStudyIds = [...new Set(studies.map(study => study.studyId))];
                    for (const studyId of uniqueStudyIds) {
                        await sequelize.models["study"].deleteById(studyId);
                    }

                    // delete associated annotations and comments
                    if (document.type === Document.docTypes.DOC_TYPE_HTML) {
                        // get document edits
                        const documentEdits = await sequelize.models.document_edit.getAllByKey("documentId", document.id);
                        const uniqueDocumentEditIds = [...new Set(documentEdits.map(documentEdit => documentEdit.id))];
                        for (const documentEditId of uniqueDocumentEditIds) {
                            await sequelize.models["document_edit"].deleteById(documentEditId);
                        }

                    } else if (document.type === Document.docTypes.DOC_TYPE_PDF) {
                        // get unique annotations and comments ids
                        const annotations = await sequelize.models.annotation.getAllByKey("documentId", document.id);
                        const uniqueAnnotationIds = [...new Set(annotations.map(annotation => annotation.id))];
                        for (const annotationId of uniqueAnnotationIds) {
                            await sequelize.models["annotation"].deleteById(annotationId);
                        }

                        const comments = await sequelize.models["comment"].getAllByKey("documentId", document.id);
                        const uniqueCommentIds = [...new Set(comments.map(comment => comment.id))];
                        for (const commentId of uniqueCommentIds) {
                            await sequelize.models["comment"].deleteById(commentId);
                        }

                    }
                }
            }
        }
    });
    return Document;
};

module.exports.docTypes = docTypes;