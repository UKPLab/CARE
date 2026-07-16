<template>
  <StepperModal
    ref="stepper"
    size="lg"
    :steps="stepperSteps"
    submit-text="Save"
    :validation="stepValid"
    @submit="save"
  >
    <template #title>
      <h5 class="modal-title">{{ editingId ? "Edit trigger" : "Create trigger" }}</h5>
    </template>
    <template #step-1>
      <TriggerSettingsStep
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
        :should-render-component="shouldRenderActionComponent"
        @skill-selection="updateSkillSelection"
        @input-mappings="updateInputMappings"
        @selected-files="updateSelectedFiles"
        @base-files="updateBaseFiles"
        @component-validity="setComponentValidity"
        @validation-configurations="updateValidationConfigurationNames"
      />
    </template>
    <template #step-4>
      <TriggerReviewStep :sections="reviewSummarySections" />
    </template>
  </StepperModal>

  <BasicModal
    ref="viewModal"
    name="trigger-view"
    size="lg"
  >
    <template #title>
      {{ viewModalTitle }}
    </template>
    <template #body>
      <template v-if="viewFormData">
        <dl class="row small mb-0">
          <template
            v-for="item in viewDetailRows"
            :key="item.key"
          >
            <dt class="col-sm-4">
              {{ item.label }}
            </dt>
            <dd class="col-sm-8 text-break">
              <span
                v-if="item.type === 'badge'"
                class="badge"
                :class="item.class"
              >
                {{ item.value }}
              </span>
              <span v-else>{{ item.value }}</span>
            </dd>
          </template>
        </dl>

        <pre
          v-if="viewConfigurationJson"
          class="bg-light border rounded p-2 small text-break mt-3 mb-0"
        >{{ viewConfigurationJson }}</pre>
      </template>
    </template>
    <template #footer>
      <BasicButton
        title="Close"
        class="btn btn-secondary"
        @click="$refs.viewModal.close()"
      />
    </template>
  </BasicModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import TriggerSettingsStep from "./TriggerSettingsStep.vue";
import TriggerEventStep from "./TriggerEventStep.vue";
import TriggerActionStep from "./TriggerActionStep.vue";
import TriggerReviewStep from "./TriggerReviewStep.vue";

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
    optionsSource: {
      table: "project",
      labelKey: "name",
      valueKey: "id",
    },
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

const SOCKET_EVENTS = {
  create: "triggerCreate",
  update: "triggerUpdate",
};

export default {
  name: "TriggerStepperModal",
  subscribeTable: ["trigger_event", "trigger_action", "project", "template", "assignment", "configuration"],
  components: {
    StepperModal,
    BasicModal,
    BasicButton,
    TriggerSettingsStep,
    TriggerEventStep,
    TriggerActionStep,
    TriggerReviewStep,
  },
  emits: ["saved"],
  data() {
    return {
      stepperSteps: STEPPER_STEPS,
      triggerForm: {},
      eventData: {},
      actionData: {},
      componentValidity: {},
      editingId: null,
      viewModalTitleTemplate: "Trigger: {name}",
      viewFormData: null,
    };
  },
  computed: {
    viewModalTitle() {
      if (!this.viewFormData) return "Trigger";
      return this.viewModalTitleTemplate.replace("{name}", this.viewFormData.name);
    },
    viewDetailRows() {
      if (!this.viewFormData) return [];
      return [
        { key: "description", label: "Description", value: this.viewFormData.description || "-" },
        {
          key: "status",
          label: "Status",
          value: this.viewFormData.enabled ? "Enabled" : "Disabled",
          type: "badge",
          class: this.viewFormData.enabled ? "bg-success" : "bg-secondary",
        },
        { key: "event", label: "Event", value: this.viewFormData.eventLabel },
        { key: "action", label: "Action", value: this.viewFormData.actionLabel },
        { key: "project", label: "Project", value: this.viewFormData.projectLabel },
        { key: "maxRetries", label: "Max retries", value: this.viewFormData.maxRetries },
        { key: "parallelLimit", label: "Parallel limit", value: this.viewFormData.parallelLimit },
        { key: "timeout", label: "Timeout", value: `${this.viewFormData.timeout} seconds` },
      ];
    },
    viewConfigurationJson() {
      if (!this.viewFormData) return "";
      return this.formatJson(this.viewFormData.configuration);
    },
    selectedEvent() {
      return this.$store.getters["table/trigger_event/getAll"].find(
        (e) => this.sameValue(e.id, this.triggerForm.triggerEventId) && e.enabled && !e.deleted
      );
    },
    selectedAction() {
      return this.$store.getters["table/trigger_action/getAll"].find(
        (a) => this.sameValue(a.id, this.triggerForm.triggerActionId) && a.enabled && !a.deleted
      );
    },
    isPreprocessingAction() {
      return this.selectedAction?.configuration?.handler === "nlp_preprocess";
    },
    settingsFields() {
      return this.resolveFormSchema(SETTINGS_FORM_SCHEMA);
    },
    eventFields() {
      return [this.resolveField(EVENT_FIELD)];
    },
    eventConfigFields() {
      const schema = this.selectedEvent?.configuration?.formSchema || [];
      return schema.map((field) => this.resolveField(field));
    },
    actionSelectFields() {
      return [this.resolveField(ACTION_FIELD, { event: this.selectedEvent })];
    },
    actionConfigFields() {
      const schema = this.selectedAction?.configuration?.formSchema || [];
      return schema.map((field) => this.resolveField(field));
    },
    actionComponentFields() {
      return this.selectedAction?.configuration?.componentSchema || [];
    },
    inputMappings() {
      return this.actionData.inputMappings || {};
    },
    inputMappingEntries() {
      return Object.entries(this.inputMappings).filter(([key]) => key !== "output");
    },
    requireValidation() {
      const baseFileParameter = this.getBaseFileParameter(this.inputMappings);
      return baseFileParameter
        ? this.inputMappings[baseFileParameter]?.type === "submission"
        : false;
    },
    validationConfigurationIds() {
      const assignmentId = this.eventData.assignmentId;
      if (!assignmentId) return [];
      const assignment = this.$store.getters["table/assignment/get"](Number(assignmentId));
      return assignment?.validationConfigurationId != null
        ? [assignment.validationConfigurationId]
        : [];
    },
    hasTableBasedParameter() {
      return this.inputMappingEntries.some(([, mapping]) => mapping?.requiresTableSelection);
    },
    hasValidInputMappings() {
      return this.inputMappingEntries.length > 0
        && this.inputMappingEntries.every(([, mapping]) => !!mapping);
    },
    reviewSummarySections() {
      return [
        {
          title: "Trigger info",
          items: this.reviewItemsForFields(this.settingsFields, this.triggerForm),
        },
        {
          title: "Event",
          items: this.reviewItemsForFields(
            [...this.eventFields, ...this.eventConfigFields],
            { ...this.triggerForm, ...this.eventData }
          ),
        },
        {
          title: "Action",
          items: this.isPreprocessingAction
            ? this.reviewItemsForPreprocessingAction()
            : this.reviewItemsForFields(
                [...this.actionSelectFields, ...this.actionConfigFields],
                { ...this.triggerForm, ...this.actionData }
              ),
        },
      ];
    },
    stepValid() {
      return [
        this.isStepSettingsValid(),
        this.isStepEventValid(),
        this.isStepActionValid(),
        true,
      ];
    },
  },
  watch: {
    "triggerForm.triggerEventId"(newVal, oldVal) {
      this.resetStepConfig(oldVal, newVal, "eventData");
    },
    "triggerForm.triggerActionId"(newVal, oldVal) {
      this.resetStepConfig(oldVal, newVal, "actionData");
      this.componentValidity = {};
    },
    "eventData.assignmentId"(newVal, oldVal) {
      if (oldVal != null && newVal !== oldVal) {
        this.updateActionData({
          baseFiles: {},
          validationConfigurationNames: {},
        });
        this.componentValidity = {};
      }
    },
  },
  methods: {
    sameValue(a, b) {
      if (a == null || b == null) return a === b;
      return String(a) === String(b);
    },
    formatJson(value) {
      if (!value || typeof value !== "object" || Object.keys(value).length === 0) return "";
      try {
        return JSON.stringify(value, null, 2);
      } catch (_error) {
        return "";
      }
    },
    getProjectLabel(projectId) {
      if (projectId == null) return "-";
      const project = this.$store.getters["table/project/get"](Number(projectId));
      return project?.name || `#${projectId}`;
    },
    getCatalogItem(table, id) {
      if (id == null) return null;
      return this.$store.getters[`table/${table}/get`](Number(id));
    },
    resetStepConfig(oldVal, newVal, dataKey) {
      if (oldVal != null && newVal !== oldVal) {
        this[dataKey] = {};
      }
    },
    reviewItemsForFields(fields, data) {
      return fields.map((field) => ({
        label: field.label,
        value: this.formatReviewValue(field, data) || "N/A",
      }));
    },
    reviewItemsForPreprocessingAction() {
      const actionLabel = this.actionSelectFields[0]?.options?.find(
        (o) => this.sameValue(o.value, this.triggerForm.triggerActionId)
      )?.name;
      const items = [
        {
          label: this.actionSelectFields[0]?.label || "Then (action)",
          value: actionLabel || "N/A",
        },
        {
          label: "NLP skill",
          value: this.actionData.skillName || "N/A",
        },
      ];

      const inputMappings = this.actionData.inputMappings || {};
      Object.entries(inputMappings).forEach(([param, mapping]) => {
        if (param === "output" || !mapping) return;
        items.push({
          label: `Input: ${param}`,
          value: mapping.name || mapping.table || "N/A",
        });
      });

      const baseFiles = this.actionData.baseFiles || {};
      const names = this.actionData.validationConfigurationNames || {};
      Object.entries(baseFiles).forEach(([configId, selection]) => {
        items.push({
          label: `Base file (${names[configId] || configId})`,
          value: selection,
        });
      });

      return items;
    },
    formatReviewValue(field, data) {
      const val = data[field.key];
      if (field.type === "select" && field.options?.length) {
        const opt = field.options.find((o) => this.sameValue(o.value, val));
        return opt?.name ?? (val == null ? "" : String(val));
      }
      if (field.type === "boolean" || field.type === "bool") {
        return val ? "Yes" : "No";
      }
      if (val == null) return "";
      return String(val);
    },
    isFilled(value) {
      if (value == null || value === "") return false;
      if (typeof value === "string") return value.trim() !== "";
      if (typeof value === "number") return !Number.isNaN(value);
      return true;
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
    isStepConfigValid(selection, formData, configData, selectFields, configFields) {
      if (!selection) return false;
      return this.isConfigValid(
        { ...formData, ...configData },
        [...selectFields, ...configFields]
      );
    },
    isStepSettingsValid() {
      return this.isConfigValid(this.triggerForm, this.settingsFields);
    },
    isStepEventValid() {
      return this.isStepConfigValid(
        this.selectedEvent,
        this.triggerForm,
        this.eventData,
        this.eventFields,
        this.eventConfigFields
      );
    },
    isStepActionValid() {
      if (this.actionComponentFields.length) {
        return !!this.selectedAction && this.isConfiguredActionValid();
      }
      return this.isStepConfigValid(
        this.selectedAction,
        this.triggerForm,
        this.actionData,
        this.actionSelectFields,
        this.actionConfigFields
      );
    },
    isConfiguredActionValid() {
      return this.actionComponentFields.every((field) => {
        if (field.type === "skillSelector") {
          return !field.required || this.isFilled(this.actionData[field.key]);
        }

        if (field.type === "inputMap") {
          const requiresTableBasedInput = field.requireTableBasedInput !== false;
          return (
            this.isFilled(this.actionData[field.skillKey || "skillName"]) &&
            this.hasValidInputMappings &&
            (!requiresTableBasedInput || this.hasTableBasedParameter)
          );
        }

        if (!this.shouldRenderActionComponent(field)) {
          if (field.type === "inputGroup" && field.visibleWhen === "requiresValidation") {
            return !this.requireValidation;
          }
          return true;
        }

        if (field.type === "inputFiles" || field.type === "inputGroup") {
          return !field.required || this.componentValidity[field.key] === true;
        }

        return true;
      });
    },
    shouldRenderActionComponent(field) {
      if (field.visibleWhen === "hasTableBasedInput") {
        return this.hasTableBasedParameter;
      }
      if (field.visibleWhen === "requiresValidation") {
        return this.requireValidation && this.validationConfigurationIds.length > 0;
      }
      if (field.visibleWhen === "hasBaseFileParameter") {
        return !!this.actionData[field.baseFileParameterKey || "baseFileParameter"];
      }
      return true;
    },
    updateActionData(values) {
      this.actionData = {
        ...this.actionData,
        ...values,
      };
    },
    updateSkillSelection(field, skillName) {
      this.updateActionData({
        [field.key]: skillName,
        inputMappings: {},
        selectedFiles: {},
        baseFileParameter: null,
        baseFiles: {},
        skillParameterMappings: null,
        validationConfigurationNames: {},
      });
      this.componentValidity = {};
    },
    updateInputMappings(field, inputMappings) {
      const previousBaseFileParameter = this.actionData.baseFileParameter;
      const baseFileParameter = this.getBaseFileParameter(inputMappings);
      const baseFiles = previousBaseFileParameter === baseFileParameter
        ? this.actionData.baseFiles || {}
        : {};

      this.updateActionData({
        [field.key]: inputMappings,
        baseFileParameter,
        baseFiles,
        skillParameterMappings: this.formatSkillParameterMappings(inputMappings, field),
      });

      if (previousBaseFileParameter !== baseFileParameter) {
        this.componentValidity = {};
      }
    },
    updateBaseFiles(field, baseFiles) {
      this.updateActionData({ [field.key]: baseFiles });
    },
    updateSelectedFiles(field, selectedFiles) {
      const inputMapField = this.getInputMapField();
      this.updateActionData({
        [field.key]: selectedFiles,
        skillParameterMappings: this.formatSkillParameterMappings(
          this.actionData[field.inputMappingsKey || "inputMappings"],
          inputMapField,
          selectedFiles
        ),
      });
    },
    updateValidationConfigurationNames(validationConfigurationNames) {
      this.updateActionData({ validationConfigurationNames });
    },
    setComponentValidity(field, value) {
      this.componentValidity = {
        ...this.componentValidity,
        [field.key]: value,
      };
    },
    getBaseFileParameter(inputMappings) {
      for (const [paramName, mapping] of Object.entries(inputMappings || {})) {
        if (mapping?.requiresTableSelection && ["submission", "document"].includes(mapping.type)) {
          return paramName;
        }
      }
      return null;
    },
    getInputMapField() {
      return this.actionComponentFields.find((field) => field.type === "inputMap") || {};
    },
    formatSkillParameterMappings(inputMappings, field = {}, selectedFiles = this.actionData.selectedFiles || {}) {
      const mappings = {};
      for (const [paramName, mapping] of Object.entries(inputMappings || {})) {
        if (!mapping || paramName === "output") continue;

        if (mapping.requiresTableSelection) {
          mappings[paramName] = {
            table: mapping.table,
            ...(field.tableSelectionSource === "eventContext"
              ? { fromContext: field.contextKey || "submissionId" }
              : { fileIds: (selectedFiles[paramName] || []).map((file) => file.id) }),
          };
        } else {
          mappings[paramName] = {
            table: mapping.table || "configuration",
            fileIds: [mapping.configurationId],
          };
        }
      }
      return Object.keys(mappings).length > 0 ? mappings : null;
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

      if (src.filterFromForm) {
        rows = rows.filter((r) =>
          Object.entries(src.filterFromForm).every(([k, formKey]) => {
            const val = this.triggerForm[formKey];
            return val == null || this.sameValue(r[k], val);
          })
        );
      }

      if (src.distinct) {
        const seen = new Set();
        rows = rows.filter((r) => {
          const v = r[src.valueKey];
          if (v == null || seen.has(v)) return false;
          seen.add(v);
          return true;
        });
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

      return { ...field, options };
    },
    resolveFormSchema(schema) {
      return schema.map((field) => this.resolveField(field));
    },
    defaultTriggerForm(projectId) {
      return {
        ...DEFAULT_FORM,
        projectId,
      };
    },
    resetEditor({ editingId = null, triggerForm, eventData = {}, actionData = {} }) {
      this.editingId = editingId;
      this.triggerForm = triggerForm;
      this.eventData = { ...eventData };
      this.actionData = { ...actionData };
      this.componentValidity = {};
    },
    openCreate(projectId) {
      this.resetEditor({ triggerForm: this.defaultTriggerForm(projectId) });
      this.$refs.stepper.open();
    },
    openView(row) {
      const event = this.getCatalogItem("trigger_event", row.triggerEventId);
      const action = this.getCatalogItem("trigger_action", row.triggerActionId);
      const configuration = row.configuration || {};
      const viewConfiguration = {};
      if (configuration.event && Object.keys(configuration.event).length) {
        viewConfiguration.event = configuration.event;
      }
      if (configuration.action && Object.keys(configuration.action).length) {
        viewConfiguration.action = configuration.action;
      }
      this.viewFormData = {
        name: row.name,
        description: configuration.description || "",
        enabled: row.enabled?.value ?? row.enabled,
        eventLabel: row.eventLabel || event?.configuration?.label || event?.name || "-",
        actionLabel: row.actionLabel || action?.configuration?.label || action?.name || "-",
        projectLabel: this.getProjectLabel(row.projectId),
        maxRetries: row.maxRetries ?? "-",
        parallelLimit: row.parallelLimit ?? "-",
        timeout: row.timeout ?? "-",
        configuration: viewConfiguration,
      };
      this.$refs.viewModal.open();
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
    showToast(title, message, variant) {
      this.eventBus.emit("toast", { title, message, variant });
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
          event: this.eventData,
          action: this.actionData,
        },
      };
      const editing = this.editingId !== null;
      const socketEvent = editing ? SOCKET_EVENTS.update : SOCKET_EVENTS.create;
      if (editing) {
        payload.id = this.editingId;
      }
      this.$refs.stepper.setWaiting(true);
      this.$socket.emit(socketEvent, payload, (res) => {
        this.$refs.stepper.setWaiting(false);
        if (res.success) {
          this.$refs.stepper.close();
          this.editingId = null;
          this.$emit("saved", { editing });
          this.showToast(
            editing ? "Trigger updated" : "Trigger created",
            `The trigger has been ${editing ? "updated" : "created"} successfully.`,
            "success"
          );
        } else {
          this.showToast(
            editing ? "Failed to update trigger" : "Failed to create trigger",
            res.message || "Unknown error",
            "danger"
          );
        }
      });
    },
  },
};
</script>
