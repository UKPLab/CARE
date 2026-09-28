<template>
  <BasicModal ref="aiHookModelModal" name="aiHookModelModal" size="lg">
    <template #title>
      {{ $t("ai.hooks.modelsTitle") }}
    </template>
    <template #body>
      <div v-if="selectedHook" class="mb-3">
        <div><strong>{{ $t("ai.resources.hook") }}:</strong> {{ selectedHook.name }}</div>
      </div>

      <p class="text-muted small mb-3">
        {{ $t("ai.hooks.modelOrderDescription") }}
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
          :title="$t('ai.common.cancel')"
          class="btn btn-secondary"
          @click="$refs.aiHookModelModal.close()"
        />
        <BasicButton
          :title="isSaving ? $t('ai.common.saving') : $t('ai.hooks.saveModels')"
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
import AIHookModelOrder from "./AIHookModelOrder.vue";
import { resolveApiMessage } from "@/assets/utils";

export default {
  name: "AIHookModelModal",
  components: { BasicModal, BasicButton, AIHookModelOrder },
  props: {
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
        this.toastError(this.$t("ai.errors.invalidHookSelected"));
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
            reject(new Error(resolveApiMessage(result, "ai.errors.updateData")));
          }
        });
      });
    },
    async saveModels() {
      const normalizedModelIds = this.modelIds.map((id) => Number(id));

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
                aiHookId: hookId,
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
        this.toastSuccess(this.$t("ai.messages.hookModelsUpdated"));
      } catch (error) {
        this.toastError(resolveApiMessage(error, "ai.errors.saveHookModels"));
      } finally {
        this.isSaving = false;
      }
    },
    toastSuccess(message) {
      this.eventBus.emit("toast", {
        title: this.$t("ai.common.success"),
        message,
        variant: "success",
      });
    },
    toastError(message) {
      this.eventBus.emit("toast", {
        title: this.$t("ai.common.error"),
        message,
        variant: "danger",
      });
    },
  },
};
</script>
