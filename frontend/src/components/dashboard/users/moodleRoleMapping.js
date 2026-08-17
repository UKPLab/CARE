export function splitExternalRoles(roles) {
  return roles ? roles.split(",").map((role) => role.trim()).filter(Boolean) : [];
}

export function formatExternalRole(role) {
  const matches = [...role.matchAll(/\{mlang\s+[^}]+}([^{}]*)\{mlang}/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  if (matches.length > 0) {
    return [...new Set(matches)].join(" / ");
  }
  return role.replace(/\{[^}]*}/g, "").replace(/\s+/g, " ").trim() || role;
}

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

export function buildInitialRoleMappings(users, currentMappings = {}) {
  return getRoleRows(users).reduce((mappings, role) => {
    if (Object.prototype.hasOwnProperty.call(currentMappings, role.raw)) {
      mappings[role.raw] = currentMappings[role.raw];
    }
    return mappings;
  }, {});
}
