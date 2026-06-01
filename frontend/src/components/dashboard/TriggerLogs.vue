<template>
  <Card title="Trigger logs">
    <template #body>
      <Loading v-if="!dashboardConfig" />
      <BasicTable
        v-else
        :columns="columns"
        :data="logs"
        :options="options"
        :buttons="buttons"
        :max-table-height="'65vh'"
        @action="onAction"
      />
    </template>
  </Card>

  <BasicModal
    v-if="dashboardConfig"
    ref="errorModal"
    name="trigger-queue-error"
    size="lg"
  >
    <template #title>
      {{ (errorModalConfig && errorModalConfig.title) || "Error message" }}
    </template>
    <template #body>
      <BasicForm
        v-if="errorFormData"
        :model-value="errorFormData"
        :fields="errorFormFields"
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
import {
  buildColumns,
  buildManageButtons,
  buildStatusTypeOptions,
  enrichRow,
  detailsToErrorForm,
  resolveFormSchema,
} from "@/utils/triggerDashboard.js";

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
      dashboardConfig: null,
      statusTypeOptions: null,
      errorFormData: null,
    };
  },
  computed: {
    options() {
      return (this.dashboardConfig && this.dashboardConfig.tableOptions) || {};
    },
    columns() {
      if (!this.dashboardConfig || !this.statusTypeOptions) return [];
      return buildColumns(this.dashboardConfig.columns, this.statusTypeOptions);
    },
    buttons() {
      if (!this.dashboardConfig) return [];
      return buildManageButtons(this.dashboardConfig.manageActions);
    },
    manageActionsByAction() {
      if (!this.dashboardConfig) return {};
      return Object.fromEntries(
        this.dashboardConfig.manageActions.map((a) => [a.action, a])
      );
    },
    errorModalConfig() {
      return this.dashboardConfig && this.dashboardConfig.modals
        ? { ...this.dashboardConfig.modals.error, name: "trigger-queue-error" }
        : null;
    },
    errorFormFields() {
      if (!this.errorModalConfig) return [];
      return resolveFormSchema(this.errorModalConfig.formSchema || [], this.$store);
    },
    logs() {
      if (!this.dashboardConfig || !this.statusTypeOptions) return [];
      return (this.$store.getters["table/trigger_queue/getAll"] || []).map((item) =>
        enrichRow(item, this.dashboardConfig, this.$store, this.statusTypeOptions)
      );
    },
  },
  mounted() {
    this.$socket.emit("triggerQueueGetDashboardConfig", {}, (res) => {
      if (res && res.success) {
        this.dashboardConfig = res.data;
        this.statusTypeOptions = buildStatusTypeOptions(res.data.statuses);
      }
    });
  },
  methods: {
    onAction(data) {
      const row = data.params;
      const actionDef = this.manageActionsByAction[data.action];
      if (!actionDef) return;

      if (actionDef.handler === "errorModal") {
        this.openErrorModal(row.id, actionDef);
        return;
      }
      if (actionDef.handler === "confirmCancel") {
        this.confirmCancel(row, actionDef);
        return;
      }
      if (actionDef.handler === "socketCallback" && actionDef.socketEvent) {
        this.emitSocket(actionDef.socketEvent, { id: row.id }, actionDef);
      }
    },
    confirmCancel(row, actionDef) {
      const msg = (actionDef.confirm && actionDef.confirm.message)
        ? actionDef.confirm.message.replace("{triggerName}", row.triggerName || "")
        : "Cancel this trigger run?";
      this.$refs.confirmModal.open(
        (actionDef.confirm && actionDef.confirm.title) || "Cancel execution",
        msg,
        null,
        (confirmed) => {
          if (confirmed && actionDef.socketEvent) {
            this.emitSocket(actionDef.socketEvent, { id: row.id }, actionDef);
          }
        }
      );
    },
    openErrorModal(id, actionDef) {
      this.errorFormData = null;
      this.$refs.errorModal.open();
      this.$socket.emit(actionDef.socketEvent, { id }, (res) => {
        if (res && res.success) {
          this.errorFormData = detailsToErrorForm(res.data);
        } else {
          this.$refs.errorModal.close();
          this.showToast(actionDef.errorToast?.title || "Failed to load error", res?.message, "danger");
        }
      });
    },
    emitSocket(event, payload, actionDef) {
      this.$socket.emit(event, payload, (res) => {
        if (res && res.success) {
          if (actionDef.successToast) {
            this.showToast(actionDef.successToast.title, actionDef.successToast.message, "success");
          }
        } else {
          this.showToast(
            actionDef.errorToast?.title || "Action failed",
            res?.message,
            "danger"
          );
        }
      });
    },
    showToast(title, message, variant) {
      this.eventBus.emit("toast", {
        title,
        message: message || "Unknown error",
        variant,
      });
    },
  },
};
</script>
