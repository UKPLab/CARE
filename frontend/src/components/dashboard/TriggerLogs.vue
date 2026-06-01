<template>
  <Card title="Trigger logs">
    <template #body>
      <Loading v-if="!dashboardConfig" />
      <BasicTable
        v-else
        :columns="columns"
        :data="logs"
        :options="dashboardConfig.tableOptions"
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
      {{ dashboardConfig.modals.error.title }}
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
      errorFormData: null,
    };
  },
  computed: {
    statusMaps() {
      if (!this.dashboardConfig) return null;
      const keyMapping = {};
      const classMapping = { default: "bg-secondary" };
      const flagByValue = {};
      for (const s of this.dashboardConfig.statuses) {
        keyMapping[s.value] = s.label;
        classMapping[s.value] = s.badgeClass;
        flagByValue[s.value] = s.flags || [];
      }
      return { keyMapping, classMapping, flagByValue };
    },
    columns() {
      if (!this.dashboardConfig) return [];
      return this.dashboardConfig.columns.map((col) => {
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
      if (!this.dashboardConfig) return [];
      return this.dashboardConfig.manageActions.map(
        ({ handler, socketEvent, successToast, errorToast, modal, confirm, filter, ...btn }) => btn
      );
    },
    manageActionsByAction() {
      if (!this.dashboardConfig) return {};
      return Object.fromEntries(
        this.dashboardConfig.manageActions.map((a) => [a.action, a])
      );
    },
    errorFormFields() {
      return this.dashboardConfig.modals.error.formSchema;
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
  mounted() {
    this.$socket.emit("triggerQueueGetDashboardConfig", {}, (res) => {
      if (res.success) {
        this.dashboardConfig = res.data;
      }
    });
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
