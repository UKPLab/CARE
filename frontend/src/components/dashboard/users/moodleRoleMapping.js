export function splitMoodleRoles(roles) {
  return roles ? roles.split(",").map((role) => role.trim()).filter(Boolean) : [];
}

export function formatMoodleRole(role) {
  const matches = [...role.matchAll(/\{mlang\s+[^}]+}([^{}]*)\{mlang}/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  if (matches.length > 0) {
    return [...new Set(matches)].join(" / ");
  }
  return role.replace(/\{[^}]*}/g, "").replace(/\s+/g, " ").trim() || role;
}

export function getMoodleRoleRows(users) {
  const roles = new Map();
  users.forEach((user) => {
    splitMoodleRoles(user.roles).forEach((role) => {
      roles.set(role, (roles.get(role) || 0) + 1);
    });
  });
  return Array.from(roles, ([raw, count]) => ({
    raw,
    count,
    label: formatMoodleRole(raw),
  })).sort((a, b) => a.label.localeCompare(b.label));
}

export function buildInitialRoleMappings(users, currentMappings = {}) {
  return getMoodleRoleRows(users).reduce((mappings, role) => {
    if (Object.prototype.hasOwnProperty.call(currentMappings, role.raw)) {
      mappings[role.raw] = currentMappings[role.raw];
    }
    return mappings;
  }, {});
}
