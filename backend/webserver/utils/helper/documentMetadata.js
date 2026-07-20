"use strict";

/**
 * Normalize metadata mappings into a canonical backend shape.
 *
 * @param {Object[]} [mappings=[]] - Raw mapping objects from the client.
 * @param {string} [mappings[].sourceField] - Source column/key in each uploaded row.
 * @param {string} [mappings[].metaKey] - Target metadata key to write on matched documents.
 * @returns {Object[]} Trimmed mappings with non-empty `sourceField` and `metaKey`.
 */
function normalizeMetadataMappings(mappings = []) {
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
function validateMetadataMappings(mappings = []) {
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
function normalizePrimaryKeyMapping(primaryKeyMapping = {}) {
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
function normalizePrimaryKeyValue(rawValue, targetField) {
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
function validatePrimaryKeyValues(rows, primaryKeyMapping) {
    const seen = new Set();
    const duplicates = new Set();

    for (const row of rows) {
        const normalized = normalizePrimaryKeyValue(row?.[primaryKeyMapping.sourceField], primaryKeyMapping.targetField);
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
function resolveMetadataImportSubmission(rawValue, targetField, submissionByExtId, submissionByEmail) {
    const normalizedValue = normalizePrimaryKeyValue(rawValue, targetField);
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

module.exports = {
    normalizeMetadataMappings,
    validateMetadataMappings,
    normalizePrimaryKeyMapping,
    normalizePrimaryKeyValue,
    validatePrimaryKeyValues,
    resolveMetadataImportSubmission,
};
