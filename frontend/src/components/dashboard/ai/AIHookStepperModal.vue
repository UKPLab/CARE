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
      <BasicForm v-model="hookForm" :fields="basicInfoFields" />
    </template>

    <template #step-2>
      <BasicForm v-model="hookForm" :fields="promptFields" />
      <div v-if="selectablePromptTemplates.length === 0" class="text-warning small mt-1">
        No prompt templates are available yet.
      </div>
    </template>

    <template #step-3>
      <AIHookModelOrder
        v-model="hookForm.modelIds"
        :model-rows="modelRows"
        id-prefix="hookStepper"
      />
    </template>

    <template #step-4>
      <BasicForm v-model="hookForm" :fields="outputFields" />
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

          <dt class="col-sm-4">Models</dt>
          <dd class="col-sm-8">
            <ol v-if="selectedModelNames.length > 0" class="mb-0 ps-3">
              <li v-for="(name, index) in selectedModelNames" :key="`${name}-${index}`">
                {{ name }}
              </li>
            </ol>
            <span v-else>-</span>
          </dd>

          <dt class="col-sm-4">Output Type</dt>
          <dd class="col-sm-8">{{ selectedOutputModeLabel }}</dd>
          
          <dt class="col-sm-4">Cost limit</dt>
          <dd class="col-sm-8">{{ formattedCostLimit }}</dd>

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
import BasicForm from "@/basic/Form.vue";
import AIHookModelOrder from "@/components/dashboard/ai/AIHookModelOrder.vue";

function getEmptyHookForm() {
  return {
    id: 0,
    name: "",
    description: "",
    templateId: null,
    modelIds: [],
    outputMode: 0,
    enabled: true,
    costLimit: null,
  };
}

export default {
  name: "AIHookStepperModal",
  components: { StepperModal, BasicForm, AIHookModelOrder },
  subscribeTable: ["ai_budget"],
  props: {
    promptTemplates: {
      type: Array,
      default: () => [],
    },
    modelRows: {
      type: Array,
      default: () => [],
    },
    hookModelRows: {
      type: Array,
      default: () => [],
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
      const hasModel = this.hookForm.modelIds.length > 0;
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
    modelLabelById() {
      return this.modelRows.reduce((acc, model) => {
        acc[model.id] = this.formatModelLabel(model);
        return acc;
      }, {});
    },
    selectedModelNames() {
      return this.hookForm.modelIds.map((modelId) => this.modelLabelById[modelId] || `Model #${modelId}`);
    },
    selectedOutputModeLabel() {
      const selectedValue = Number(this.hookForm.outputMode);
      const mode = this.outputModes.find((item) => Number(item.value) === selectedValue);
      return mode?.label || "-";
    },
    selectablePromptTemplates() {
      return this.promptTemplates.filter((template) => Number(template.type) === 8);
    },
    basicInfoFields() {
      return [
        {
          key: "name",
          label: "Name",
          type: "text",
          required: true,
          placeholder: "e.g. Assessment Feedback Hook",
          help: "A short dashboard name that helps admins recognize where this AIHook is used.",
        },
        {
          key: "description",
          label: "Description",
          type: "textarea",
          rows: 3,
          placeholder: "Explain when this hook should be used.",
          help: "Optional. Add context about the feature, input data, or expected model behavior.",
        },
        {
          key: "costLimit",
          label: "Cost limit ($)",
          type: "number",
          min: 0,
          step: 0.01,
          placeholder: "No limit",
          help: "Optional. Total AI spend allowed for this hook across all studies. Leave empty for no cap.",
        },
      ];
    },
    promptFields() {
      return [
        {
          key: "templateId",
          label: "Prompt Template",
          type: "select",
          required: true,
          options: [
            { value: null, name: "Select prompt template" },
            ...this.selectablePromptTemplates.map((template) => ({
              value: template.id,
              name: template.name,
            })),
          ],
          help: "Only prompt templates with placeholders such as document text or study context are shown.",
        },
      ];
    },
    outputFields() {
      return [
        {
          key: "outputMode",
          label: "Output Type",
          type: "select",
          required: true,
          options: this.outputModes.map((mode) => ({
            value: mode.value,
            name: mode.label,
          })),
          help: "Text returns plain output. JSON expects structured data.",
        },
        {
          key: "enabled",
          label: "Enabled",
          type: "switch",
          help: "Disabled hooks stay saved but should not be used by AI features.",
        },
      ];
    },
    formattedCostLimit() {
      const value = Number(this.hookForm.costLimit);
      return Number.isFinite(value) && value > 0 ? `$${value.toFixed(2)}` : "-";
    },
  },
  methods: {
    formatModelLabel(model) {
      if (!model) return "-";
      return model.model ? `${model.name} (${model.model})` : model.name;
    },
    getHookModelRows(hookId) {
      return this.hookModelRows
        .filter((row) => Number(row.aiHookId) === Number(hookId) && !row.deleted)
        .sort((a, b) => Number(a.priority) - Number(b.priority));
    },
    findExistingCapRow(hookId) {
      if (!hookId) return null;
      const budgets = this.$store.getters["table/ai_budget/getFiltered"]
        ? this.$store.getters["table/ai_budget/getFiltered"](
            (b) => !b.deleted
              && Number(b.aiHookId) === Number(hookId)
              && !b.studyStepId
              && Number(b.limitType) === 0
          )
        : [];
      return budgets.length > 0 ? budgets[0] : null;
    },
    findExistingCap(hookId) {
      const row = this.findExistingCapRow(hookId);
      return row ? Number(row.costLimit) : null;
    },
    open(row = null) {
      this.hookForm = getEmptyHookForm();
      if (row) {
        this.hookForm = {
          id: row.id,
          name: row.name || "",
          description: row.description || "",
          templateId: row.templateId || null,
          modelIds: this.getHookModelRows(row.id).map((hookModel) => Number(hookModel.aiModelId)),
          outputMode: Number.isInteger(Number(row.outputMode)) ? Number(row.outputMode) : 0,
          enabled: row.enabled !== false,
          costLimit: this.findExistingCap(row.id),
        };
      }
      this.$refs.hookStepper.open();
    },
    emitUpdate(table, data) {
      return new Promise((resolve, reject) => {
        this.$socket.emit("appDataUpdate", { table, data }, (result) => {
          if (result?.success) {
            resolve(result.data);
          } else {
            reject(new Error(result?.message || "Failed to update data"));
          }
        });
      });
    },
    async saveHook() {
      const payload = {
        id: this.hookForm.id || 0,
        name: this.hookForm.name.trim(),
        description: this.hookForm.description?.trim() || null,
        templateId: Number(this.hookForm.templateId),
        outputMode: Number(this.hookForm.outputMode),
        enabled: !!this.hookForm.enabled,
      };

      this.$refs.hookStepper.setWaiting(true);
      try {
        const hookId = await this.emitUpdate("ai_hook", payload);
        const existingRows = this.getHookModelRows(hookId);
        const rowsByPriority = new Map(existingRows.map((row) => [Number(row.priority), row]));
        const rowsByModel = new Map(existingRows.map((row) => [Number(row.aiModelId), row]));
        const usedRowIds = new Set();

        for (const [index, modelId] of this.hookForm.modelIds.entries()) {
          const priority = index + 1;
          const existingAtPriority = rowsByPriority.get(priority);
          const existingForModel = rowsByModel.get(Number(modelId));
          const additionalParameters = existingForModel?.additionalParameters || {};

          if (existingAtPriority) {
            usedRowIds.add(existingAtPriority.id);
            if (
              Number(existingAtPriority.aiModelId) !== Number(modelId)
              || existingAtPriority.additionalParameters !== additionalParameters
            ) {
              await this.emitUpdate("ai_hook_models", {
                id: existingAtPriority.id,
                aiHookId: Number(hookId),
                aiModelId: Number(modelId),
                priority,
                additionalParameters,
              });
            }
          } else {
            const resultId = await this.emitUpdate("ai_hook_models", {
              id: 0,
              aiHookId: Number(hookId),
              aiModelId: Number(modelId),
              priority,
              additionalParameters,
            });
            usedRowIds.add(resultId);
          }
        }

        for (const row of existingRows) {
          if (!usedRowIds.has(row.id)) {
            await this.emitUpdate("ai_hook_models", { id: row.id, deleted: true });
          }
        }

        // Save / update the hook-level cost limit via appDataUpdate.
        const costLimitValue = Number(this.hookForm.costLimit);
        if (Number.isFinite(costLimitValue) && costLimitValue > 0) {
          const existing = this.findExistingCapRow(hookId);
          const capData = existing
            ? { id: existing.id, costLimit: costLimitValue }
            : { aiHookId: Number(hookId), limitType: 0, costLimit: costLimitValue };
          await this.emitUpdate("ai_budget", capData);
        }

        this.$refs.hookStepper.close();
        this.toastSuccess(this.hookForm.id ? "AI hook updated" : "AI hook created");
        this.$emit("saved");
      } catch (error) {
        this.toastError(error.message || "Failed to save AI hook");
      } finally {
        this.$refs.hookStepper.setWaiting(false);
      }
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
