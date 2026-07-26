/**
 * Helper to confirm and soft-delete a dashboard table row.
 *
 * Shows ConfirmModal, then marks the row deleted with appDataUpdate.
 * Uses an arrow callback so `this` stays correct in the page.
 *
 * @author Mohammad Elwan
 */

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
 * @param {string|null} Optional warning under the message
 * @param {string} Toast title if delete fails
 * @param {Function} Called after a successful delete
 * @param {Function} Called after a failed delete
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
