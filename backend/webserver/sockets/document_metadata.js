const Socket = require("../Socket.js");

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
     * @throws {Error} If the assignment is closed or the caller lacks permission.
     */
    async assertMetadataImportAccess(assignment, options = {}) {
        if (assignment.closed) {
            throw new Error("Cannot import metadata because the assignment is closed.");
        }
        if (await this.isAdmin()) return;

        if (Number(assignment.userId) === Number(this.userId)) return;

        if (await this.hasAccess("frontend.dashboard.assignments.edit")) return;

        throw new Error("You do not have permission to import metadata for this assignment.");
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
     * Normalize metadata mappings into a canonical backend shape.
     *
     * @param {Object[]} [mappings=[]] - Raw mapping objects from the client.
     * @param {string} [mappings[].sourceField] - Source column/key in each uploaded row.
     * @param {string} [mappings[].metaKey] - Target metadata key to write on matched documents.
     * @returns {Object[]} Trimmed mappings with non-empty `sourceField` and `metaKey`.
     */
    normalizeMetadataMappings(mappings = []) {
        return mappings
            .map((mapping) => ({
                sourceField: String(mapping?.sourceField || "").trim(),
                metaKey: String(mapping?.metaKey || "").trim(),
            }))
            .filter((mapping) => mapping.sourceField && mapping.metaKey);
    }

    /**
     * Validate target metadata keys before adding system-generated provenance rows.
     *
     * @param {Object[]} [mappings=[]] - Normalized metadata mappings to validate.
     * @param {string} mappings[].metaKey - Target metadata key that must be unique and non-reserved.
     * @returns {void}
     * @throws {Error} If mappings contain duplicate or reserved metaKeys.
     */
    validateMetadataMappings(mappings = []) {
        const reservedSuffixes = [".sourceFile", ".sourceField"];
        const metaKeys = mappings.map((mapping) => mapping.metaKey);

        if (new Set(metaKeys).size !== metaKeys.length) {
            throw new Error("Target metaKeys must be unique.");
        }

        const reservedMetaKeys = metaKeys.filter((metaKey) => (
            reservedSuffixes.some((suffix) => metaKey.endsWith(suffix))
        ));
        if (reservedMetaKeys.length > 0) {
            throw new Error(
                `Target metaKeys cannot end with reserved provenance suffixes: ${reservedMetaKeys.join(", ")}`
            );
        }
    }

    /**
     * Normalize the primary key mapping into a canonical backend shape.
     *
     * @param {Object} [primaryKeyMapping={}] - Raw primary-key mapping from the client.
     * @param {string} [primaryKeyMapping.sourceField] - Column/key from each uploaded row.
     * @param {string} [primaryKeyMapping.targetField] - Submission-owner field to match against.
     * @returns {{sourceField: string, targetField: string}} Trimmed primary-key mapping.
     */
    normalizePrimaryKeyMapping(primaryKeyMapping = {}) {
        return {
            sourceField: String(primaryKeyMapping?.sourceField || "").trim(),
            targetField: String(primaryKeyMapping?.targetField || "").trim(),
        };
    }

    /**
     * Normalize one primary key value according to the selected target field.
     *
     * @param {*} rawValue - Raw primary-key value from an uploaded row.
     * @param {string} targetField - Submission-owner field type (`"extId"` or `"email"`).
     * @returns {number|string|null} Normalized lookup value, or `null` when invalid or empty.
     */
    normalizePrimaryKeyValue(rawValue, targetField) {
        if (rawValue == null) {
            return null;
        }

        const stringValue = String(rawValue).trim();
        if (!stringValue) {
            return null;
        }

        if (targetField === "extId") {
            const numericValue = Number(stringValue);
            return Number.isNaN(numericValue) ? null : numericValue;
        }

        if (targetField === "email") {
            return stringValue.toLowerCase();
        }

        return null;
    }

    /**
     * Validate primary key values for emptiness and duplicates.
     *
     * @param {Object[]} rows - Parsed metadata rows from the uploaded file.
     * @param {Object} primaryKeyMapping - Normalized primary-key mapping.
     * @param {string} primaryKeyMapping.sourceField - Column/key to read from each row.
     * @param {"extId"|"email"} primaryKeyMapping.targetField - Submission-owner field to match against.
     * @returns {void}
     * @throws {Error} If any row has an invalid or duplicate primary-key value.
     */
    validatePrimaryKeyValues(rows, primaryKeyMapping) {
        const seen = new Set();
        const duplicates = new Set();

        for (const row of rows) {
            const normalized = this.normalizePrimaryKeyValue(row?.[primaryKeyMapping.sourceField], primaryKeyMapping.targetField);
            if (normalized == null) {
                throw new Error("Primary key values must be present and valid for every imported row.");
            }

            if (seen.has(normalized)) {
                duplicates.add(normalized);
            } else {
                seen.add(normalized);
            }
        }

        if (duplicates.size > 0) {
            throw new Error(
                `Duplicate primary key values found for ${primaryKeyMapping.targetField}: ${[...duplicates].join(", ")}`
            );
        }
    }

    /**
     * Resolve a metadata import row against assignment submissions.
     *
     * @param {*} rawValue - Raw primary-key value from an uploaded row.
     * @param {string} targetField - Submission-owner field type (`"extId"` or `"email"`).
     * @param {Map<number, Object[]>} submissionByExtId - Submissions indexed by owner `extId`.
     * @param {Map<string, Object[]>} submissionByEmail - Submissions indexed by owner email.
     * @returns {Object[]} Matching submission records for the normalized primary-key value.
     */
    resolveMetadataImportSubmission(rawValue, targetField, submissionByExtId, submissionByEmail) {
        const normalizedValue = this.normalizePrimaryKeyValue(rawValue, targetField);
        if (normalizedValue == null) {
            return [];
        }

        if (targetField === "extId" && submissionByExtId.has(normalizedValue)) {
            return submissionByExtId.get(normalizedValue);
        }

        if (targetField === "email" && submissionByEmail.has(normalizedValue)) {
            return submissionByEmail.get(normalizedValue);
        }

        return [];
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
            throw new Error(`Unsupported target type "${targetType}".`);
        }

        const assignmentId = Number(data.assignmentId || 0);
        if (!assignmentId) {
            throw new Error("Assignment ID is required.");
        }

        const assignment = await this.models["assignment"].getById(assignmentId, {transaction: options.transaction});
        if (!assignment) {
            throw new Error(`Assignment with id ${assignmentId} not found`);
        }

        await this.assertMetadataImportAccess(assignment, options);

        const primaryKeyMapping = this.normalizePrimaryKeyMapping(data.primaryKeyMapping);
        if (!primaryKeyMapping.sourceField) {
            throw new Error("Primary key source field is required.");
        }
        if (!["extId", "email"].includes(primaryKeyMapping.targetField)) {
            throw new Error("Primary key target field must be either \"extId\" or \"email\".");
        }

        const rows = Array.isArray(data.rows) ? data.rows.filter((row) => row && typeof row === "object") : [];
        if (rows.length === 0) {
            throw new Error("No metadata rows provided.");
        }
        this.validatePrimaryKeyValues(rows, primaryKeyMapping);

        const mappings = this.normalizeMetadataMappings(data.mappings);
        if (mappings.length === 0) {
            throw new Error("At least one metadata mapping is required.");
        }
        this.validateMetadataMappings(mappings);

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
                    deleted: false,
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
            const resolvedSubmissions = this.resolveMetadataImportSubmission(
                primaryKeyValue,
                primaryKeyMapping.targetField,
                submissionByExtId,
                submissionByEmail
            );

            if (resolvedSubmissions.length === 0) {
                unmatched.push({
                    primaryKeyValue: primaryKeyValue ?? null,
                    message: "No submission owner match found in this assignment.",
                });
                continue;
            }

            const ownerUserIdsForRow = new Set(resolvedSubmissions.map((submission) => Number(submission.userId)));
            if (ownerUserIdsForRow.size > 1) {
                unmatched.push({
                    primaryKeyValue: primaryKeyValue ?? null,
                    message: "Primary key matched submissions owned by different users.",
                });
                continue;
            }

            const effectiveMappings = mappings.filter((mapping) => Object.prototype.hasOwnProperty.call(row, mapping.sourceField));
            if (effectiveMappings.length === 0) {
                skipped.push({
                    submissionId: resolvedSubmissions[0]?.id || null,
                    message: "Row does not contain any mapped source fields.",
                });
                continue;
            }

            const submissionDocuments = [];
            for (const submission of resolvedSubmissions) {
                const documentsForSubmission = documentsBySubmissionId.get(submission.id) || [];
                if (documentsForSubmission.length === 0) {
                    skipped.push({
                        submissionId: submission.id,
                        message: "Submission has no documents.",
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
                    message: `${rowOverwrittenEntryCount} metadata entries were overwritten.`,
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
