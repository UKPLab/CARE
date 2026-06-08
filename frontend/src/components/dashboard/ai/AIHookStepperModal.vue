<template>
  <StepperModal
    ref="hookStepper"
    :steps="hookSteps"
    :validation="hookStepValidation"
    :submit-text="hookForm.id ? 'Update Hook' : 'Create Hook'"
    size="lg"
    @submit="saveHook"
  >
    <template #title>
      {{ hookForm.id ? "Edit AI Hook" : "Create AI Hook" }}
    </template>

    <template #step-1>
      <div class="mb-3">
        <label class="form-label" for="hookName">
          Name
          <i
            class="bi bi-info-circle text-muted ms-1"
            title="A short dashboard name that helps admins recognize where this AIHook is used."
          />
        </label>
        <input
          id="hookName"
          v-model="hookForm.name"
          type="text"
          class="form-control"
          placeholder="e.g. Assessment Feedback Hook"
        />
        <small class="text-muted">
          Use a clear name that describes the AI workflow or feature this hook belongs to.
        </small>
      </div>

      <div class="mb-3">
        <label class="form-label" for="hookDescription">
          Description
          <i
            class="bi bi-info-circle text-muted ms-1"
            title="Optional notes for other admins, researchers, or future you."
          />
        </label>
        <textarea
          id="hookDescription"
          v-model="hookForm.description"
          class="form-control"
          rows="3"
          placeholder="Explain when this hook should be used."
        />
        <small class="text-muted">
          Optional. Add context about the feature, input data, or expected model behavior.
        </small>
      </div>
    </template>

    <template #step-2>
      <div class="mb-3">
        <label class="form-label" for="hookPromptTemplate">
          Prompt Template
          <i
            class="bi bi-info-circle text-muted ms-1"
            title="Select the prompt template that provides the instructions and placeholders sent to the model."
          />
        </label>
        <select
          id="hookPromptTemplate"
          v-model.number="hookForm.templateId"
          class="form-select"
        >
          <option :value="null">Select prompt template</option>
          <option
            v-for="template in selectablePromptTemplates"
            :key="template.id"
            :value="template.id"
          >
            {{ template.name }}
          </option>
        </select>
        <small class="text-muted">
          Production: only prompt templates (`template.type === 8`) with placeholders such as document text or study context.
          Testing: all templates are shown until type-8 prompt templates are merged.
        </small>
        <div v-if="selectablePromptTemplates.length === 0" class="text-warning small mt-1">
          No prompt templates are available yet.
        </div>
      </div>
    </template>

    <template #step-3>
      <div class="mb-3">
        <label class="form-label" for="hookModel">
          Model
          <i
            class="bi bi-info-circle text-muted ms-1"
            title="Select the primary AI model used first when this hook runs."
          />
        </label>
        <select
          id="hookModel"
          v-model.number="hookForm.aiModelId"
          class="form-select"
        >
          <option :value="null">Select model</option>
          <option
            v-for="model in selectableModels"
            :key="model.id"
            :value="model.id"
          >
            {{ model.name }}{{ model.model ? ` (${model.model})` : "" }}
          </option>
        </select>
        <small class="text-muted">
          This is the primary model. Fallback models can be configured later with priority ordering.
        </small>
        <div v-if="selectableModels.length === 0" class="text-warning small mt-1">
          No enabled AI models are available yet.
        </div>
      </div>
    </template>

    <template #step-4>
      <div class="mb-3">
        <label class="form-label" for="hookOutputMode">
          Output Type
          <i
            class="bi bi-info-circle text-muted ms-1"
            title="Choose how CARE should handle the model response after generation."
          />
        </label>
        <select
          id="hookOutputMode"
          v-model.number="hookForm.outputMode"
          class="form-select"
        >
          <option
            v-for="mode in outputModes"
            :key="mode.value"
            :value="mode.value"
          >
            {{ mode.label }}
          </option>
        </select>
        <small class="text-muted">
          Text returns plain output. JSON expects structured data. Image is for visual output workflows.
        </small>
      </div>

      <div class="form-check">
        <input
          id="hookEnabled"
          v-model="hookForm.enabled"
          class="form-check-input"
          type="checkbox"
        />
        <label class="form-check-label" for="hookEnabled">
          Enabled
          <i
            class="bi bi-info-circle text-muted ms-1"
            title="Disabled hooks stay saved but should not be used by AI features."
          />
        </label>
      </div>
    </template>

    <template #step-5>
      <div class="mb-3">
        <h6 class="mb-3">Review AI Hook</h6>
        <dl class="row mb-0">
          <dt class="col-sm-4">Name</dt>
          <dd class="col-sm-8">{{ hookForm.name || "-" }}</dd>

          <dt class="col-sm-4">Description</dt>
          <dd class="col-sm-8">{{ hookForm.description || "-" }}</dd>

          <dt class="col-sm-4">Prompt Template</dt>
          <dd class="col-sm-8">{{ selectedPromptTemplateName }}</dd>

          <dt class="col-sm-4">Model</dt>
          <dd class="col-sm-8">{{ selectedModelName }}</dd>

          <dt class="col-sm-4">Output Type</dt>
          <dd class="col-sm-8">{{ selectedOutputModeLabel }}</dd>

          <dt class="col-sm-4">Status</dt>
          <dd class="col-sm-8">{{ hookForm.enabled ? "Enabled" : "Disabled" }}</dd>
        </dl>
      </div>
      <small class="text-muted">
        Please confirm these settings before saving the AI hook.
      </small>
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";

function getEmptyHookForm() {
  return {
    id: 0,
    name: "",
    description: "",
    templateId: null,
    aiModelId: null,
    outputMode: 0,
    enabled: true,
  };
}

export default {
  name: "AIHookStepperModal",
  components: { StepperModal },
  props: {
    promptTemplates: {
      type: Array,
      default: () => [],
    },
    modelRows: {
      type: Array,
      default: () => [],
    },
    currentUserId: {
      type: Number,
      required: true,
    },
    outputModes: {
      type: Array,
      required: true,
    },
  },
  emits: ["saved"],
  data() {
    return {
      hookForm: getEmptyHookForm(),
    };
  },
  computed: {
    hookSteps() {
      return [
        { title: "Basic Info" },
        { title: "Prompt" },
        { title: "Model" },
        { title: "Output" },
        { title: "Review" },
      ];
    },
    hookStepValidation() {
      const hasBasics = !!this.hookForm.name.trim();
      const hasPrompt = Number.isInteger(Number(this.hookForm.templateId)) && Number(this.hookForm.templateId) > 0;
      const hasModel = Number.isInteger(Number(this.hookForm.aiModelId)) && Number(this.hookForm.aiModelId) > 0;
      return [
        hasBasics,
        hasPrompt,
        hasModel,
        true,
        hasBasics && hasPrompt && hasModel,
      ];
    },
    selectedPromptTemplateName() {
      const selectedId = Number(this.hookForm.templateId);
      const template = this.promptTemplates.find((item) => Number(item.id) === selectedId);
      return template?.name || "-";
    },
    selectedModelName() {
      const selectedId = Number(this.hookForm.aiModelId);
      const model = this.modelRows.find((item) => Number(item.id) === selectedId);
      if (!model) return "-";
      return model.model ? `${model.name} (${model.model})` : model.name;
    },
    selectedOutputModeLabel() {
      const selectedValue = Number(this.hookForm.outputMode);
      const mode = this.outputModes.find((item) => Number(item.value) === selectedValue);
      return mode?.label || "-";
    },
    // Production: filter to `Number(template.type) === 8` (prompt templates from feat-192).
    // Testing: `promptTemplates` prop includes all templates from the parent.
    selectablePromptTemplates() {
      return [...this.promptTemplates]
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    },
    selectableModels() {
      const selectedId = Number(this.hookForm.aiModelId);
      return this.modelRows
        .filter((model) => model.enabled || Number(model.id) === selectedId)
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    },
  },
  methods: {
    open(row = null) {
      this.hookForm = getEmptyHookForm();
      if (row) {
        if (Number(row.userId) !== Number(this.currentUserId)) {
          this.toastError("Only hook owners can edit this AI hook");
          return;
        }
        this.hookForm = {
          id: row.id,
          name: row.name || "",
          description: row.description || "",
          templateId: row.templateId || null,
          aiModelId: row.aiModelId || null,
          outputMode: Number.isInteger(Number(row.outputMode)) ? Number(row.outputMode) : 0,
          enabled: row.enabled !== false,
        };
      }
      this.$refs.hookStepper.open();
    },
    saveHook() {
      if (!this.hookForm.name.trim()) {
        this.toastError("Name is required");
        return;
      }
      if (!this.hookForm.templateId) {
        this.toastError("Prompt template is required");
        return;
      }
      if (!this.hookForm.aiModelId) {
        this.toastError("Model is required");
        return;
      }

      const payload = {
        id: this.hookForm.id || 0,
        name: this.hookForm.name.trim(),
        description: this.hookForm.description?.trim() || null,
        templateId: Number(this.hookForm.templateId),
        aiModelId: Number(this.hookForm.aiModelId),
        outputMode: Number(this.hookForm.outputMode),
        additionalParameters: {},
        enabled: !!this.hookForm.enabled,
      };

      this.$refs.hookStepper.setWaiting(true);
      this.$socket.emit("appDataUpdate", {
        table: "ai_hook",
        data: payload,
      }, (result) => {
        this.$refs.hookStepper.setWaiting(false);
        if (result?.success) {
          this.$refs.hookStepper.close();
          this.toastSuccess(this.hookForm.id ? "AI hook updated" : "AI hook created");
          this.$emit("saved");
        } else {
          this.toastError(result?.message || "Failed to save AI hook");
        }
      });
    },
    toastSuccess(message) {
      this.eventBus.emit("toast", {
        title: "Success",
        message,
        variant: "success",
      });
    },
    toastError(message) {
      this.eventBus.emit("toast", {
        title: "Error",
        message,
        variant: "danger",
      });
    },
  },
};
</script>
