'use strict';
const MetaModel = require("../MetaModel.js");
const path = require("path");
const {promises: fs} = require("fs");
const {applyTemplateToDocument} = require("../../utils/helper/documentTemplate.js");
const TranslatableError = require("../../utils/TranslatableError");
const UPLOAD_PATH = `${__dirname}/../../../files`;

const stepTypes = Object.freeze({
    STEP_TYPE_ANNOTATOR: 1,
    STEP_TYPE_EDITOR: 2,
    STEP_TYPE_MODAL: 3,
});


module.exports = (sequelize, DataTypes) => {
    class StudyStep extends MetaModel {
        static autoTable = true;
        static stepTypes = stepTypes;
        static accessMap = [
            {
                right: "frontend.dashboard.studies.fullAccess",
                columns: StudyStep.getAttributes()
            },
            {
                table: "study",
                by: "id",
                target: "studyId",
                columns: this.getAttributes()
            }
        ];
        static fields = [
            {
                key: "documentId",
                label: "dashboard.documents.fields.selectDoc",
                type: "select",
                options: {
                    table: "document",
                    name: "name",
                    value: "id",
                    filter: [
                        {key: "hideInFrontend", value: false},
                        {
                            type: "parentData", key: "type", value: "stepType",
                            mapping: {
                                [sequelize.models.document.docTypes.DOC_TYPE_PDF]: stepTypes.STEP_TYPE_ANNOTATOR,
                                [sequelize.models.document.docTypes.DOC_TYPE_HTML]: stepTypes.STEP_TYPE_EDITOR,
                                [sequelize.models.document.docTypes.DOC_TYPE_MODAL]: stepTypes.STEP_TYPE_MODAL,
                            }
                        },
                        {type:"byUserId", key: "userId"},
                        {type:"byProjectId", key: "projectId"}
                    ],
                    additionalOptions: [
                        {
                            type: sequelize.models.document.docTypes.DOC_TYPE_HTML,
                            name: "dashboard.documents.fields.newEmptyDoc",
                            value: null
                        }
                    ]
                },
                required: true,
            },
        ];

        /**
         * Get the first step of a study
         * @param studyId
         * @returns {Promise<StudyStep>}
         */
        static async getFirstStep(studyId, options) {
            const firstStep = await this.findOne({
                where: {
                    studyId: studyId,
                    studyStepPrevious: null,
                    deleted: false,
                }, ...options,
            });
            if (!firstStep) {
                throw new TranslatableError("errors.studies.studyStep.notFound");
            } else {
                return firstStep;
            }

        }

        /**
         * Get all study steps associated with a specific document.
         * @param {number} documentId - The document ID to find associated study steps.
         * @returns {Promise<Array>} - List of associated study steps.
         */
        static async getStudyStepsByDocumentId(documentId) {
            return await this.findAll({where: {documentId}});
        }

        /**
         * Adding a new study step
         * @param data
         * @param options - there must be a context object with the study object
         * @returns {Promise<Object|undefined>}
         */
        static async add(data, options = {}) {
            if ((data.stepType === StudyStep.stepTypes.STEP_TYPE_EDITOR || data.stepType === StudyStep.stepTypes.STEP_TYPE_MODAL) && (!options.doNotDuplicate && data.documentId === null ) ) {
                const study = options.context;

                const expectedDocType = data.stepType === StudyStep.stepTypes.STEP_TYPE_EDITOR
                    ? sequelize.models.document.docTypes.DOC_TYPE_HTML
                    : sequelize.models.document.docTypes.DOC_TYPE_MODAL;

                if (data.documentId === null) { // Create a new document

                    const newDocument = await sequelize.models.document.add({
                        name: `Document Study ${study.id}`,
                        type: expectedDocType,
                        userId: study.userId,
                        hideInFrontend: true
                    }, {transaction: options.transaction});

                    let documentCopied = false;

                    if (data.workflowStepId) {
                        const workflowStep = await sequelize.models.workflow_step.getById(data.workflowStepId, {transaction: options.transaction});

                        if (workflowStep && workflowStep.workflowStepDocument) {

                            // Fetch the original workflow step entry referenced by workflowStep.workflowStepDocument
                            const originalEntry = await sequelize.models.workflow_step.getById(workflowStep.workflowStepDocument, {transaction: options.transaction});
                            if (originalEntry && originalEntry.stepType === StudyStep.stepTypes.STEP_TYPE_EDITOR) {

                                const referencedStudyStep = await sequelize.models.study_step.findOne({
                                    where: {
                                        workflowStepId: originalEntry.id,
                                        studyId: study.id,
                                        deleted: false
                                    },
                                    transaction: options.transaction
                                })

                                if (!referencedStudyStep) {
                                    throw new TranslatableError("errors.studies.studyStep.referencedStepNotFound", {originalEntryId: originalEntry.id});
                                }

                                const referencedDocument = await sequelize.models.document.getById(
                                    referencedStudyStep.dataValues.documentId,
                                    {transaction: options.transaction});

                                if (!referencedDocument) {
                                    throw new TranslatableError("errors.studies.studyStep.referencedDocumentNotFound", {referencedStudyStepId: referencedStudyStep.id});
                                }

                                // Copy the delta file from the referenced document to the new document
                                const originalFilePath = path.join(UPLOAD_PATH, `${referencedDocument.hash}.delta`);
                                const newFilePath = path.join(UPLOAD_PATH, `${newDocument.hash}.delta`);
                                await fs.copyFile(originalFilePath, newFilePath);

                                const existingEdits = await sequelize.models.document_edit.findAll({
                                    where: {
                                        documentId: referencedDocument.id,
                                        deleted: false
                                    },
                                    raw: true,
                                    transaction: options.transaction
                                });

                                if (existingEdits.length > 0) {
                                    const newEdits = existingEdits.map(edit => ({
                                        ...edit,
                                        id: undefined,
                                        documentId: newDocument.id,
                                        createdAt: new Date(),
                                        updatedAt: new Date()
                                    }));

                                    await sequelize.models.document_edit.bulkCreate(newEdits, {transaction: options.transaction});
                                }

                                documentCopied = true;
                            }
                        }
                    }

                    // Resolve Type 5 template at study creation time (per-step template selection)
                    const configuredTemplateId = data.configuration && data.configuration.documentTemplateId
                        ? data.configuration.documentTemplateId
                        : null;

                    if (!documentCopied && configuredTemplateId) {
                        await applyTemplateToDocument(
                            newDocument,
                            configuredTemplateId,
                            sequelize.models,
                            {transaction: options.transaction}
                        );
                    }

                    data.documentId = newDocument.id;

                } else {
                    const document = await sequelize.models.document.getById(data.documentId, {transaction: options.transaction});

                    // Check if document exists!
                    if (!document) {
                        throw new TranslatableError("errors.studies.studyStep.documentNotFoundExact", {
                            dataDocumentId: data.documentId,
                            dataWorkflowStepId: data.workflowStepId,
                        });
                    }
                    // Check document mismatch
                    if (document.type !== expectedDocType) {
                        throw new TranslatableError("errors.studies.studyStep.documentTypeMismatch", {
                            dataWorkflowStepId: data.workflowStepId,
                            documentType: document.type,
                        });
                    }

                    const newDocument = await sequelize.models.document.add({
                        name: `${document.name}_study`,
                        type: document.type,
                        userId: study.userId,
                        parentDocumentId: document.id,
                        hideInFrontend: true
                    }, {transaction: options.transaction});

                    const originalFilePath = path.join(UPLOAD_PATH, `${document.hash}.delta`);
                    const newFilePath = path.join(UPLOAD_PATH, `${newDocument.hash}.delta`);

                    await fs.copyFile(originalFilePath, newFilePath);

                    // Copy data from `document_edit` table
                    const existingEdits = await sequelize.models.document_edit.findAll({
                        where: {documentId: document.id},
                        raw: true
                    });

                    if (existingEdits.length > 0) {
                        const newEdits = existingEdits.map(edit => ({
                            ...edit,
                            id: undefined,
                            documentId: newDocument.id,
                            updatedAt: new Date(),
                            studySessionId: null,
                            studyStepId: null,
                        }));

                        await sequelize.models.document_edit.bulkCreate(newEdits, {transaction: options.transaction});
                        console.log(`Copied ${newEdits.length} edits from document ${document.id} to new study document ${newDocument.id}`);
                    } else {
                        console.log(`No edits found for document ${document.id}, skipping edit copy.`);
                    }

                    data.documentId = newDocument.id;
                }
            }
            return await super.add(data, options);
        }

                /**
         * Recalculate and persist how many studies use a given document.
         *
         * @param {number} documentId - The document ID to recalculate usage for.
         * @param {object} options - Optional sequelize options with transaction.
         * @returns {Promise<number>} The recalculated study usage count.
         */
        static async updateDocumentStudyUsageCount(documentId, options = {}) {
            if (!documentId) {
                return 0;
            }

            const transaction = options.transaction;
            const count = await sequelize.models.study_step.count({
                distinct: true,
                col: "studyId",
                where: {
                    documentId,
                    deleted: false,
                },
                include: [{
                    model: sequelize.models.study,
                    as: "study",
                    attributes: [],
                    where: { deleted: false },
                    required: true,
                }],
                transaction,
            });

            await sequelize.models.document.updateById(documentId, { studyUsageCount: count }, { transaction });
            return count;
        }


        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
            StudyStep.belongsTo(models["study"], {
                foreignKey: "studyId",
                as: "study",
            });

            StudyStep.belongsTo(models["workflow_step"], {
                foreignKey: "workflowStepId",
                as: "workflowStep",
            });

            StudyStep.belongsTo(models["document"], {
                foreignKey: "documentId",
                as: "document",
            });

            StudyStep.belongsTo(models["study_step"], {
                foreignKey: "studyStepPrevious",
                as: "previousStep",
            });

            StudyStep.belongsTo(models["study_step"], {
                foreignKey: "studyStepDocument",
                as: "stepDocument",
            });
        }
    }

    StudyStep.init({
            studyId: DataTypes.INTEGER,
            stepNumber: DataTypes.INTEGER,
            workflowStepId: DataTypes.INTEGER,
            stepType: DataTypes.INTEGER,
            documentId: DataTypes.INTEGER,
            studyStepPrevious: DataTypes.INTEGER,
            studyStepDocument: DataTypes.INTEGER,
            allowBackward: DataTypes.BOOLEAN,
            configuration: DataTypes.JSONB,
            deleted: DataTypes.BOOLEAN,
            deletedAt: DataTypes.DATE,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE
        }, {
            sequelize,
            modelName: 'study_step',
            tableName: 'study_step',
            hooks: {
                afterUpdate: async (studyStep, options) => {
                    // cascade deletion for documents created during study creation
                    //Note: can't not just delete the document, because it could be used in other studies!
                    /*if (studyStep._previousDataValues.deleted === false && studyStep.deleted === true) {
                        if (studyStep.stepType === StudyStep.stepTypes.STEP_TYPE_EDITOR) { // only for html documents that we created
                            const document = await sequelize.models.document.getById(studyStep.documentId);
                            if (document) {
                                await sequelize.models.document.deleteById(document.id, {transaction: options.transaction});
                            }
                        }
                    }*/
                   if(studyStep.deleted) {
                       await StudyStep.updateDocumentStudyUsageCount(studyStep.documentId, {transaction: options.transaction});
                   }

                },
                afterCreate: async (studyStep, options) => {
                    // if a new step is created with a document, we need to update the study usage count for this document
                    await StudyStep.updateDocumentStudyUsageCount(studyStep.documentId, {transaction: options.transaction});
                }
            }
        }
    );

    return StudyStep;
};