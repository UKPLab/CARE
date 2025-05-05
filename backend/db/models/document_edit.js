"use strict";
const MetaModel = require("../MetaModel.js");
const {dbToDelta, deltaToDb} = require("editor-delta-conversion");

module.exports = (sequelize, DataTypes) => {
    class DocumentEdit extends MetaModel {
        static autoTable = true;

        /**
         * Add a link to the end of a document
         * @param studySessionId session id of the study (the combination of session and step should be unique for a document)
         * @param studyStepId step id of the study (the combination of session and step should be unique for a document)
         * @param link link to be added
         * @param linkText text to be displayed for the link
         * @param transaction transaction object
         * @param skipEmpty if true, don't add link if document is empty
         * @returns {Promise<void>}
         */
        static async addLinkToStudySessionStep(studySessionId, studyStepId, link, linkText, transaction, skipEmpty = true) {

            // get all edits for the document (with studySessionId and studyStepId AND without it)
            const studySessionEdits = await sequelize.models.document_edit.findAll({
                where: {
                    studySessionId: studySessionId,
                    studyStepId: studyStepId,
                    deleted: false,
                }
            }, {transaction: transaction});

            let allEdits = studySessionEdits;
            if (studySessionEdits.length > 0) {

                // get also all raw edits for the document if any
                const rawEdits = await sequelize.models.document_edit.findAll({
                    where: {
                        documentId: studySessionEdits[0].documentId,
                        studySessionId: null,
                        studyStepId: null,
                        deleted: false,
                    }
                }, {transaction: transaction});

                // merge all edits and sort by id
                allEdits = studySessionEdits.concat(rawEdits).sort((a, b) => a.id - b.id);
            }

            const oldDelta = dbToDelta(allEdits);
            if (oldDelta.ops.length === 0 && skipEmpty) {
                // document is empty, don't add link
                return;
            }

            const lastEdit = deltaToDb(oldDelta).slice(-1);
            const currentOffset = lastEdit[0].offset + lastEdit[0].span;

            linkText = "\n\n" + (linkText || link);

            await sequelize.models.document_edit.create({
                userId: allEdits[0].userId,
                documentId: allEdits[0].documentId,
                studySessionId: studySessionId,
                studyStepId: studyStepId,
                text: linkText,
                operationType: 0,
                offset: currentOffset,
                span: linkText.length,
                draft: true,
                attributes: {link: link},
                createdAt: new Date(),
                updatedAt: new Date()
            }, {transaction});

        }

        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here

            DocumentEdit.belongsTo(models["study_step"], {
                foreignKey: 'studyStepId',
                as: 'studyStep',
            });
        }

       /**
        * Copy edits from source step to the next step
        * 
        * @param {Object} sourceStep - the object with the source step information
        * @param {Object} destStep - the object with the destination step information
        * @param {number} studySessionId - the ID of study session
        * @param {Object} transaction - the transaction object
        * @returns {Promise<*>}
        */
        static async copyEditsByStep(sourceStep, destStep, studySessionId, transaction) {
            // Copy all edits from the source document's session
            const sourceEdits = await this.findAll({
                where: {
                    documentId: sourceStep.documentId,
                    studySessionId: studySessionId,
                    studyStepId: sourceStep.id,
                    deleted: false
                },
                raw: true,
            }, {transaction: transaction});

            // Create new edits for the current step
            if (sourceEdits.length > 0) {
                const newEdits = sourceEdits.map(edit => ({
                    ...edit,
                    id: undefined,
                    documentId: destStep.documentId,
                    updatedAt: new Date()
                }));

                await this.bulkCreate(newEdits, {transaction: transaction});
            }
        }
    }

    DocumentEdit.init(
        {
            userId: DataTypes.INTEGER,
            documentId: DataTypes.INTEGER,
            studySessionId: DataTypes.INTEGER,
            studyStepId: DataTypes.INTEGER,
            draft: DataTypes.BOOLEAN,
            offset: DataTypes.INTEGER,
            operationType: DataTypes.INTEGER, // 0: Insert, 1: Delete, 2: Attribute-Change (only retain)
            span: DataTypes.INTEGER,
            text: DataTypes.STRING,
            attributes: DataTypes.JSONB,
            deleted: DataTypes.BOOLEAN,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
            deletedAt: DataTypes.DATE,
        },
        {
            sequelize: sequelize,
            modelName: "document_edit",
            tableName: "document_edit"
        }
    );
    return DocumentEdit;
};
