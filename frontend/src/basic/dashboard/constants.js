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
 * Same as the default options, but with search turned on.
 *
 * @param {Object} - Options to start from
 * @returns {Object} A new options object with search: true
 */
export function withSearch(options = DEFAULT_DASHBOARD_TABLE_OPTIONS) {
  return { ...options, search: true };
}

/**
 * Max height for tables on full dashboard pages.
 * @type {string}
 */
export const DASHBOARD_TABLE_HEIGHT = "65vh";

/**
 * Max height for tables inside dashboard modals.
 * @type {number}
 */
export const DASHBOARD_MODAL_TABLE_HEIGHT = 400;
