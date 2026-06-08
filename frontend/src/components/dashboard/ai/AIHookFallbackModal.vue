<template>
  <BasicModal ref="fallbackModal" name="aiHookFallbackModal" size="lg">
    <template #title>
      Fallback Models
    </template>
    <template #body>
      <div v-if="selectedHook" class="mb-3">
        <div><strong>AI Hook:</strong> {{ selectedHook.name }}</div>
        <div>
          <strong>Primary Model:</strong>
          {{ primaryModelLabel }}
        </div>
      </div>

      <p class="text-muted small mb-3">
        Choose fallback models in priority order. The first fallback is tried after the primary model fails.
        Select at least one fallback model to save.
      </p>

      <div
        v-for="(selection, index) in fallbackSelections"
        :key="`fallback-${index}`"
        class="mb-3"
      >
        <label class="form-label" :for="`fallbackModel-${index}`">
          Fallback {{ index + 1 }}
          <i
            class="bi bi-info-circle text-muted ms-1"
            title="Models are used in order when the previous model is unavailable."
          />
        </label>
        <select
          :id="`fallbackModel-${index}`"
          v-model.number="fallbackSelections[index]"
          class="form-select"
          @change="onFallbackChange(index)"
        >
          <option :value="null">Select fallback model</option>
          <option
            v-for="model in modelsForSlot(index)"
            :key="model.id"
            :value="model.id"
          >
            {{ formatModelLabel(model) }}
          </option>
        </select>
      </div>

      <div v-if="selectableModels.length === 0" class="text-warning small">
        No enabled AI models are available for fallback selection.
      </div>
    </template>
    <template #footer>
      <div class="btn-group">
        <BasicButton
          title="Cancel"
          class="btn btn-secondary"
          @click="$refs.fallbackModal.close()"
        />
        <BasicButton
          :title="isSaving ? 'Saving...' : 'Save Fallbacks'"
          class="btn btn-primary"
          :disabled="!canSave"
          @click="saveFallbacks"
        />
      </div>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";

export default {
  name: "AIHookFallbackModal",
  components: { BasicModal, BasicButton },
  props: {
    currentUserId: {
      type: Number,
      required: true,
    },
    modelRows: {
      type: Array,
      default: () => [],
    },
    fallbackRows: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      selectedHook: null,
      fallbackSelections: [null],
      isSaving: false,
    };
  },
  computed: {
    selectableModels() {
      return this.modelRows
        .filter((model) => model.enabled)
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    },
    primaryModel() {
      if (!this.selectedHook?.aiModelId) return null;
      return this.modelRows.find((model) => Number(model.id) === Number(this.selectedHook.aiModelId)) || null;
    },
    primaryModelLabel() {
      if (!this.primaryModel) return "Unknown model";
      return this.formatModelLabel(this.primaryModel);
    },
    selectedFallbackIds() {
      return this.fallbackSelections
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0);
    },
    canSave() {
      return this.selectedFallbackIds.length > 0 && !this.isSaving;
    },
  },
  methods: {
    formatModelLabel(model) {
      if (!model) return "-";
      return model.model ? `${model.name} (${model.model})` : model.name;
    },
    modelsForSlot(index) {
      const currentId = Number(this.fallbackSelections[index]);
      const blockedIds = new Set([
        Number(this.selectedHook?.aiModelId),
        ...this.fallbackSelections
          .map((id, slotIndex) => (slotIndex === index ? null : Number(id)))
          .filter((id) => Number.isInteger(id) && id > 0),
      ]);

      return this.selectableModels.filter((model) => {
        const modelId = Number(model.id);
        if (modelId === currentId) return true;
        return !blockedIds.has(modelId);
      });
    },
    onFallbackChange(index) {
      const hasValue = Number.isInteger(Number(this.fallbackSelections[index])) && Number(this.fallbackSelections[index]) > 0;
      const isLast = index === this.fallbackSelections.length - 1;
      if (hasValue && isLast) {
        this.fallbackSelections.push(null);
      }
      this.trimTrailingEmptySelections();
    },
    trimTrailingEmptySelections() {
      while (
        this.fallbackSelections.length > 1
        && !this.fallbackSelections[this.fallbackSelections.length - 1]
        && !this.fallbackSelections[this.fallbackSelections.length - 2]
      ) {
        this.fallbackSelections.pop();
      }
    },
    open(hookRow) {
      if (!hookRow?.id) {
        this.toastError("Invalid AI hook selected");
        return;
      }
      if (Number(hookRow.userId) !== Number(this.currentUserId)) {
        this.toastError("Only hook owners can manage fallback models");
        return;
      }

      this.selectedHook = hookRow;
      const existing = this.fallbackRows
        .filter((row) => Number(row.aiHookId) === Number(hookRow.id) && !row.deleted)
        .sort((a, b) => Number(a.priority) - Number(b.priority))
        .map((row) => row.aiModelId);

      this.fallbackSelections = existing.length > 0 ? [...existing, null] : [null];
      this.isSaving = false;
      this.$refs.fallbackModal.open();
    },
    emitUpdate(table, data) {
      return new Promise((resolve, reject) => {
        this.$socket.emit("appDataUpdate", { table, data }, (result) => {
          if (result?.success) {
            resolve(result);
          } else {
            reject(new Error(result?.message || "Failed to update data"));
          }
        });
      });
    },
    async saveFallbacks() {
      if (!this.selectedHook?.id) {
        this.toastError("No AI hook selected");
        return;
      }
      if (this.selectedFallbackIds.length === 0) {
        this.toastError("Select at least one fallback model");
        return;
      }

      const uniqueIds = new Set(this.selectedFallbackIds);
      if (uniqueIds.size !== this.selectedFallbackIds.length) {
        this.toastError("Each fallback model can only be selected once");
        return;
      }
      if (uniqueIds.has(Number(this.selectedHook.aiModelId))) {
        this.toastError("The primary model cannot be used as a fallback");
        return;
      }

      this.isSaving = true;
      try {
        const hookId = Number(this.selectedHook.id);
        const existingRows = this.fallbackRows.filter(
          (row) => Number(row.aiHookId) === hookId && !row.deleted
        );
        const desiredByPriority = this.selectedFallbackIds.map((aiModelId, index) => ({
          aiModelId,
          priority: index + 1,
        }));

        for (const row of existingRows) {
          const stillUsed = desiredByPriority.some(
            (item) => Number(item.priority) === Number(row.priority)
              && Number(item.aiModelId) === Number(row.aiModelId)
          );
          if (!stillUsed) {
            await this.emitUpdate("ai_hook_fallback", { id: row.id, deleted: true });
          }
        }

        for (const item of desiredByPriority) {
          const existing = existingRows.find((row) => Number(row.priority) === item.priority);
          if (existing) {
            if (Number(existing.aiModelId) !== Number(item.aiModelId)) {
              await this.emitUpdate("ai_hook_fallback", {
                id: existing.id,
                aiModelId: item.aiModelId,
              });
            }
          } else {
            await this.emitUpdate("ai_hook_fallback", {
              id: 0,
              aiHookId: hookId,
              aiModelId: item.aiModelId,
              priority: item.priority,
            });
          }
        }

        this.$refs.fallbackModal.close();
        this.toastSuccess("Fallback models updated");
      } catch (error) {
        this.toastError(error.message || "Failed to save fallback models");
      } finally {
        this.isSaving = false;
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
