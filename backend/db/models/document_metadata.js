"use strict";
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class DocumentMetadata extends MetaModel {
        static autoTable = true;

        /**
         * Create or update one metadata entry for a document and key.
         *
         * Metadata import stores one logical record per document/key pair.
         * If the key already exists for the document, the entry is updated in place
         * instead of creating duplicate active rows.
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

            const documentIds = Array.from(new Set(dedupedEntries.map((entry) => entry.documentId)));
            const metaKeys = Array.from(new Set(dedupedEntries.map((entry) => entry.metaKey)));
            const existingRows = await this.findAll({
                where: {
                    documentId: documentIds,
                    metaKey: metaKeys,
                    deleted: false,
                },
                raw: true,
                transaction: options.transaction,
            });

            const existingByPair = new Map(
                existingRows.map((row) => [`${row.documentId}:${row.metaKey}`, row])
            );

            const rowsToCreate = [];
            const updatePromises = [];

            for (const entry of dedupedEntries) {
                const pairKey = `${entry.documentId}:${entry.metaKey}`;
                const existing = existingByPair.get(pairKey);
                const payload = {
                    documentId: entry.documentId,
                    userId: entry.userId,
                    metaKey: entry.metaKey,
                    metaValue: entry.metaValue,
                    deleted: false,
                    deletedAt: null,
                };

                if (existing) {
                    updatePromises.push(this.updateById(existing.id, payload, options));
                } else {
                    rowsToCreate.push(payload);
                }
            }

            if (rowsToCreate.length > 0) {
                await this.bulkCreate(rowsToCreate, {
                    transaction: options.transaction,
                });
            }
            if (updatePromises.length > 0) {
                await Promise.all(updatePromises);
            }

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
        documentId: DataTypes.INTEGER,
        userId: DataTypes.INTEGER,
        metaKey: DataTypes.STRING,
        metaValue: DataTypes.TEXT,
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
