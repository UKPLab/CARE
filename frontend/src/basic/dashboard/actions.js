/**
 * Shared icons, button styles, and badge colors for dashboard tables.
 *
 * Use dashboardRowAction() for common actions, then put buttons in any order.
 * For page-only icons, use dashboardRowButton() so colors stay consistent.
 * Use confirmSoftDelete() for confirm + appDataUpdate soft-delete.
 *
 * Color rules:
 * - default actions use outline-secondary
 * - delete / close / disable use outline-danger
 * - caution actions (e.g. hide) use outline-warning via dashboardRowButton(..., "warning")
 *
 * Prefer one catalog key per meaning so icons stay distinct without hover titles.
 *
 * @author Mohammad Elwan
 */

/**
 * Shared button option presets for row actions.
 * @type {Object}
 */
export const DASHBOARD_ROW_BUTTON_STYLES = Object.freeze({
  default: Object.freeze({
    iconOnly: true,
    specifiers: Object.freeze({ "btn-outline-secondary": true }),
  }),
  danger: Object.freeze({
    iconOnly: true,
    specifiers: Object.freeze({ "btn-outline-danger": true }),
  }),
  warning: Object.freeze({
    iconOnly: true,
    specifiers: Object.freeze({ "btn-outline-warning": true }),
  }),
});

/**
 * Default icon and style for common row actions.
 * Keys are semantic action names; values hold the Bootstrap icon and style preset.
 * @type {Object}
 */
export const DASHBOARD_ROW_ACTIONS = Object.freeze({
  edit: Object.freeze({
    icon: "pencil",
    options: DASHBOARD_ROW_BUTTON_STYLES.default,
  }),
  editContent: Object.freeze({
    icon: "journal-text",
    options: DASHBOARD_ROW_BUTTON_STYLES.default,
  }),
  open: Object.freeze({
    icon: "box-arrow-in-right",
    options: DASHBOARD_ROW_BUTTON_STYLES.default,
  }),
  start: Object.freeze({
    icon: "play-fill",
    options: DASHBOARD_ROW_BUTTON_STYLES.default,
  }),
  resume: Object.freeze({
    icon: "play",
    options: DASHBOARD_ROW_BUTTON_STYLES.default,
  }),
  inspect: Object.freeze({
    icon: "search",
    options: DASHBOARD_ROW_BUTTON_STYLES.default,
  }),
  view: Object.freeze({
    icon: "eye",
    options: DASHBOARD_ROW_BUTTON_STYLES.default,
  }),
  copy: Object.freeze({
    icon: "clipboard",
    options: DASHBOARD_ROW_BUTTON_STYLES.default,
  }),
  link: Object.freeze({
    icon: "link-45deg",
    options: DASHBOARD_ROW_BUTTON_STYLES.default,
  }),
  download: Object.freeze({
    icon: "download",
    options: DASHBOARD_ROW_BUTTON_STYLES.default,
  }),
  exportPdf: Object.freeze({
    icon: "filetype-pdf",
    options: DASHBOARD_ROW_BUTTON_STYLES.default,
  }),
  exportHtml: Object.freeze({
    icon: "filetype-html",
    options: DASHBOARD_ROW_BUTTON_STYLES.default,
  }),
  exportDelta: Object.freeze({
    icon: "file-earmark-diff",
    options: DASHBOARD_ROW_BUTTON_STYLES.default,
  }),
  share: Object.freeze({
    icon: "share",
    options: DASHBOARD_ROW_BUTTON_STYLES.default,
  }),
  publish: Object.freeze({
    icon: "cloud-arrow-up",
    options: DASHBOARD_ROW_BUTTON_STYLES.default,
  }),
  submissions: Object.freeze({
    icon: "inbox",
    options: DASHBOARD_ROW_BUTTON_STYLES.default,
  }),
  sessions: Object.freeze({
    icon: "person-video2",
    options: DASHBOARD_ROW_BUTTON_STYLES.default,
  }),
  rights: Object.freeze({
    icon: "shield-lock",
    options: DASHBOARD_ROW_BUTTON_STYLES.default,
  }),
  delete: Object.freeze({
    icon: "trash",
    options: DASHBOARD_ROW_BUTTON_STYLES.danger,
  }),
  disable: Object.freeze({
    icon: "toggle-off",
    options: DASHBOARD_ROW_BUTTON_STYLES.danger,
  }),
  enable: Object.freeze({
    icon: "toggle-on",
    options: DASHBOARD_ROW_BUTTON_STYLES.default,
  }),
  close: Object.freeze({
    icon: "stop-circle",
    options: DASHBOARD_ROW_BUTTON_STYLES.danger,
  }),
  restart: Object.freeze({
    icon: "arrow-counterclockwise",
    options: DASHBOARD_ROW_BUTTON_STYLES.default,
  }),
  sync: Object.freeze({
    icon: "arrow-clockwise",
    options: DASHBOARD_ROW_BUTTON_STYLES.warning,
  }),
  replace: Object.freeze({
    icon: "arrow-repeat",
    options: DASHBOARD_ROW_BUTTON_STYLES.default,
  }),
  settings: Object.freeze({
    icon: "gear",
    options: DASHBOARD_ROW_BUTTON_STYLES.default,
  }),
  hide: Object.freeze({
    icon: "eye-slash",
    options: DASHBOARD_ROW_BUTTON_STYLES.warning,
  }),
  show: Object.freeze({
    icon: "eye",
    options: DASHBOARD_ROW_BUTTON_STYLES.default,
  }),
});

/**
 * Shared badge colors for table columns.
 * Available keys: yesNo, publicPrivate, disabled.
 * @type {Object}
 */
export const DASHBOARD_BADGES = Object.freeze({
  yesNo: Object.freeze({ true: "bg-success", false: "bg-secondary" }),
  publicPrivate: Object.freeze({ true: "bg-success", false: "bg-danger" }),
  disabled: Object.freeze({ true: "bg-warning text-dark", false: "bg-secondary" }),
});

/**
 * Merge catalog or style options with page overrides.
 *
 * @param {Object} baseOptions - Default options object
 * @param {Object} [overrideOptions] - Page overrides for options
 * @returns {Object} Merged options including deep-merged specifiers
 */
function mergeButtonOptions(baseOptions, overrideOptions = {}) {
  const baseSpecifiers = baseOptions.specifiers || {};
  const overrideSpecifiers = overrideOptions.specifiers || {};
  return {
    ...baseOptions,
    ...overrideOptions,
    specifiers: {
      ...baseSpecifiers,
      ...overrideSpecifiers,
    },
  };
}

/**
 * Build one row-action button for BasicTable from a known action name.
 * Pass page fields like title, action, filter, and stats in overrides.
 *
 * @param {string} kind - One of the DASHBOARD_ROW_ACTIONS keys
 * @param {Object} [overrides] - Extra fields for this button (title, action, filter, stats, ...)
 * @returns {Object} Button config for BasicTable
 * @throws {Error} If kind is not a known row action
 */
export function dashboardRowAction(kind, overrides = {}) {
  const base = DASHBOARD_ROW_ACTIONS[kind];
  if (!base) {
    throw new Error(`Unknown dashboard row action: ${kind}`);
  }

  return {
    ...base,
    ...overrides,
    icon: overrides.icon !== undefined ? overrides.icon : base.icon,
    options: mergeButtonOptions(base.options, overrides.options || {}),
  };
}

/**
 * Build one row button with a custom icon but a shared color style.
 * Use this for page-only actions that are not in DASHBOARD_ROW_ACTIONS.
 *
 * @param {string} icon - Bootstrap icon name
 * @param {Object} [overrides] - Extra fields for this button (title, action, filter, stats, ...)
 * @param {string} [style="default"] - One of: default, danger, warning
 * @returns {Object} Button config for BasicTable
 * @throws {Error} If style is unknown
 */
export function dashboardRowButton(icon, overrides = {}, style = "default") {
  const baseOptions = DASHBOARD_ROW_BUTTON_STYLES[style];
  if (!baseOptions) {
    throw new Error(`Unknown dashboard row button style: ${style}`);
  }

  return {
    icon,
    ...overrides,
    options: mergeButtonOptions(baseOptions, overrides.options || {}),
  };
}

/**
 * Ask for confirmation, then soft-delete the row if the user confirms.
 *
 * @param {Object} deps - Values from the page component
 * @param {Object} deps.confirmRef - ConfirmModal ref (e.g. this.$refs.deleteConf)
 * @param {Object} deps.socket - this.$socket
 * @param {Object} deps.eventBus - this.eventBus (for error toasts)
 * @param {Object} options
 * @param {string} options.table - Table name (e.g. "project")
 * @param {number} options.id - Row id to delete
 * @param {string} options.title - Dialog title (e.g. "Delete Project")
 * @param {string} options.message - Dialog message
 * @param {string|null} [options.warning] - Optional warning under the message
 * @param {string} [options.failTitle] - Toast title if delete fails
 * @param {Function} [options.onSuccess] - Called after a successful delete
 * @param {Function} [options.onFailure] - Called after a failed delete
 * @returns {void}
 */
export function confirmSoftDelete(deps, options) {
  const { confirmRef, socket, eventBus } = deps;
  const {
    table,
    id,
    title,
    message,
    warning = null,
    failTitle = "Delete failed",
    onSuccess,
    onFailure,
  } = options;

  confirmRef.open(title, message, warning, (confirmed) => {
    if (!confirmed) {
      return;
    }

    socket.emit(
      "appDataUpdate",
      {
        table,
        data: {
          id,
          deleted: true,
        },
      },
      (result) => {
        if (!result.success) {
          eventBus.emit("toast", {
            title: failTitle,
            message: result.message,
            variant: "danger",
          });
          if (typeof onFailure === "function") {
            onFailure(result);
          }
          return;
        }

        if (typeof onSuccess === "function") {
          onSuccess(result);
        }
      }
    );
  });
}
