/**
 * Shared table settings for dashboard list pages.
 * Copy or spread these values when using them in a page.
 *
 * @author Mohammad Elwan
 */

/**
 * Default options for dashboard BasicTable instances.
 * @type {Object}
 */
export const DEFAULT_DASHBOARD_TABLE_OPTIONS = Object.freeze({
  striped: true,
  hover: true,
  bordered: false,
  borderless: false,
  small: false,
  pagination: 10,
});

/**
 * Default table options with search turned on.
 * Extra options are added on top of the defaults, they do not replace them.
 *
 * @param {Object} [options] - Extra table options
 * @returns {Object} A new options object with search enabled
 */
export function withSearch(options = {}) {
  return { ...DEFAULT_DASHBOARD_TABLE_OPTIONS, ...options, search: true };
}

/**
 * Max height for tables on full dashboard pages.
 * @type {string}
 */
export const DASHBOARD_TABLE_HEIGHT = "65vh";
