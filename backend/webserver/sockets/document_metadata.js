const Socket = require("../Socket.js");
const TranslatableError = require("../../utils/TranslatableError");
const {
    normalizeMetadataMappings,
    validateMetadataMappings,
    normalizePrimaryKeyMapping,
    validatePrimaryKeyValues,
    resolveMetadataImportSubmission,
} = require("../utils/helper/documentMetadata.js");

/**
 * Handle document metadata operations through websocket.
 *
 * @author Linyin Huang
 * @type {DocumentMetadataSocket}
 * @class DocumentMetadataSocket
 */
class DocumentMetadataSocket extends Socket {

    /**
     * Ensure the caller may import metadata for the given assignment.
     *
     * Access is granted when the assignment is open and the caller is any of:
     * - a global admin,
     * - the assignment owner,
     * - a user with `frontend.dashboard.assignments.edit` (same right used for editing assignments in the dashboard).
     *
     * @param {Object} assignment - Assignment record to authorize against.
     * @param {boolean} assignment.closed - Whether the assignment is closed to further changes.
     * @param {number} assignment.userId - ID of the assignment owner.
     * @param {Object} [options={}] - Optional Sequelize transaction and related DB options.
     * @returns {Promise<void>}
     * @throws {TranslatableError} If the assignment is closed or the caller lacks permission.
     */
    async assertMetadataImportAccess(assignment, options = {}) {
        if (assignment.closed) {
            throw new TranslatableError("errors.documentMetadata.assignmentClosed");
        }
        if (await this.isAdmin()) return;

        if (Number(assignment.userId) === Number(this.userId)) return;

        if (await this.hasAccess("frontend.dashboard.assignments.edit")) return;

        throw new TranslatableError("errors.documentMetadata.noPermission");
    }

    /**
     * Persist mapped metadata for all documents of one matched submission row.
     *
     * For each mapping, writes the mapped value plus provenance keys
     * (`metaKey.sourceFile` and `metaKey.sourceField`).
     *
     * @param {Object} data - Payload describing one matched import row.
     * @param {number[]} data.documentIds - Document IDs that receive the mapped metadata.
     * @param {number} data.userId - User ID stored as the metadata author.
     * @param {Object} data.row - Parsed row object from the uploaded metadata file.
     * @param {Object[]} data.mappings - Effective field mappings for this row.
     * @param {string} data.mappings[].sourceField - Column/key in `data.row` to read.
     * @param {string} data.mappings[].metaKey - Target metadata key written on each document.
     * @param {string|null} data.fileName - Original upload filename stored as provenance metadata.
     * @param {Object} [options={}] - Optional Sequelize transaction and related DB options.
     * @returns {Promise<number>} Number of metadata entries written.
     */
    async attachMappedMetadataToDocuments(data, options = {}) {
        const entries = [];
        const fileName = data.fileName || "";

        for (const documentId of data.documentIds) {
            for (const mapping of data.mappings) {
                if (!Object.prototype.hasOwnProperty.call(data.row, mapping.sourceField)) {
                    continue;
                }

                const metaValue = data.row[mapping.sourceField] == null ? "" : String(data.row[mapping.sourceField]);
                entries.push(
                    {documentId, userId: data.userId, metaKey: mapping.metaKey, metaValue},
                    {documentId, userId: data.userId, metaKey: `${mapping.metaKey}.sourceFile`, metaValue: fileName},
                    {documentId, userId: data.userId, metaKey: `${mapping.metaKey}.sourceField`, metaValue: mapping.sourceField},
                );
            }
        }

        if (entries.length === 0) {
            return 0;
        }

        await this.models["document_metadata"].bulkUpsertByDocumentAndKey(entries, options);
        return entries.length;
    }

    /**
     * Build a metadata import plan for one assignment target.
     *
     * Validates caller access, normalizes mappings, and resolves uploaded rows to
     * submission documents without writing metadata.
     *
     * @param {Object} data - Metadata import request payload.
     * @param {string} [data.targetType="assignment"] - Import target type; only `"assignment"` is supported.
     * @param {number} data.assignmentId - Assignment whose submission documents receive metadata.
     * @param {Object} data.primaryKeyMapping - How uploaded rows are matched to submission owners.
     * @param {string} data.primaryKeyMapping.sourceField - Column/key from each uploaded row.
     * @param {"extId"|"email"} data.primaryKeyMapping.targetField - Submission-owner field to match against.
     * @param {Object[]} data.mappings - Field mappings from uploaded rows to document `metaKey` values.
     * @param {string} data.mappings[].sourceField - Source column/key in each uploaded row.
     * @param {string} data.mappings[].metaKey - Target metadata key written on matched documents.
     * @param {Object[]} data.rows - Parsed metadata rows from the uploaded file.
     * @param {string} [data.fileName] - Original upload filename stored as metadata provenance.
     * @param {Object} [options={}] - Optional Sequelize transaction and related DB options.
     * @param {Object} [options.transaction] - Sequelize transaction passed to DB reads.
     * @returns {Promise<Object>} Import plan with counts plus `matched`, `unmatched`, `skipped`, and `overwritten` details.
     */
    async buildMetadataImportPlan(data, options = {}) {
        const targetType = data.targetType || "assignment";
        if (targetType !== "assignment") {
            throw new TranslatableError("errors.documentMetadata.unsupportedTargetType", { targetType });
        }

        const assignmentId = Number(data.assignmentId || 0);
        if (!assignmentId) {
            throw new TranslatableError("errors.documentMetadata.assignmentIdRequired");
        }

        const assignment = await this.models["assignment"].getById(assignmentId, {transaction: options.transaction});
        if (!assignment) {
            throw new TranslatableError("errors.documentMetadata.assignmentNotFound", { assignmentId });
        }

        await this.assertMetadataImportAccess(assignment, options);

        const primaryKeyMapping = normalizePrimaryKeyMapping(data.primaryKeyMapping);
        if (!primaryKeyMapping.sourceField) {
            throw new TranslatableError("errors.documentMetadata.primaryKeySourceRequired");
        }
        if (!["extId", "email"].includes(primaryKeyMapping.targetField)) {
            throw new TranslatableError("errors.documentMetadata.primaryKeyTargetInvalid");
        }

        const rows = Array.isArray(data.rows) ? data.rows.filter((row) => row && typeof row === "object") : [];
        if (rows.length === 0) {
            throw new TranslatableError("errors.documentMetadata.noRows");
        }
        validatePrimaryKeyValues(rows, primaryKeyMapping);

        const mappings = normalizeMetadataMappings(data.mappings);
        if (mappings.length === 0) {
            throw new TranslatableError("errors.documentMetadata.mappingRequired");
        }
        validateMetadataMappings(mappings);

        const submissions = await this.models["submission"].findAll({
            where: {
                assignmentId,
                deleted: false,
            },
            raw: true,
            transaction: options.transaction,
        });

        const ownerUserIds = [...new Set(submissions.map((submission) => Number(submission.userId)))];
        const users = ownerUserIds.length > 0
            ? await this.models["user"].findAll({
                where: {
                    id: ownerUserIds,
                    deleted: false,
                },
                attributes: ["id", "extId", "email"],
                raw: true,
                transaction: options.transaction,
            })
            : [];
        const usersById = new Map(users.map((user) => [Number(user.id), user]));
        const submissionByExtId = new Map();
        const submissionByEmail = new Map();

        for (const submission of submissions) {
            const owner = usersById.get(Number(submission.userId));
            if (!owner) {
                continue;
            }

            if (owner.extId != null) {
                const extId = Number(owner.extId);
                if (!submissionByExtId.has(extId)) {
                    submissionByExtId.set(extId, []);
                }
                submissionByExtId.get(extId).push(submission);
            }

            if (owner.email) {
                const email = String(owner.email).trim().toLowerCase();
                if (!submissionByEmail.has(email)) {
                    submissionByEmail.set(email, []);
                }
                submissionByEmail.get(email).push(submission);
            }
        }

        const documents = submissions.length > 0
            ? await this.models["document"].findAll({
                where: {
                    submissionId: submissions.map((submission) => submission.id),
                    deleted: false,
                },
                raw: true,
                transaction: options.transaction,
            })
            : [];

        const documentsBySubmissionId = documents.reduce((acc, document) => {
            if (!acc.has(document.submissionId)) {
                acc.set(document.submissionId, []);
            }
            acc.get(document.submissionId).push(document);
            return acc;
        }, new Map());

        const metadataKeys = mappings.flatMap((mapping) => [
            mapping.metaKey,
            `${mapping.metaKey}.sourceFile`,
            `${mapping.metaKey}.sourceField`,
        ]);

        const existingMetadataRows = documents.length > 0
            ? await this.models["document_metadata"].findAll({
                where: {
                    documentId: documents.map((document) => document.id),
                    metaKey: metadataKeys,
                },
                raw: true,
                transaction: options.transaction,
            })
            : [];

        const existingByDocumentId = existingMetadataRows.reduce((acc, row) => {
            const documentId = Number(row.documentId);
            if (!acc.has(documentId)) {
                acc.set(documentId, new Set());
            }
            acc.get(documentId).add(row.metaKey);
            return acc;
        }, new Map());

        const matched = [];
        const unmatched = [];
        const overwritten = [];
        const skipped = [];

        let documentCount = 0;
        let metadataEntryCount = 0;
        let overwrittenEntryCount = 0;

        for (const row of rows) {
            const primaryKeyValue = row[primaryKeyMapping.sourceField];
            const resolvedSubmissions = resolveMetadataImportSubmission(
                primaryKeyValue,
                primaryKeyMapping.targetField,
                submissionByExtId,
                submissionByEmail
            );

            if (resolvedSubmissions.length === 0) {
                unmatched.push({
                    primaryKeyValue: primaryKeyValue ?? null,
                    key: "errors.documentMetadata.noSubmissionOwnerMatch",
                });
                continue;
            }

            const ownerUserIdsForRow = new Set(resolvedSubmissions.map((submission) => Number(submission.userId)));
            if (ownerUserIdsForRow.size > 1) {
                unmatched.push({
                    primaryKeyValue: primaryKeyValue ?? null,
                    key: "errors.documentMetadata.multipleOwnersMatch",
                });
                continue;
            }

            const effectiveMappings = mappings.filter((mapping) => Object.prototype.hasOwnProperty.call(row, mapping.sourceField));
            if (effectiveMappings.length === 0) {
                skipped.push({
                    submissionId: resolvedSubmissions[0]?.id || null,
                    key: "errors.documentMetadata.noMappedSourceFields",
                });
                continue;
            }

            const submissionDocuments = [];
            for (const submission of resolvedSubmissions) {
                const documentsForSubmission = documentsBySubmissionId.get(submission.id) || [];
                if (documentsForSubmission.length === 0) {
                    skipped.push({
                        submissionId: submission.id,
                        key: "errors.documentMetadata.submissionHasNoDocuments",
                    });
                    continue;
                }
                submissionDocuments.push(...documentsForSubmission);
            }

            if (submissionDocuments.length === 0) {
                continue;
            }

            let rowOverwrittenEntryCount = 0;

            for (const document of submissionDocuments) {
                const existingKeys = existingByDocumentId.get(Number(document.id)) || new Set();
                for (const mapping of effectiveMappings) {
                    for (const metaKey of [mapping.metaKey, `${mapping.metaKey}.sourceFile`, `${mapping.metaKey}.sourceField`]) {
                        if (existingKeys.has(metaKey)) {
                            rowOverwrittenEntryCount += 1;
                        }
                    }
                }
            }

            const rowMetadataEntryCount = submissionDocuments.length * effectiveMappings.length * 3;
            matched.push({
                userId: resolvedSubmissions[0].userId,
                row,
                documentIds: submissionDocuments.map((document) => document.id),
                mappings: effectiveMappings,
            });

            if (rowOverwrittenEntryCount > 0) {
                overwritten.push({
                    submissionId: resolvedSubmissions[0].id,
                    key: "errors.documentMetadata.entriesOverwritten",
                    params: { count: rowOverwrittenEntryCount },
                });
            }

            documentCount += submissionDocuments.length;
            metadataEntryCount += rowMetadataEntryCount;
            overwrittenEntryCount += rowOverwrittenEntryCount;
        }

        return {
            matchedRowCount: matched.length,
            unmatchedRowCount: unmatched.length,
            skippedRowCount: skipped.length,
            documentCount,
            metadataEntryCount,
            overwrittenEntryCount,
            matched,
            unmatched,
            overwritten,
            skipped,
        };
    }

    /**
     * Preview metadata import without mutating documents.
     *
     * Authorization is enforced inside `buildMetadataImportPlan`.
     *
     * @param {Object} data - Same payload as `buildMetadataImportPlan`.
     * @param {Object} [options={}] - Optional Sequelize transaction and related DB options.
     * @returns {Promise<Object>} Summary counts only (no `matched` / `unmatched` row details).
     */
    async previewMetadataImport(data, options = {}) {
        const plan = await this.buildMetadataImportPlan(data, options);
        return {
            matchedRowCount: plan.matchedRowCount,
            unmatchedRowCount: plan.unmatchedRowCount,
            skippedRowCount: plan.skippedRowCount,
            documentCount: plan.documentCount,
            metadataEntryCount: plan.metadataEntryCount,
            overwrittenEntryCount: plan.overwrittenEntryCount,
        };
    }

    /**
     * Import metadata rows for existing submissions in one assignment.
     *
     * Authorization is enforced inside `buildMetadataImportPlan`.
     *
     * @param {Object} data - Same payload as `buildMetadataImportPlan`.
     * @param {Object} [options={}] - Optional Sequelize transaction and related DB options.
     * @returns {Promise<Object>} Import summary counts plus unmatched, skipped, and overwritten row details.
     */
    async importMetadata(data, options = {}) {
        const plan = await this.buildMetadataImportPlan(data, options);

        for (const match of plan.matched) {
            await this.attachMappedMetadataToDocuments({
                documentIds: match.documentIds,
                userId: match.userId,
                row: match.row,
                mappings: match.mappings,
                fileName: data.fileName || null,
            }, options);
        }

        return {
            matchedRowCount: plan.matchedRowCount,
            unmatchedRowCount: plan.unmatchedRowCount,
            skippedRowCount: plan.skippedRowCount,
            documentCount: plan.documentCount,
            metadataEntryCount: plan.metadataEntryCount,
            unmatched: plan.unmatched,
            skipped: plan.skipped,
            overwritten: plan.overwritten,
        };
    }

    async init() {
        this.createSocket("documentPreviewMetadataImport", this.previewMetadataImport, {}, false);
        this.createSocket("documentImportMetadata", this.importMetadata, {}, true);
    }
}

module.exports = DocumentMetadataSocket;
