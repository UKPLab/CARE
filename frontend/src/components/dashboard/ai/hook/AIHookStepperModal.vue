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
      <AIHookBasicInfoStep v-model="hookForm" />
    </template>
    <template #step-2>
      <AIHookPromptStep v-model="hookForm" :prompt-templates="promptTemplates" />
    </template>
    <template #step-3>
      <AIHookModelOrder
        v-model="hookForm.modelIds"
        :model-rows="modelRows"
        id-prefix="hookStepper"
      />
    </template>
    <template #step-4>
      <AIHookOutputStep v-model="hookForm" :output-modes="outputModes" />
    </template>
    <template #step-5>
      <AIHookReviewStep
        :hook-form="hookForm"
        :prompt-templates="promptTemplates"
        :model-rows="modelRows"
        :output-modes="outputModes"
      />
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import AIHookBasicInfoStep from "./AIHookBasicInfoStep.vue";
import AIHookPromptStep from "./AIHookPromptStep.vue";
import AIHookModelOrder from "./AIHookModelOrder.vue";
import AIHookOutputStep from "./AIHookOutputStep.vue";
import AIHookReviewStep from "./AIHookReviewStep.vue";

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
  components: {
    StepperModal,
    AIHookBasicInfoStep,
    AIHookPromptStep,
    AIHookModelOrder,
    AIHookOutputStep,
    AIHookReviewStep,
  },
  subscribeTable: ["ai_budget"],
  props: {
    promptTemplates: { type: Array, default: () => [] },
    modelRows: { type: Array, default: () => [] },
    hookModelRows: { type: Array, default: () => [] },
    outputModes: { type: Array, required: true },
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
  },
  methods: {
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
