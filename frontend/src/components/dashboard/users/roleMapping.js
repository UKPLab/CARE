/**
 * Splits a comma-separated role list from an external import source.
 *
 * @param {string|undefined|null} roles Raw role list, with individual roles separated by commas.
 * @returns {string[]} Trimmed role names, excluding empty entries.
 */
export function splitExternalRoles(roles) {
  return roles ? roles.split(",").map((role) => role.trim()).filter(Boolean) : [];
}

/**
 * Formats one external role string for display.
 *
 * Moodle role labels may contain multilingual markup such as
 * "{mlang de}Lehrende{mlang}{mlang other}Lecturer{mlang}". The raw role string
 * is kept elsewhere for exact mapping; this function only prepares a readable label.
 *
 * @param {string} role Raw external role string.
 * @returns {string} Human-readable role label.
 */
export function formatExternalRole(role) {
  const matches = [...role.matchAll(/\{mlang\s+[^}]+}([^{}]*)\{mlang}/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  if (matches.length > 0) {
    return [...new Set(matches)].join(" / ");
  }
  return role.replace(/\{[^}]*}/g, "").replace(/\s+/g, " ").trim() || role;
}

/**
 * Builds the rows shown in the role mapping step.
 *
 * Rows are grouped by raw role string so different external roles are not merged
 * just because their formatted display labels look the same.
 *
 * @param {Object[]} users Imported users.
 * @param {string} users[].roles Raw comma-separated role list for one user.
 * @returns {{raw: string, count: number, label: string}[]} Role rows sorted by display label.
 */
export function getRoleRows(users) {
  const roles = new Map();
  users.forEach((user) => {
    splitExternalRoles(user.roles).forEach((role) => {
      roles.set(role, (roles.get(role) || 0) + 1);
    });
  });
  return Array.from(roles, ([raw, count]) => ({
    raw,
    count,
    label: formatExternalRole(raw),
  })).sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Formats a comma-separated role list for display in the import preview.
 *
 * @param {string|undefined|null} roles Raw comma-separated role list.
 * @returns {string} Readable comma-separated role list.
 */
export function formatRoleList(roles) {
  return splitExternalRoles(roles).map(formatExternalRole).join(", ");
}

/**
 * Adds display-only role labels to imported users.
 *
 * The original `roles` value is intentionally preserved because it is used as
 * the key for role mapping and backend import. `displayRoles` is only for UI.
 *
 * @param {Object[]} users Imported users from CSV or Moodle.
 * @param {string} users[].roles Raw comma-separated role list for one user.
 * @returns {Object[]} New user objects with an added `displayRoles` field.
 */
export function normalizeImportUsers(users) {
  return users.map((user) => ({
    ...user,
    displayRoles: formatRoleList(user.roles),
  }));
}

/**
 * Keeps explicit role mapping choices that still apply to the current import.
 *
 * Missing mappings are intentionally not guessed. The role mapping step should
 * force users to choose a CARE role or explicitly choose no additional role.
 *
 * @param {Object[]} users Imported users.
 * @param {string} users[].roles Raw comma-separated role list for one user.
 * @param {Object<string, string>} [currentMappings={}] Existing raw-role to CARE-role selections.
 * @returns {Object<string, string>} Mapping entries that still match roles in the current import.
 */
export function buildInitialRoleMappings(users, currentMappings = {}) {
  return getRoleRows(users).reduce((mappings, role) => {
    if (Object.prototype.hasOwnProperty.call(currentMappings, role.raw)) {
      mappings[role.raw] = currentMappings[role.raw];
    }
    return mappings;
  }, {});
}
