"use strict";
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class DocumentMetadata extends MetaModel {
        static autoTable = true;

        /**
         * Create or update one metadata entry for a document and key.
         *
         * The topic import stores one logical record per document/key pair.
         * If the key already exists for the document, the entry is updated in place
         * instead of creating duplicate active rows.
         *
         * @param {Object} data
         * @param {number} data.documentId｀
         * @param {number} data.userId
         * @param {string} data.metaKey
         * @param {*} data.metaValue
         * @param {Object} [options={}]
         * @returns {Promise<Object>}
         */
        static async upsertByDocumentAndKey(data, options = {}) {
            const existing = await this.findOne({
                where: {
                    documentId: data.documentId,
                    metaKey: data.metaKey,
                    deleted: false,
                },
                raw: true,
                transaction: options.transaction,
            });

            if (existing) {
                return await this.updateById(existing.id, {
                    userId: data.userId,
                    metaValue: data.metaValue,
                    deleted: false,
                    deletedAt: null,
                }, options);
            }

            return await this.add(data, options);
        }

        /**
         * Load active metadata rows for a given document.
         *
         * @param {number} documentId
         * @param {Object} [options={}]
         * @returns {Promise<Object[]>}
         */
        static async getByDocumentId(documentId, options = {}) {
            return await this.findAll({
                where: {
                    documentId,
                    deleted: false,
                },
                raw: true,
                ...options,
            });
        }

        static associate(models) {
            DocumentMetadata.belongsTo(models["document"], {
                foreignKey: "documentId",
                as: "document",
            });

            DocumentMetadata.belongsTo(models["user"], {
                foreignKey: "userId",
                as: "user",
            });
        }
    }

    DocumentMetadata.init({
        documentId: DataTypes.INTEGER,
        userId: DataTypes.INTEGER,
        metaKey: DataTypes.STRING,
        metaValue: DataTypes.JSONB,
        deleted: DataTypes.BOOLEAN,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
        deletedAt: DataTypes.DATE,
    }, {
        sequelize: sequelize,
        modelName: 'document_metadata',
        tableName: 'document_metadata',
    });

    return DocumentMetadata;
};
