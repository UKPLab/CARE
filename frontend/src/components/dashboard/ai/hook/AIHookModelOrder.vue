<template>
  <div>
    <BasicTable
      :columns="tableColumns"
      :data="orderedModelRows"
      :options="tableOptions"
      :buttons="tableButtons"
      @action="onTableAction"
    />

    <div class="mt-3">
      <label class="form-label" :for="`${idPrefix}ModelToAdd`">
        Add Model
        <i
          class="bi bi-info-circle text-muted ms-1"
          title="Add models in the order CARE should try them."
        />
      </label>
      <div class="input-group">
        <select
          :id="`${idPrefix}ModelToAdd`"
          v-model.number="modelToAddId"
          class="form-select"
        >
          <option :value="null">Select model</option>
          <option
            v-for="model in modelsAvailableToAdd"
            :key="model.id"
            :value="model.id"
          >
            {{ formatModelLabel(model) }}
          </option>
        </select>
        <BasicButton
          title="Add Model"
          class="btn btn-primary"
          icon="plus"
          :disabled="!modelToAddId"
          @click="addModel"
        />
      </div>
      <small class="text-muted">
        Priority 1 is the primary model. Priority 2 and later are fallback models.
      </small>
      <div v-if="selectableModels.length === 0" class="text-warning small mt-1">
        No enabled AI models are available yet.
      </div>
    </div>
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";

export default {
  name: "AIHookModelOrder",
  components: { BasicButton, BasicTable },
  props: {
    modelValue: {
      type: Array,
      default: () => [],
    },
    modelRows: {
      type: Array,
      default: () => [],
    },
    idPrefix: {
      type: String,
      default: "aiHook",
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      modelToAddId: null,
      tableOptions: {
        striped: true,
        hover: true,
      },
      tableColumns: [
        { name: "#", key: "priority", width: 1 },
        { name: "Model", key: "modelLabel" },
      ],
      tableButtons: [
        {
          icon: "arrow-up-short",
          title: "Move up",
          action: "moveUp",
          filter: [{ key: "canMoveUp", value: true }],
          options: {
            iconOnly: true,
            specifiers: { "btn-primary": true },
          },
        },
        {
          icon: "arrow-down-short",
          title: "Move down",
          action: "moveDown",
          filter: [{ key: "canMoveDown", value: true }],
          options: {
            iconOnly: true,
            specifiers: { "btn-secondary": true },
          },
        },
        {
          icon: "trash",
          title: "Remove model",
          action: "remove",
          options: {
            iconOnly: true,
            specifiers: { "btn-outline-danger": true },
          },
        },
      ],
    };
  },
  computed: {
    modelIds() {
      return this.modelValue.map((id) => Number(id));
    },
    modelLabelById() {
      return this.modelRows.reduce((acc, model) => {
        acc[model.id] = this.formatModelLabel(model);
        return acc;
      }, {});
    },
    selectableModels() {
      return this.modelRows
        .filter((model) => model.enabled || this.modelIds.includes(Number(model.id)))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    },
    modelsAvailableToAdd() {
      const selectedIds = new Set(this.modelIds);
      return this.selectableModels.filter((model) => !selectedIds.has(Number(model.id)));
    },
    orderedModelRows() {
      return this.modelIds.map((modelId, index) => ({
        id: modelId,
        index,
        priority: index + 1,
        modelLabel: this.modelLabelById[modelId] || `Model #${modelId}`,
        canMoveUp: index > 0,
        canMoveDown: index < this.modelIds.length - 1,
      }));
    },
  },
  methods: {
    formatModelLabel(model) {
      if (!model) return "-";
      return model.model ? `${model.name} (${model.model})` : model.name;
    },
    updateModelIds(modelIds) {
      this.$emit("update:modelValue", modelIds);
    },
    addModel() {
      const modelId = Number(this.modelToAddId);
      if (!Number.isInteger(modelId) || modelId <= 0) return;
      if (!this.modelIds.includes(modelId)) {
        this.updateModelIds([...this.modelIds, modelId]);
      }
      this.modelToAddId = null;
    },
    moveModel(index, direction) {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= this.modelIds.length) return;
      const modelIds = [...this.modelIds];
      [modelIds[index], modelIds[targetIndex]] = [modelIds[targetIndex], modelIds[index]];
      this.updateModelIds(modelIds);
    },
    removeModel(index) {
      const modelIds = [...this.modelIds];
      modelIds.splice(index, 1);
      this.updateModelIds(modelIds);
    },
    onTableAction({ action, params }) {
      const index = params.index;
      if (action === "moveUp") {
        this.moveModel(index, -1);
      } else if (action === "moveDown") {
        this.moveModel(index, 1);
      } else if (action === "remove") {
        this.removeModel(index);
      }
    },
  },
};
</script>
