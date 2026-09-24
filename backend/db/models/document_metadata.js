"use strict";
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class DocumentMetadata extends MetaModel {
        /**
         * Create or update one metadata entry for a document and key.
         *
         * Metadata import stores one logical record per document/key pair.
         * If the key already exists for the document, the entry is updated in place
         * and revived if it was previously soft-deleted.
         *
         * @param {Object} data - Metadata entry to create or update.
         * @param {number} data.documentId - Document that owns the metadata row.
         * @param {number} data.userId - User ID stored as the metadata author.
         * @param {string} data.metaKey - Metadata key for the document.
         * @param {string} data.metaValue - Metadata value to persist.
         * @param {Object} [options={}] - Optional Sequelize transaction and related DB options.
         * @returns {Promise<Object>}
         */
        static async upsertByDocumentAndKey(data, options = {}) {
            const payload = {
                documentId: data.documentId,
                userId: data.userId,
                metaKey: data.metaKey,
                metaValue: data.metaValue,
                deleted: false,
                deletedAt: null,
            };

            await this.upsert(payload, {
                conflictFields: ["documentId", "metaKey"],
                ...options,
            });

            return await this.findOne({
                where: {
                    documentId: data.documentId,
                    metaKey: data.metaKey,
                },
                raw: true,
                transaction: options.transaction,
            });
        }

        /**
         * Create or update many metadata entries in bulk.
         *
         * Duplicate document/key pairs in the input are deduplicated with last-write-wins semantics.
         *
         * @param {Object[]} entries - Metadata entries to create or update.
         * @param {number} entries[].documentId - Document that owns each metadata row.
         * @param {number} entries[].userId - User ID stored as the metadata author.
         * @param {string} entries[].metaKey - Metadata key for the document.
         * @param {string} entries[].metaValue - Metadata value to persist.
         * @param {Object} [options={}] - Optional Sequelize transaction and related DB options.
         * @returns {Promise<number>} Number of entries processed
         */
        static async bulkUpsertByDocumentAndKey(entries, options = {}) {
            if (!Array.isArray(entries) || entries.length === 0) {
                return 0;
            }

            const dedupedEntries = [];
            const pairIndex = new Map();
            for (const entry of entries) {
                const pairKey = `${entry.documentId}:${entry.metaKey}`;
                if (pairIndex.has(pairKey)) {
                    dedupedEntries[pairIndex.get(pairKey)] = entry;
                    continue;
                }
                pairIndex.set(pairKey, dedupedEntries.length);
                dedupedEntries.push(entry);
            }

            const payloads = dedupedEntries.map((entry) => ({
                documentId: entry.documentId,
                userId: entry.userId,
                metaKey: entry.metaKey,
                metaValue: entry.metaValue,
                deleted: false,
                deletedAt: null,
            }));

            await this.bulkCreate(payloads, {
                conflictAttributes: ["documentId", "metaKey"],
                updateOnDuplicate: ["userId", "metaValue", "deleted", "deletedAt", "updatedAt"],
                ...options,
            });

            return dedupedEntries.length;
        }

        /**
         * Duplicate active metadata rows from one document to another.
         *
         * @param {number} originalDocumentId - Source document to copy metadata from.
         * @param {number} targetDocumentId - Destination document that receives duplicated metadata.
         * @param {Object} [options={}] - Optional Sequelize transaction and related DB options.
         * @returns {Promise<Object[]>}
         */
        static async duplicateDocumentMetadata(originalDocumentId, targetDocumentId, options = {}) {
            const metadataRows = await this.findAll({
                where: {
                    documentId: originalDocumentId,
                    deleted: false,
                },
                raw: true,
                transaction: options.transaction,
            });

            const duplicatedRows = [];

            for (const metadataRow of metadataRows) {
                const duplicatedRow = await this.upsertByDocumentAndKey({
                    documentId: targetDocumentId,
                    userId: metadataRow.userId,
                    metaKey: metadataRow.metaKey,
                    metaValue: metadataRow.metaValue,
                    deleted: false,
                    deletedAt: null,
                }, options);

                duplicatedRows.push(duplicatedRow);
            }

            return duplicatedRows;
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
        documentId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        metaKey: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: false,
        },
        metaValue: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        deleted: DataTypes.BOOLEAN,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
        deletedAt: DataTypes.DATE,
    }, {
        sequelize: sequelize,
        modelName: 'document_metadata',
        tableName: 'document_metadata',
    });

    DocumentMetadata.removeAttribute('id');

    return DocumentMetadata;
};
