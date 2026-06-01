<template>
  <Card title="Triggers">
    <template #headerElements>
      <BasicButton
        class="btn-primary btn-sm"
        text="Create trigger"
        title="Create a new trigger rule"
        icon="plus"
        @click="openCreate"
      />
    </template>
    <template #body>
      <Loading v-if="!dashboardConfig" />
      <BasicTable
        v-else
        :columns="columns"
        :data="triggers"
        :options="options"
        :buttons="buttons"
        :max-table-height="'65vh'"
        @action="onAction"
      />
    </template>
  </Card>

  <StepperModal
    v-if="dashboardConfig"
    ref="triggerStepper"
    size="lg"
    :steps="steps"
    :submit-text="stepperSubmitText"
    @submit="save"
  >
    <template #title>
      <h5 class="modal-title">{{ editingId ? "Edit trigger" : "Create trigger" }}</h5>
    </template>
    <template #step-1>
      <BasicForm v-model="triggerForm" :fields="settingsFields" />
    </template>
    <template #step-2>
      <BasicForm v-model="triggerForm" :fields="eventFields" />
    </template>
    <template #step-3>
      <BasicForm v-model="triggerForm" :fields="actionSelectFields" />
      <hr v-if="actionConfigFields.length" />
      <BasicForm
        v-if="actionConfigFields.length"
        v-model="actionData"
        :fields="actionConfigFields"
      />
    </template>
  </StepperModal>

  <ConfirmModal ref="deleteModal" />

  <BasicModal
    v-if="viewModalConfig"
    ref="viewModal"
    name="trigger-view"
    size="lg"
  >
    <template #title>
      {{ viewModalTitle }}
    </template>
    <template #body>
      <BasicForm
        v-if="viewFormData"
        :model-value="viewFormData"
        :fields="viewFormFields"
      />
    </template>
  </BasicModal>
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicForm from "@/basic/Form.vue";
import BasicModal from "@/basic/Modal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import Loading from "@/basic/Loading.vue";
import {
  buildColumns,
  buildManageButtons,
  enrichRow,
  resolveFormFieldOptions,
  resolveFormSchema,
  rowToViewForm,
} from "@/utils/triggerDashboard.js";

export default {
  name: "DashboardTriggers",
  subscribeTable: ["trigger", "trigger_event", "trigger_action", "project", "template"],
  components: {
    Card,
    BasicTable,
    BasicButton,
    StepperModal,
    BasicForm,
    BasicModal,
    ConfirmModal,
    Loading,
  },
  data() {
    return {
      dashboardConfig: null,
      triggerForm: {},
      actionData: {},
      editingId: null,
      viewFormData: null,
    };
  },
  computed: {
    options() {
      return (this.dashboardConfig && this.dashboardConfig.tableOptions) || {};
    },
    columns() {
      if (!this.dashboardConfig) return [];
      return buildColumns(this.dashboardConfig.columns, { keyMapping: {}, classMapping: {} });
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
    stepper() {
      return (this.dashboardConfig && this.dashboardConfig.stepper) || {};
    },
    steps() {
      return this.stepper.steps || [];
    },
    stepperSubmitText() {
      return this.stepper.submitText || "Save";
    },
    events() {
      return (this.$store.getters["table/trigger_event/getAll"] || [])
        .filter((e) => e.enabled && !e.deleted);
    },
    selectedEvent() {
      return this.events.find((e) => e.id === this.triggerForm.triggerEventId);
    },
    selectedAction() {
      const actions = this.$store.getters["table/trigger_action/getAll"] || [];
      return actions.find((a) => a.id === this.triggerForm.triggerActionId);
    },
    settingsFields() {
      if (!this.stepper.settingsFormSchema) return [];
      return resolveFormSchema(this.stepper.settingsFormSchema, this.$store);
    },
    eventFields() {
      if (!this.stepper.eventField) return [];
      return [resolveFormFieldOptions(this.stepper.eventField, this.$store, {
        event: this.selectedEvent,
      })];
    },
    actionSelectFields() {
      if (!this.stepper.actionField) return [];
      return [resolveFormFieldOptions(this.stepper.actionField, this.$store, {
        event: this.selectedEvent,
      })];
    },
    actionConfigFields() {
      const schema = (this.selectedAction && this.selectedAction.configuration
        && this.selectedAction.configuration.formSchema) || [];
      return schema.map((field) => resolveFormFieldOptions(field, this.$store));
    },
    triggers() {
      if (!this.dashboardConfig) return [];
      const emptyStatus = { keyMapping: {}, classMapping: {}, flagByValue: {} };
      return this.$store.getters["table/trigger/getAll"]
        .filter((t) => !t.deleted)
        .map((t) => enrichRow(t, this.dashboardConfig, this.$store, emptyStatus));
    },
    viewModalConfig() {
      return this.dashboardConfig && this.dashboardConfig.modals
        ? this.dashboardConfig.modals.view
        : null;
    },
    viewModalTitle() {
      if (!this.viewModalConfig || !this.viewFormData) return "Trigger";
      return (this.viewModalConfig.title || "Trigger").replace("{name}", this.viewFormData.name);
    },
    viewFormFields() {
      if (!this.viewModalConfig) return [];
      return resolveFormSchema(this.viewModalConfig.formSchema || [], this.$store);
    },
    sockets() {
      return (this.dashboardConfig && this.dashboardConfig.sockets) || {};
    },
  },
  mounted() {
    this.$socket.emit("triggerRulesGetDashboardConfig", {}, (res) => {
      if (res && res.success) {
        this.dashboardConfig = res.data;
        this.triggerForm = { ...res.data.defaultForm };
      }
    });
  },
  methods: {
    onAction(data) {
      const row = data.params;
      const toggleResolver = this.dashboardConfig && this.dashboardConfig.rowResolvers
        ? this.dashboardConfig.rowResolvers.enabled
        : null;
      if (toggleResolver && data.action === toggleResolver.action) {
        this.$socket.emit(toggleResolver.socketEvent, { id: row.id, enabled: data.value });
        return;
      }

      const actionDef = this.manageActionsByAction[data.action];
      if (!actionDef) return;

      switch (actionDef.handler) {
        case "viewModal":
          this.viewFormData = rowToViewForm(row);
          this.$refs.viewModal.open();
          break;
        case "editStepper":
          this.openEdit(row);
          break;
        case "confirmDelete":
          this.confirmDelete(row, actionDef);
          break;
        default:
          break;
      }
    },
    confirmDelete(row, actionDef) {
      const msg = (actionDef.confirm && actionDef.confirm.message)
        ? actionDef.confirm.message.replace("{name}", row.name)
        : `Delete "${row.name}"?`;
      this.$refs.deleteModal.open(
        (actionDef.confirm && actionDef.confirm.title) || "Delete",
        msg,
        null,
        (confirmed) => {
          if (confirmed && actionDef.socketEvent) {
            this.$socket.emit(actionDef.socketEvent, { id: row.id });
          }
        }
      );
    },
    openCreate() {
      this.editingId = null;
      this.triggerForm = { ...(this.dashboardConfig && this.dashboardConfig.defaultForm) };
      this.actionData = {};
      this.$refs.triggerStepper.open();
    },
    openEdit(row) {
      this.editingId = row.id;
      const config = row.configuration || {};
      this.triggerForm = {
        name: row.name,
        description: config.description || "",
        projectId: row.projectId || null,
        maxRetries: row.maxRetries,
        parallelLimit: row.parallelLimit,
        timeout: row.timeout,
        triggerEventId: row.triggerEventId,
        triggerActionId: row.triggerActionId,
      };
      this.actionData = config.action || {};
      this.$refs.triggerStepper.open();
    },
    save() {
      const payload = {
        name: this.triggerForm.name,
        triggerEventId: this.triggerForm.triggerEventId,
        triggerActionId: this.triggerForm.triggerActionId,
        projectId: this.triggerForm.projectId,
        maxRetries: Number(this.triggerForm.maxRetries),
        parallelLimit: Number(this.triggerForm.parallelLimit),
        timeout: Number(this.triggerForm.timeout),
        configuration: {
          description: this.triggerForm.description,
          action: this.actionData,
        },
      };
      const editing = this.editingId !== null;
      const event = editing ? this.sockets.update : this.sockets.create;
      if (editing) {
        payload.id = this.editingId;
      }
      this.$socket.emit(event, payload, (res) => {
        if (res && res.success) {
          this.$refs.triggerStepper.close();
          this.editingId = null;
          this.eventBus.emit("toast", {
            title: editing ? "Trigger updated" : "Trigger created",
            message: `The trigger has been ${editing ? "updated" : "created"} successfully.`,
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: editing ? "Failed to update trigger" : "Failed to create trigger",
            message: (res && res.message) || "Unknown error",
            variant: "danger",
          });
        }
      });
    },
  },
};
</script>
