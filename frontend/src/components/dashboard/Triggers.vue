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
      <BasicTable
        :columns="columns"
        :data="triggers"
        :options="dashboardConfig.tableOptions"
        :buttons="buttons"
        :max-table-height="'65vh'"
        @action="onAction"
      />
    </template>
  </Card>

  <StepperModal
    ref="triggerStepper"
    size="lg"
    :steps="dashboardConfig.stepper.steps"
    :submit-text="dashboardConfig.stepper.submitText"
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
    v-if="viewFormData"
    ref="viewModal"
    name="trigger-view"
    size="lg"
  >
    <template #title>
      {{ viewModalTitle }}
    </template>
    <template #body>
      <BasicForm :model-value="viewFormData" :fields="dashboardConfig.modals.view.formSchema" />
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
import rulesDashboard from "@/config/triggerRulesDashboard.js";

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
  },
  data() {
    return {
      dashboardConfig: rulesDashboard,
      triggerForm: {},
      actionData: {},
      editingId: null,
      viewFormData: null,
    };
  },
  computed: {
    projectId() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    },
    columns() {
      return this.dashboardConfig.columns;
    },
    buttons() {
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
    selectedEvent() {
      return this.$store.getters["table/trigger_event/getAll"].find(
        (e) => e.id === this.triggerForm.triggerEventId && e.enabled && !e.deleted
      );
    },
    selectedAction() {
      return this.$store.getters["table/trigger_action/getAll"].find(
        (a) => a.id === this.triggerForm.triggerActionId && a.enabled && !a.deleted
      );
    },
    settingsFields() {
      return this.resolveFormSchema(this.dashboardConfig.stepper.settingsFormSchema);
    },
    eventFields() {
      return [this.resolveField(this.dashboardConfig.stepper.eventField)];
    },
    actionSelectFields() {
      return [this.resolveField(this.dashboardConfig.stepper.actionField, { event: this.selectedEvent })];
    },
    actionConfigFields() {
      const schema = this.selectedAction?.configuration?.formSchema || [];
      return schema.map((field) => this.resolveField(field));
    },
    triggers() {
      const eventsById = Object.fromEntries(
        this.$store.getters["table/trigger_event/getAll"]
          .filter((e) => e.enabled && !e.deleted)
          .map((e) => [e.id, e])
      );
      const actionsById = Object.fromEntries(
        this.$store.getters["table/trigger_action/getAll"]
          .filter((a) => a.enabled && !a.deleted)
          .map((a) => [a.id, a])
      );
      const toggle = this.dashboardConfig.rowResolvers.enabled;
      return this.$store.getters["table/trigger/getAll"]
        .filter((t) => !t.deleted)
        .map((t) => {
          const event = eventsById[t.triggerEventId];
          const action = actionsById[t.triggerActionId];
          return {
            ...t,
            eventLabel: event?.configuration?.label || event?.name || "-",
            actionLabel: action?.configuration?.label || action?.name || "-",
            enabled: {
              title: toggle.title,
              value: t.enabled,
              action: toggle.action,
            },
          };
        });
    },
    viewModalTitle() {
      if (!this.viewFormData) return "Trigger";
      return this.dashboardConfig.modals.view.title.replace("{name}", this.viewFormData.name);
    },
  },
  mounted() {
    this.triggerForm = this.defaultTriggerForm();
  },
  methods: {
    defaultTriggerForm() {
      return {
        ...this.dashboardConfig.defaultForm,
        projectId: this.projectId,
      };
    },
    resolveField(field, context = {}) {
      if (field.options) return field;
      const src = field.optionsSource;
      if (!src) return field;

      let rows = this.$store.getters[`table/${src.table}/getAll`].filter((r) => !r.deleted);

      if (src.filter) {
        rows = rows.filter((r) =>
          Object.entries(src.filter).every(([k, v]) =>
            Array.isArray(v) ? v.includes(r[k]) : r[k] === v
          )
        );
      }

      if (src.compatibleWithEvent && context.event) {
        const provided = new Set(context.event.configuration?.provides || []);
        rows = rows.filter((a) =>
          (a.configuration?.requires || []).every((key) => provided.has(key))
        );
      }

      const options = rows.map((r) => ({
        name: src.labelKey === "configuration.label"
          ? (r.configuration?.label || r.name)
          : r[src.labelKey] || r[src.nameKey] || r.name,
        value: r[src.valueKey],
      }));

      return {
        ...field,
        options: src.emptyOption ? [src.emptyOption, ...options] : options,
      };
    },
    resolveFormSchema(schema) {
      return schema.map((field) => this.resolveField(field));
    },
    onAction(data) {
      const row = data.params;
      const toggle = this.dashboardConfig.rowResolvers.enabled;

      if (data.action === toggle.action) {
        this.$socket.emit(toggle.socketEvent, { id: row.id, enabled: data.value });
        return;
      }

      const actionDef = this.manageActionsByAction[data.action];

      if (actionDef.handler === "viewModal") {
        this.viewFormData = {
          name: row.name,
          eventLabel: row.eventLabel,
          actionLabel: row.actionLabel,
          maxRetries: String(row.maxRetries),
          parallelLimit: String(row.parallelLimit),
          timeout: String(row.timeout),
          configurationJson: JSON.stringify(row.configuration || {}, null, 2),
        };
        this.$refs.viewModal.open();
        return;
      }

      if (actionDef.handler === "editStepper") {
        this.openEdit(row);
        return;
      }

      if (actionDef.handler === "confirmDelete") {
        const { confirm } = actionDef;
        this.$refs.deleteModal.open(
          confirm.title,
          confirm.message.replace("{name}", row.name),
          null,
          (ok) => {
            if (ok) {
              this.$socket.emit(actionDef.socketEvent, { id: row.id });
            }
          }
        );
      }
    },
    openCreate() {
      this.editingId = null;
      this.triggerForm = this.defaultTriggerForm();
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
      const socketEvent = editing
        ? this.dashboardConfig.sockets.update
        : this.dashboardConfig.sockets.create;
      if (editing) {
        payload.id = this.editingId;
      }
      this.$socket.emit(socketEvent, payload, (res) => {
        if (res.success) {
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
            message: res.message || "Unknown error",
            variant: "danger",
          });
        }
      });
    },
  },
};
</script>
