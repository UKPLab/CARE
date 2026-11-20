<template>
  <ConfirmModal ref="confirmModal" />
</template>

<script>
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import { confirmSoftDelete } from "@/basic/dashboard/actions.js";
import { resolveApiMessage } from "@/assets/utils";

/**
 * Confirmation dialog for the irreversible assignment actions on the
 * assignments dashboard: closing and deleting. After the user confirms, it
 * applies the change and reports the result as a toast.
 * Permission checks happen on the page before the dialog opens.
 */
export default {
  name: "AssignmentConfirmDialog",
  components: { ConfirmModal },
  methods: {
    /**
     * Ask to close the assignment, then set its close date.
     * @param {Object} assignment - Assignment row
     * @returns {void}
     */
    confirmClose(assignment) {
      this.$refs.confirmModal.open(
        this.$t("assignments.dashboard.confirm.close.title"),
        this.$t("assignments.dashboard.confirm.close.message"),
        "",
        (confirmed) => {
          if (!confirmed) return;

          this.$socket.emit(
            "appDataUpdate",
            {
              table: "assignment",
              data: {
                id: assignment.id,
                closed: new Date().toISOString(),
              },
            },
            (result) => {
              if (result.success) {
                this.eventBus.emit("toast", {
                  title: this.$t("assignments.dashboard.toasts.closeSuccess.title"),
                  message: this.$t("assignments.dashboard.toasts.closeSuccess.message"),
                  variant: "success",
                });
              } else {
                this.eventBus.emit("toast", {
                  title: this.$t("assignments.dashboard.toasts.closeFailed"),
                  message: resolveApiMessage(result),
                  variant: "danger",
                });
              }
            }
          );
        }
      );
    },
    /**
     * Ask to delete the assignment, then soft-delete it.
     * @param {Object} assignment - Assignment row
     * @returns {void}
     */
    confirmDelete(assignment) {
      confirmSoftDelete(
        {
          confirmRef: this.$refs.confirmModal,
          socket: this.$socket,
          eventBus: this.eventBus,
        },
        {
          table: "assignment",
          id: assignment.id,
          title: this.$t("assignments.dashboard.confirm.delete.title"),
          message: this.$t("assignments.dashboard.confirm.delete.message"),
          warning: "",
          failTitle: this.$t("assignments.dashboard.toasts.deleteFailed"),
          onSuccess: () => {
            this.eventBus.emit("toast", {
              title: this.$t("assignments.dashboard.toasts.deleteSuccess.title"),
              message: this.$t("assignments.dashboard.toasts.deleteSuccess.message"),
              variant: "success",
            });
          },
        }
      );
    },
  },
};
</script>
