"use strict";

/**
 * CSV rows for role-mode bulk assignment. Names come from the already resolved rows.
 * @param {Object} finalAssignments assignmentId → reviewerId[]
 * @param {Array} selectedAssignments
 * @param {Array} selectedReviewer
 * @returns {Array<Object>}
 */
function buildRoleBulkCsvRows(finalAssignments, selectedAssignments, selectedReviewer) {
    const reviewersById = Object.fromEntries(
        (selectedReviewer || []).map((user) => [String(user.id), user])
    );
    const assignmentsById = Object.fromEntries(
        (selectedAssignments || []).map((row) => [String(row.id), row])
    );
    return Object.keys(finalAssignments).map((assignmentId) => {
        const assignmentUser = assignmentsById[String(assignmentId)] || {};
        const csv = {
            assignedToName: `${assignmentUser.firstName || ""} ${assignmentUser.lastName || ""}`.trim(),
            assignedToFirstName: assignmentUser.firstName || "",
            assignedToLastName: assignmentUser.lastName || "",
        };
        (finalAssignments[assignmentId] || []).forEach((reviewerId, index) => {
            const reviewerUser = reviewersById[String(reviewerId)];
            csv[`reviewer_${index + 1}`] = reviewerUser
                ? `${reviewerUser.firstName || ""} ${reviewerUser.lastName || ""}`.trim()
                : "";
        });
        return csv;
    });
}

module.exports = {buildRoleBulkCsvRows};
