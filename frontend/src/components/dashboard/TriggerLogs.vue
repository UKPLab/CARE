<template>
  <Card title="Trigger logs">
    <template #body>
      <BasicTable
        :columns="columns"
        :data="logs"
        :options="tableOptions"
        :buttons="buttons"
        :max-table-height="'65vh'"
        @action="onAction"
      />
    </template>
  </Card>

  <BasicModal
    ref="errorModal"
    name="trigger-queue-error"
    size="lg"
  >
    <template #title>
      {{ errorModalTitle }}
    </template>
    <template #body>
      <BasicForm
        v-if="errorFormData"
        :model-value="errorFormData"
        :fields="errorFormSchema"
      />
      <Loading v-else />
    </template>
  </BasicModal>

  <ConfirmModal ref="confirmModal" />
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicTable from "@/basic/Table.vue";
import BasicModal from "@/basic/Modal.vue";
import BasicForm from "@/basic/Form.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import Loading from "@/basic/Loading.vue";

export default {
  name: "DashboardTriggerLogs",
  subscribeTable: ["trigger_queue", "trigger"],
  components: {
    Card,
    BasicTable,
    BasicModal,
    BasicForm,
    ConfirmModal,
    Loading,
  },
  data() {
    return {
      tableOptions: {
        striped: true,
        hover: true,
        pagination: 10,
      },
      queueStatuses: [
        { name: "PENDING", value: 0, label: "Pending", badgeClass: "bg-secondary", flags: ["canCancel"] },
        { name: "RUNNING", value: 1, label: "Running", badgeClass: "bg-primary", flags: ["canCancel"] },
        { name: "COMPLETED", value: 2, label: "Completed", badgeClass: "bg-success", flags: [] },
        { name: "CANCELLED", value: 3, label: "Cancelled", badgeClass: "bg-warning text-dark", flags: ["canRetry"] },
        { name: "FAILED", value: 4, label: "Failed", badgeClass: "bg-danger", flags: ["canRetry", "hasError"] },
      ],
      columnDefs: [
        { name: "Trigger", key: "triggerName" },
        { name: "Status", key: "status", type: "badge", badgeFrom: "statuses" },
        { name: "Attempts", key: "attemptCount" },
        { name: "Started", key: "startedAt", type: "datetime" },
      ],
      manageActions: [
        {
          icon: "x-circle",
          title: "Cancel",
          action: "cancel",
          handler: "confirmCancel",
          socketEvent: "triggerQueueCancel",
          options: { iconOnly: true, specifiers: { "btn-outline-warning": true } },
          filter: [{ key: "canCancel", value: true }],
          confirm: {
            title: "Cancel execution",
            message: 'Cancel this trigger run for "{triggerName}"?',
          },
          successToast: { title: "Cancelled", message: "The trigger execution has been cancelled." },
          errorToast: { title: "Cancel failed" },
        },
        {
          icon: "arrow-repeat",
          title: "Retry",
          action: "retry",
          handler: "socketCallback",
          socketEvent: "triggerQueueRetry",
          options: { iconOnly: true, specifiers: { "btn-outline-primary": true } },
          filter: [{ key: "canRetry", value: true }],
          successToast: { title: "Retry queued", message: "The trigger execution has been set back to pending." },
          errorToast: { title: "Retry failed" },
        },
        {
          icon: "exclamation-triangle",
          title: "View error message",
          action: "viewError",
          handler: "errorModal",
          socketEvent: "triggerQueueGetDetails",
          options: { iconOnly: true, specifiers: { "btn-outline-danger": true } },
          filter: [{ key: "hasError", value: true }],
          modal: "error",
        },
      ],
      errorModalTitle: "Error message",
      errorFormSchema: [
        { key: "summary", label: "Trigger", type: "text", readOnly: true },
        { key: "errorMessage", label: "Error", type: "textarea", readOnly: true },
      ],
      errorFormData: null,
    };
  },
  computed: {
    statusMaps() {
      const keyMapping = {};
      const classMapping = { default: "bg-secondary" };
      const flagByValue = {};
      for (const s of this.queueStatuses) {
        keyMapping[s.value] = s.label;
        classMapping[s.value] = s.badgeClass;
        flagByValue[s.value] = s.flags || [];
      }
      return { keyMapping, classMapping, flagByValue };
    },
    columns() {
      return this.columnDefs.map((col) => {
        if (col.type === "badge" && col.badgeFrom === "statuses") {
          return {
            ...col,
            typeOptions: {
              keyMapping: this.statusMaps.keyMapping,
              classMapping: this.statusMaps.classMapping,
            },
          };
        }
        return { ...col };
      });
    },
    buttons() {
      return this.manageActions.map(
        ({ handler, socketEvent, successToast, errorToast, modal, confirm, filter, ...btn }) => btn
      );
    },
    manageActionsByAction() {
      return Object.fromEntries(this.manageActions.map((a) => [a.action, a]));
    },
    logs() {
      const triggersById = Object.fromEntries(
        this.$store.getters["table/trigger/getAll"]
          .filter((t) => !t.deleted)
          .map((t) => [t.id, t])
      );
      return this.$store.getters["table/trigger_queue/getAll"].map((item) =>
        this.enrichLogRow(item, triggersById)
      );
    },
  },
  methods: {
    enrichLogRow(item, triggersById) {
      const { flagByValue } = this.statusMaps;
      const row = { ...item };
      const trigger = triggersById[item.triggerId];
      row.triggerName = trigger ? trigger.name : `#${item.triggerId}`;

      const statusFlags = flagByValue[item.status] || [];
      row.canRetry = statusFlags.includes("canRetry");
      row.hasError = statusFlags.includes("hasError") || !!item.errorMessage;
      row.canCancel = statusFlags.includes("canCancel");

      return row;
    },
    onAction(data) {
      const row = data.params;
      const actionDef = this.manageActionsByAction[data.action];

      if (actionDef.handler === "errorModal") {
        this.errorFormData = null;
        this.$refs.errorModal.open();
        this.$socket.emit(actionDef.socketEvent, { id: row.id }, (res) => {
          if (res.success) {
            const d = res.data;
            this.errorFormData = {
              summary: `${d.trigger.name} — ${d.statusLabel}`,
              errorMessage: d.item.errorMessage || "No error message recorded.",
            };
          } else {
            this.$refs.errorModal.close();
            this.toast(actionDef.errorToast.title, res.message, "danger");
          }
        });
        return;
      }

      if (actionDef.handler === "confirmCancel") {
        const { confirm } = actionDef;
        this.$refs.confirmModal.open(
          confirm.title,
          confirm.message.replace("{triggerName}", row.triggerName),
          null,
          (ok) => {
            if (ok) {
              this.emitSocket(actionDef.socketEvent, { id: row.id }, actionDef);
            }
          }
        );
        return;
      }

      if (actionDef.handler === "socketCallback") {
        this.emitSocket(actionDef.socketEvent, { id: row.id }, actionDef);
      }
    },
    emitSocket(event, payload, actionDef) {
      this.$socket.emit(event, payload, (res) => {
        if (res.success && actionDef.successToast) {
          this.toast(actionDef.successToast.title, actionDef.successToast.message, "success");
        } else if (!res.success) {
          this.toast(actionDef.errorToast.title, res.message, "danger");
        }
      });
    },
    toast(title, message, variant) {
      this.eventBus.emit("toast", { title, message: message || "Unknown error", variant });
    },
  },
};
</script>
