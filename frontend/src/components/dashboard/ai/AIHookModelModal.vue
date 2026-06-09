<template>
  <BasicModal ref="aiHookModelModal" name="aiHookModelModal" size="lg">
    <template #title>
      AI Hook Models
    </template>
    <template #body>
      <div v-if="selectedHook" class="mb-3">
        <div><strong>AI Hook:</strong> {{ selectedHook.name }}</div>
      </div>

      <p class="text-muted small mb-3">
        Add models in priority order. Priority 1 is tried first; later priorities are fallbacks.
      </p>

      <AIHookModelOrder
        v-model="modelIds"
        :model-rows="modelRows"
        id-prefix="aiHookModelModal"
      />
    </template>
    <template #footer>
      <div class="btn-group">
        <BasicButton
          title="Cancel"
          class="btn btn-secondary"
          @click="$refs.aiHookModelModal.close()"
        />
        <BasicButton
          :title="isSaving ? 'Saving...' : 'Save Models'"
          class="btn btn-primary"
          :disabled="!canSave"
          @click="saveModels"
        />
      </div>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import AIHookModelOrder from "@/components/dashboard/ai/AIHookModelOrder.vue";

export default {
  name: "AIHookModelModal",
  components: { BasicModal, BasicButton, AIHookModelOrder },
  props: {
    currentUserId: {
      type: Number,
      required: true,
    },
    modelRows: {
      type: Array,
      default: () => [],
    },
    hookModelRows: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      selectedHook: null,
      modelIds: [],
      initialModelIds: [],
      isSaving: false,
    };
  },
  computed: {
    selectedHookModelRows() {
      if (!this.selectedHook?.id) return [];
      return this.hookModelRows.filter(
        (row) => Number(row.aiHookId) === Number(this.selectedHook.id)
          && !row.deleted
      );
    },
    orderedHookModelRows() {
      return [...this.selectedHookModelRows]
        .sort((a, b) => Number(a.priority) - Number(b.priority));
    },
    hasModelChanges() {
      const current = this.modelIds.map((id) => Number(id));
      const initial = this.initialModelIds;
      if (current.length !== initial.length) return true;
      return current.some((id, index) => id !== initial[index]);
    },
    canSave() {
      return this.hasModelChanges && this.modelIds.length > 0 && !this.isSaving;
    },
  },
  methods: {
    open(hookRow) {
      if (!hookRow?.id) {
        this.toastError("Invalid AI hook selected");
        return;
      }
      if (Number(hookRow.userId) !== Number(this.currentUserId)) {
        this.toastError("Only hook owners can manage AI hook models");
        return;
      }

      this.selectedHook = hookRow;
      const existing = this.orderedHookModelRows.map((row) => Number(row.aiModelId));

      this.initialModelIds = existing;
      this.modelIds = [...existing];
      this.isSaving = false;
      this.$refs.aiHookModelModal.open();
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
    async saveModels() {
      if (!this.selectedHook?.id) {
        this.toastError("No AI hook selected");
        return;
      }
      if (this.modelIds.length === 0) {
        this.toastError("Select at least one model");
        return;
      }

      const normalizedModelIds = this.modelIds.map((id) => Number(id));
      const uniqueIds = new Set(normalizedModelIds);
      if (uniqueIds.size !== normalizedModelIds.length) {
        this.toastError("Each model can only be selected once");
        return;
      }

      this.isSaving = true;
      try {
        const hookId = Number(this.selectedHook.id);
        const existingRows = this.orderedHookModelRows;
        const rowsByPriority = new Map(existingRows.map((row) => [Number(row.priority), row]));
        const rowsByModel = new Map(existingRows.map((row) => [Number(row.aiModelId), row]));
        const desiredByPriority = normalizedModelIds.map((aiModelId, index) => ({
          aiModelId,
          priority: index + 1,
        }));
        const usedExistingRowIds = new Set();

        for (const item of desiredByPriority) {
          const existingAtPriority = rowsByPriority.get(Number(item.priority));
          const existingForModel = rowsByModel.get(Number(item.aiModelId));
          const additionalParameters = existingForModel?.additionalParameters || {};

          if (existingAtPriority) {
            usedExistingRowIds.add(existingAtPriority.id);
            if (
              Number(existingAtPriority.aiModelId) !== Number(item.aiModelId)
              || existingAtPriority.additionalParameters !== additionalParameters
            ) {
              await this.emitUpdate("ai_hook_models", {
                id: existingAtPriority.id,
                aiModelId: item.aiModelId,
                priority: item.priority,
                additionalParameters,
              });
            }
          } else {
            await this.emitUpdate("ai_hook_models", {
              id: 0,
              aiHookId: hookId,
              aiModelId: item.aiModelId,
              priority: item.priority,
              additionalParameters,
            });
          }
        }

        for (const row of existingRows) {
          if (!usedExistingRowIds.has(row.id)) {
            await this.emitUpdate("ai_hook_models", { id: row.id, deleted: true });
          }
        }

        this.$refs.aiHookModelModal.close();
        this.toastSuccess("AI hook models updated");
      } catch (error) {
        this.toastError(error.message || "Failed to save AI hook models");
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
