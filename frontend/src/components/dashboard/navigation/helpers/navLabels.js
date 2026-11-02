/**
 * Shared translation-label helpers for sidebar navigation groups/elements.
 * Falls back to the raw group/element name when no translation key exists.
 *
 * @author Carly Gettinger, Dennis Zyska, Nils Dycke, Andrii Nikitin
 */

/**
 * Resolves the display label for a sidebar navigation group.
 * @param {Function} $t - Vue i18n translate function ($t)
 * @param {Function} $te - Vue i18n translation-exists function ($te)
 * @param {Object} group - nav group object with a `name`
 * @returns {string} translated label, or the raw group name if untranslated
 */
export function navGroupLabel($t, $te, group) {
  const key = `sidebar.nav.groups.${group.name.toLowerCase()}`;
  return $te(key) ? $t(key) : group.name;
}

/**
 * Resolves the display label for a sidebar navigation element.
 * @param {Function} $t - Vue i18n translate function ($t)
 * @param {Function} $te - Vue i18n translation-exists function ($te)
 * @param {Object} element - nav element object with a `path` and `name`
 * @returns {string} translated label, or the raw element name if untranslated
 */
export function navElementLabel($t, $te, element) {
  const key = `sidebar.nav.${element.path}`;
  return $te(key) ? $t(key) : element.name;
}
