/**
 * Reports whether an assignment's end time has passed.
 *
 * An empty end stays open. An end equal to now stays open, the same comparison the dashboard status checks use.
 *
 * @param {Object} assignment Assignment row. A missing row counts as not past the deadline.
 * @returns {boolean} True when `end` is strictly before now.
 */
export function isAssignmentPastDeadline(assignment) {
  return !!(assignment?.end && new Date() > new Date(assignment.end));
}
