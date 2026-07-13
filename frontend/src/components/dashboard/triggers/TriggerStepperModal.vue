<template>
  <StepperModal
    ref="stepper"
    size="lg"
    :steps="stepperSteps"
    :submit-text="stepperSubmitText"
    :validation="stepValid"
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
      <hr v-if="eventConfigFields.length" />
      <BasicForm
        v-if="eventConfigFields.length"
        v-model="eventData"
        :fields="eventConfigFields"
      />
    </template>
    <template #step-3>
      <BasicForm v-model="triggerForm" :fields="actionSelectFields" />
      <hr v-if="actionComponentFields.length || actionConfigFields.length" />
      <template
        v-for="field in actionComponentFields"
        :key="field.key || field.type"
      >
        <SkillSelector
          v-if="field.type === 'skillSelector'"
          :model-value="actionData[field.key]"
          @update:model-value="updateSkillSelection(field, $event)"
        />
        <InputMap
          v-else-if="field.type === 'inputMap' && actionData[field.skillKey || 'skillName']"
          :model-value="actionData[field.key]"
          :skill-name="actionData[field.skillKey || 'skillName']"
          :hook-id="hookIdForSelection(actionData[field.skillKey || 'skillName'])"
          :study-based="field.studyBased !== false"
          @update:model-value="updateInputMappings(field, $event)"
        />
        <InputFiles
          v-else-if="field.type === 'inputFiles' && shouldRenderActionComponent(field)"
          :model-value="actionData[field.key] || {}"
          :input-mappings="actionData[field.inputMappingsKey || 'inputMappings'] || {}"
          @update:model-value="updateSelectedFiles(field, $event)"
          @update:valid="setComponentValidity(field, $event)"
        />
        <InputGroup
          v-else-if="field.type === 'inputGroup' && shouldRenderActionComponent(field)"
          :model-value="actionData[field.key] || {}"
          :base-file-parameter="actionData[field.baseFileParameterKey || 'baseFileParameter']"
          :selected-files="actionData[field.selectedFilesKey || 'selectedFiles'] || {}"
          :validation-configuration-ids="validationConfigurationIds"
          @update:model-value="updateBaseFiles(field, $event)"
          @update:valid="setComponentValidity(field, $event)"
          @update:validation-configurations="updateValidationConfigurationNames"
        />
      </template>
      <BasicForm
        v-if="!actionComponentFields.length && actionConfigFields.length"
        v-model="actionData"
        :fields="actionConfigFields"
      />
    </template>
    <template #step-4>
      <div class="summary-container">
        <div
          v-for="section in reviewSummarySections"
          :key="section.title"
          class="mb-4"
        >
          <h6>{{ section.title }}</h6>
          <div
            v-for="item in section.items"
            :key="item.label"
            class="summary-item"
          >
            <strong>{{ item.label }}:</strong> {{ item.value }}
          </div>
        </div>
        <div class="alert alert-info mt-3">
          <i class="bi bi-info-circle"></i>
          Please review the information above before submitting.
        </div>
      </div>
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
import BasicForm from "@/basic/Form.vue";
import BasicButton from "@/basic/Button.vue";
import SkillSelector from "@/basic/modal/skills/SkillSelector.vue";
import InputMap from "@/basic/modal/skills/InputMap.vue";
import InputFiles from "@/basic/modal/skills/InputFiles.vue";
import InputGroup from "@/basic/modal/skills/InputGroup.vue";

export default {
  name: "TriggerStepperModal",
  subscribeTable: ["trigger_event", "trigger_action", "project", "template", "assignment", "configuration"],
  components: { StepperModal, BasicModal, BasicForm, BasicButton, SkillSelector, InputMap, InputFiles, InputGroup },
  emits: ["saved"],
  data() {
    return {
      stepperSteps: [
        { title: "Trigger info" },
        { title: "Event" },
        { title: "Action" },
        { title: "Review & Confirm" },
      ],
      stepperSubmitText: "Save",
      settingsFormSchema: [
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
      ],
      eventField: {
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
      },
      actionField: {
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
      },
      socketEvents: {
        create: "triggerCreate",
        update: "triggerUpdate",
      },
      defaultForm: {
        name: "",
        description: "",
        projectId: null,
        maxRetries: 3,
        parallelLimit: 1,
        timeout: 300,
        triggerEventId: null,
        triggerActionId: null,
      },
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
      return this.resolveFormSchema(this.settingsFormSchema);
    },
    eventFields() {
      return [this.resolveField(this.eventField)];
    },
    eventConfigFields() {
      const schema = this.selectedEvent?.configuration?.formSchema || [];
      return schema.map((field) => this.resolveField(field));
    },
    actionSelectFields() {
      return [this.resolveField(this.actionField, { event: this.selectedEvent })];
    },
    actionConfigFields() {
      const schema = this.selectedAction?.configuration?.formSchema || [];
      return schema.map((field) => this.resolveField(field));
    },
    actionComponentFields() {
      return this.selectedAction?.configuration?.componentSchema || [];
    },
    autoBaseFileParameter() {
      const inputMappings = this.actionData.inputMappings || {};
      for (const [paramName, mapping] of Object.entries(inputMappings)) {
        if (mapping?.requiresTableSelection && ["submission", "document"].includes(mapping.type)) {
          return paramName;
        }
      }
      return null;
    },
    requireValidation() {
      if (!this.autoBaseFileParameter) return false;
      return this.actionData.inputMappings?.[this.autoBaseFileParameter]?.type === "submission";
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
      return Object.values(this.actionData.inputMappings || {}).some(
        (mapping) => mapping && mapping.requiresTableSelection
      );
    },
    hasValidInputMappings() {
      const inputMappings = this.actionData.inputMappings || {};
      const entries = Object.entries(inputMappings).filter(([key]) => key !== "output");
      return entries.length > 0 && entries.every(([, mapping]) => !!mapping);
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
        return !field.required || this.isFilled(data[field.key]);
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
      const f = this.triggerForm;
      const maxRetries = Number(f.maxRetries);
      const parallelLimit = Number(f.parallelLimit);
      const timeout = Number(f.timeout);
      return (
        this.isFilled(f.name) &&
        this.isFilled(f.description) &&
        f.projectId != null &&
        this.isFilled(f.maxRetries) &&
        !Number.isNaN(maxRetries) &&
        maxRetries >= 0 &&
        this.isFilled(f.parallelLimit) &&
        !Number.isNaN(parallelLimit) &&
        parallelLimit >= 1 &&
        this.isFilled(f.timeout) &&
        !Number.isNaN(timeout) &&
        timeout >= 1
      );
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
    hookIdForSelection(skillName) {
      if (typeof skillName !== "string" || !skillName.startsWith("hook:")) return null;
      const hookId = Number(skillName.slice("hook:".length));
      return Number.isInteger(hookId) && hookId > 0 ? hookId : null;
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
        ...this.defaultForm,
        projectId,
      };
    },
    openCreate(projectId) {
      this.editingId = null;
      this.triggerForm = this.defaultTriggerForm(projectId);
      this.eventData = {};
      this.actionData = {};
      this.componentValidity = {};
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
      this.eventData = config.event || {};
      this.actionData = config.action || {};
      this.componentValidity = {};
      this.$refs.stepper.open();
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
      const socketEvent = editing ? this.socketEvents.update : this.socketEvents.create;
      if (editing) {
        payload.id = this.editingId;
      }
      this.$socket.emit(socketEvent, payload, (res) => {
        if (res.success) {
          this.$refs.stepper.close();
          this.editingId = null;
          this.$emit("saved", { editing });
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

<style scoped>
.summary-container {
  padding: 1rem;
}

.summary-item {
  padding: 0.5rem 0;
  border-bottom: 1px solid #e9ecef;
}

.summary-item:last-of-type {
  border-bottom: none;
}

.summary-item strong {
  display: inline-block;
  min-width: 180px;
  color: #495057;
}
</style>
