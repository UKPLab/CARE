<template>
  <Card :title="$t('triggers.logs.title')">
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
import { resolveApiMessage, translateMaybeKey } from "@/assets/utils";

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
      errorFormData: null,
    };
  },
  computed: {
    queueStatuses() {
      return [
        { name: "PENDING", value: 0, label: this.$t("triggers.status.pending"), badgeClass: "bg-secondary", flags: ["canCancel"] },
        { name: "RUNNING", value: 1, label: this.$t("triggers.status.running"), badgeClass: "bg-primary", flags: ["canCancel"] },
        { name: "COMPLETED", value: 2, label: this.$t("triggers.status.completed"), badgeClass: "bg-success", flags: ["canRerun"] },
        { name: "CANCELLED", value: 3, label: this.$t("triggers.status.cancelled"), badgeClass: "bg-warning text-dark", flags: ["canRetry"] },
        { name: "FAILED", value: 4, label: this.$t("triggers.status.failed"), badgeClass: "bg-danger", flags: ["canRetry", "hasError"] },
      ];
    },
    manageActions() {
      return [
        {
          icon: "x-circle",
          title: this.$t("triggers.actions.cancel"),
          action: "cancel",
          handler: "confirmCancel",
          socketEvent: "triggerQueueCancel",
          options: { iconOnly: true, specifiers: { "btn-outline-warning": true } },
          filter: [{ key: "canCancel", value: true }],
          confirm: {
            title: this.$t("triggers.confirm.cancelTitle"),
            message: this.$t("triggers.confirm.cancel", { name: "{triggerName}" }),
          },
          successToast: { title: this.$t("triggers.messages.cancelledTitle"), message: this.$t("triggers.messages.cancelled") },
          errorToast: { title: this.$t("triggers.errors.cancelTitle") },
        },
        {
          icon: "arrow-repeat",
          title: this.$t("triggers.actions.retry"),
          action: "retry",
          handler: "socketCallback",
          socketEvent: "triggerQueueRetry",
          options: { iconOnly: true, specifiers: { "btn-outline-primary": true } },
          filter: [{ key: "canRetry", value: true }],
          successToast: { title: this.$t("triggers.messages.retryQueuedTitle"), message: this.$t("triggers.messages.retryQueued") },
          errorToast: { title: this.$t("triggers.errors.retryTitle") },
        },
        {
          icon: "arrow-repeat",
          title: this.$t("triggers.actions.rerun"),
          action: "rerun",
          handler: "confirmSocket",
          socketEvent: "triggerQueueRerun",
          options: { iconOnly: true, specifiers: { "btn-outline-primary": true } },
          filter: [{ key: "canRerun", value: true }],
          confirm: {
            title: this.$t("triggers.confirm.rerunTitle"),
            message: this.$t("triggers.confirm.rerun", { name: "{triggerName}" }),
          },
          successToast: { title: this.$t("triggers.messages.rerunQueuedTitle"), message: this.$t("triggers.messages.rerunQueued") },
          errorToast: { title: this.$t("triggers.errors.rerunTitle") },
        },
        {
          icon: "exclamation-triangle",
          title: this.$t("triggers.actions.viewError"),
          action: "viewError",
          handler: "errorModal",
          socketEvent: "triggerQueueGetDetails",
          options: { iconOnly: true, specifiers: { "btn-outline-danger": true } },
          filter: [{ key: "hasError", value: true }],
          modal: "error",
        },
      ];
    },
    errorModalTitle() {
      return this.$t("triggers.logs.errorMessageTitle");
    },
    errorFormSchema() {
      return [
        { key: "summary", label: this.$t("triggers.common.trigger"), type: "text", readOnly: true },
        { key: "errorMessage", label: this.$t("triggers.common.error"), type: "textarea", readOnly: true },
      ];
    },
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
    statusFilterOptions() {
      return this.queueStatuses.map((s) => ({ key: s.value, name: s.label }));
    },
    columns() {
      return [
        { name: this.$t("triggers.common.trigger"), key: "triggerName" },
        { name: this.$t("triggers.common.status"), key: "status", type: "badge", badgeFrom: "statuses" },
        { name: this.$t("triggers.logs.attempts"), key: "attemptCount" },
        { name: this.$t("triggers.logs.started"), key: "startedAt", type: "datetime" },
      ].map((col) => {
        if (col.type === "badge" && col.badgeFrom === "statuses") {
          return {
            ...col,
            filter: this.statusFilterOptions,
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
        ({ handler, socketEvent, successToast, errorToast, modal, confirm, ...btn }) => btn
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
      row.triggerName = trigger ? trigger.name : this.$t("triggers.logs.deletedTrigger");

      const statusFlags = flagByValue[item.status] || [];
      row.canRetry = statusFlags.includes("canRetry");
      row.canRerun = statusFlags.includes("canRerun");
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
              summary: `${(!d.trigger?.deleted && d.trigger?.name) || this.$t("triggers.logs.deletedTrigger")} - ${this.statusMaps.keyMapping[d.item.status] || d.statusLabel}`,
              errorMessage: this.resolveStoredError(d.item.errorMessage),
            };
          } else {
            this.$refs.errorModal.close();
            this.toast(actionDef.errorToast.title, resolveApiMessage(res, "triggers.errors.details"), "danger");
          }
        });
        return;
      }

      if (actionDef.handler === "confirmCancel" || actionDef.handler === "confirmSocket") {
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
          this.toast(actionDef.errorToast.title, resolveApiMessage(res, "triggers.errors.action"), "danger");
        }
      });
    },
    toast(title, message, variant) {
      this.eventBus.emit("toast", { title, message: message || this.$t("triggers.errors.unknown"), variant });
    },
    resolveStoredError(value) {
      if (!value) return this.$t("triggers.logs.noErrorMessage");
      try {
        const parsed = JSON.parse(value);
        if (parsed?.key) return resolveApiMessage(parsed);
      } catch (_error) {
        // Legacy trigger failures are stored as plain text or an i18n key.
      }
      return translateMaybeKey(value);
    },
  },
};
</script>
