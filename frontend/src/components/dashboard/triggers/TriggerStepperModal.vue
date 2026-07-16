<template>
  <StepperModal
    ref="stepper"
    size="lg"
    :steps="STEPPER_STEPS"
    submit-text="Save"
    :validation="stepValid"
    @submit="save"
  >
    <template #title>
      <h5 class="modal-title">{{ editingId ? "Edit trigger" : "Create trigger" }}</h5>
    </template>
    <template #step-1>
      <BasicForm
        v-model="triggerForm"
        :fields="settingsFields"
      />
    </template>
    <template #step-2>
      <TriggerEventStep
        v-model="triggerForm"
        v-model:event-data="eventData"
        :event-fields="eventFields"
        :config-fields="eventConfigFields"
      />
    </template>
    <template #step-3>
      <TriggerActionStep
        v-model="triggerForm"
        v-model:action-data="actionData"
        :select-fields="actionSelectFields"
        :config-fields="actionConfigFields"
        :component-fields="actionComponentFields"
        :validation-configuration-ids="validationConfigurationIds"
        :selected="!!selectedAction"
        @validity="actionStepValid = $event"
      />
    </template>
    <template #step-4>
      <TriggerReviewStep
        :trigger-form="triggerForm"
        :event-data="eventData"
        :action-data="actionData"
        :settings-fields="settingsFields"
        :event-fields="[...eventFields, ...eventConfigFields]"
        :action-fields="[...actionSelectFields, ...actionConfigFields]"
        :preprocessing-action="isPreprocessingAction"
      />
    </template>
  </StepperModal>

  <TriggerViewModal ref="viewModal" />
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicForm from "@/basic/Form.vue";
import TriggerEventStep from "./TriggerEventStep.vue";
import TriggerActionStep from "./TriggerActionStep.vue";
import TriggerReviewStep from "./TriggerReviewStep.vue";
import TriggerViewModal from "./TriggerViewModal.vue";

const STEPPER_STEPS = [
  { title: "Trigger info" },
  { title: "Event" },
  { title: "Action" },
  { title: "Review & Confirm" },
];

const SETTINGS_FORM_SCHEMA = [
  {
    key: "name",
    label: "Name",
    type: "text",
    required: true,
    help: "Display name for this trigger rule in the Triggers dashboard.",
  },
  {
    key: "description",
    label: "Description",
    type: "textarea",
    required: true,
    help: "Short note for admins describing when and why this trigger runs.",
  },
  {
    key: "projectId",
    label: "Scope to project",
    type: "select",
    required: true,
    help: "Limits this trigger to the selected project. Event filters and assignment options use this project.",
    optionsSource: { table: "project", labelKey: "name", valueKey: "id" },
  },
  {
    key: "maxRetries",
    label: "Max retries",
    type: "number",
    min: 0,
    required: true,
    help: "How many times a failed run may be retried from the trigger logs before it stays failed.",
  },
  {
    key: "parallelLimit",
    label: "Parallel limit",
    type: "number",
    min: 1,
    required: true,
    help: "Maximum number of executions of this trigger that may run at the same time.",
  },
  {
    key: "timeout",
    label: "Timeout (seconds)",
    type: "number",
    min: 1,
    required: true,
    help: "Maximum seconds a single execution may run before it is treated as timed out.",
  },
];

const EVENT_FIELD = {
  key: "triggerEventId",
  label: "When (event)",
  type: "select",
  required: true,
  optionsSource: {
    table: "trigger_event",
    labelKey: "configuration.label",
    nameKey: "name",
    valueKey: "id",
    filter: { enabled: true },
  },
};

const ACTION_FIELD = {
  key: "triggerActionId",
  label: "Then (action)",
  type: "select",
  required: true,
  optionsSource: {
    table: "trigger_action",
    labelKey: "configuration.label",
    nameKey: "name",
    valueKey: "id",
    filter: { enabled: true },
    compatibleWithEvent: true,
  },
};

const DEFAULT_FORM = {
  name: "",
  description: "",
  projectId: null,
  maxRetries: 3,
  parallelLimit: 1,
  timeout: 300,
  triggerEventId: null,
  triggerActionId: null,
};

export default {
  name: "TriggerStepperModal",
  subscribeTable: ["trigger_event", "trigger_action", "project", "template", "assignment", "configuration"],
  components: {
    StepperModal,
    BasicForm,
    TriggerEventStep,
    TriggerActionStep,
    TriggerReviewStep,
    TriggerViewModal,
  },
  emits: ["saved"],
  data() {
    return {
      STEPPER_STEPS,
      triggerForm: {},
      eventData: {},
      actionData: {},
      actionStepValid: false,
      editingId: null,
    };
  },
  computed: {
    selectedEvent() {
      return this.findCatalog("trigger_event", this.triggerForm.triggerEventId);
    },
    selectedAction() {
      return this.findCatalog("trigger_action", this.triggerForm.triggerActionId);
    },
    isPreprocessingAction() {
      return this.selectedAction?.configuration?.handler === "nlp_preprocess";
    },
    settingsFields() {
      return SETTINGS_FORM_SCHEMA.map((field) => this.resolveField(field));
    },
    eventFields() {
      return [this.resolveField(EVENT_FIELD)];
    },
    eventConfigFields() {
      return (this.selectedEvent?.configuration?.formSchema || [])
        .map((field) => this.resolveField(field));
    },
    actionSelectFields() {
      return [this.resolveField(ACTION_FIELD, { event: this.selectedEvent })];
    },
    actionConfigFields() {
      return (this.selectedAction?.configuration?.formSchema || [])
        .map((field) => this.resolveField(field));
    },
    actionComponentFields() {
      return this.selectedAction?.configuration?.componentSchema || [];
    },
    validationConfigurationIds() {
      const assignmentId = this.eventData.assignmentId;
      if (!assignmentId) return [];
      const id = this.$store.getters["table/assignment/get"](Number(assignmentId))
        ?.validationConfigurationId;
      return id != null ? [id] : [];
    },
    stepValid() {
      return [
        this.isConfigValid(this.triggerForm, this.settingsFields),
        !!this.selectedEvent && this.isConfigValid(
          { ...this.triggerForm, ...this.eventData },
          [...this.eventFields, ...this.eventConfigFields]
        ),
        this.actionStepValid,
        true,
      ];
    },
  },
  watch: {
    "triggerForm.triggerEventId"(next, prev) {
      if (prev != null && next !== prev) this.eventData = {};
    },
    "triggerForm.triggerActionId"(next, prev) {
      if (prev != null && next !== prev) this.actionData = {};
    },
    "eventData.assignmentId"(next, prev) {
      if (prev != null && next !== prev) {
        this.actionData = {
          ...this.actionData,
          baseFiles: {},
          validationConfigurationNames: {},
        };
      }
    },
  },
  methods: {
    sameValue(a, b) {
      return a == null || b == null ? a === b : String(a) === String(b);
    },
    findCatalog(table, id) {
      return this.$store.getters[`table/${table}/getAll`].find(
        (row) => this.sameValue(row.id, id) && row.enabled && !row.deleted
      );
    },
    isFilled(value) {
      if (value == null || value === "") return false;
      if (typeof value === "string") return value.trim() !== "";
      return typeof value !== "number" || !Number.isNaN(value);
    },
    isConfigValid(data, fields) {
      return fields.every((field) => {
        if (field.optionsSource && !field.options?.length) return false;
        const value = data[field.key];
        if (field.required && !this.isFilled(value)) return false;
        if (field.type !== "number" || !this.isFilled(value)) return true;
        const number = Number(value);
        return Number.isFinite(number)
          && (field.min == null || number >= Number(field.min))
          && (field.max == null || number <= Number(field.max));
      });
    },
    resolveField(field, context = {}) {
      if (field.options || !field.optionsSource) return field;
      const src = field.optionsSource;
      let rows = this.$store.getters[`table/${src.table}/getAll`].filter((r) => !r.deleted);

      if (src.filter) {
        rows = rows.filter((r) =>
          Object.entries(src.filter).every(([k, v]) =>
            Array.isArray(v) ? v.includes(r[k]) : r[k] === v
          )
        );
      }

      if (src.filterFromForm) {
        rows = rows.filter((r) =>
          Object.entries(src.filterFromForm).every(([k, formKey]) => {
            const val = this.triggerForm[formKey];
            return val == null || this.sameValue(r[k], val);
          })
        );
      }

      if (src.compatibleWithEvent && context.event) {
        const provided = new Set(context.event.configuration?.provides || []);
        rows = rows.filter((a) =>
          (a.configuration?.requires || []).every((key) => provided.has(key))
        );
      }

      return {
        ...field,
        options: rows.map((r) => ({
          name: src.labelKey === "configuration.label"
            ? (r.configuration?.label || r.name)
            : r[src.labelKey] || r[src.nameKey] || r.name,
          value: r[src.valueKey],
        })),
      };
    },
    resetEditor({ editingId = null, triggerForm, eventData = {}, actionData = {} }) {
      this.editingId = editingId;
      this.triggerForm = triggerForm;
      this.eventData = { ...eventData };
      this.actionData = { ...actionData };
      this.actionStepValid = false;
    },
    openCreate(projectId) {
      this.resetEditor({ triggerForm: { ...DEFAULT_FORM, projectId } });
      this.$refs.stepper.open();
    },
    openView(row) {
      this.$refs.viewModal.open(row);
    },
    openEdit(row) {
      const config = row.configuration || {};
      this.resetEditor({
        editingId: row.id,
        triggerForm: {
          name: row.name,
          description: config.description || "",
          projectId: row.projectId ?? null,
          maxRetries: row.maxRetries,
          parallelLimit: row.parallelLimit,
          timeout: row.timeout,
          triggerEventId: row.triggerEventId,
          triggerActionId: row.triggerActionId,
        },
        eventData: config.event,
        actionData: config.action,
      });
      this.$refs.stepper.open();
    },
    save() {
      const editing = this.editingId !== null;
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
          event: this.eventData,
          action: this.actionData,
        },
      };
      if (editing) payload.id = this.editingId;

      this.$refs.stepper.setWaiting(true);
      this.$socket.emit(editing ? "triggerUpdate" : "triggerCreate", payload, (res) => {
        this.$refs.stepper.setWaiting(false);
        if (res.success) {
          this.$refs.stepper.close();
          this.editingId = null;
          this.$emit("saved", { editing });
        }
        this.eventBus.emit("toast", {
          title: res.success
            ? (editing ? "Trigger updated" : "Trigger created")
            : (editing ? "Failed to update trigger" : "Failed to create trigger"),
          message: res.success
            ? `The trigger has been ${editing ? "updated" : "created"} successfully.`
            : (res.message || "Unknown error"),
          variant: res.success ? "success" : "danger",
        });
      });
    },
  },
};
</script>
