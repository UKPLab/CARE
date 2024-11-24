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
            {
                key: "readyForReview",
                label: "Is this a document that should be reviewed?",
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
                fs.writeFileSync(path.join(UPLOAD_PATH, `${newDocument.hash}.delta.json`), JSON.stringify({}));
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
        }
    }

    Document.init({
        name: DataTypes.STRING,
        hash: DataTypes.STRING,
        userId: DataTypes.INTEGER,
        public: DataTypes.BOOLEAN,
        readyForReview: DataTypes.BOOLEAN,
        uploaded: DataTypes.BOOLEAN,
        updatedAt: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        type: DataTypes.INTEGER, // 0 is for pdf and 1 is for html
        parentDocumentId: DataTypes.INTEGER,
        hideInFrontend: DataTypes.BOOLEAN
    }, {
        sequelize: sequelize,
        modelName: 'document',
        tableName: 'document', 
        hooks: {
            afterUpdate: async (document, options) => {
                const transaction = options.transaction;
            
                if (document.deleted) {
                    await Document.cascadeDeletionByDocument(document.id, options);
                }
            },
        }
    });
    return Document;
};

module.exports.docTypes = docTypes;