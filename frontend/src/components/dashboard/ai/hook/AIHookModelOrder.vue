<template>
  <div>
    <BasicTable
      :columns="tableColumns"
      :data="orderedModelRows"
      :options="tableOptions"
      :buttons="tableButtons"
      @action="onTableAction"
    />

    <div class="d-flex align-items-end gap-2 mt-3">
      <div class="flex-grow-1">
        <FormSelect
          v-model="modelToAddId"
          :options="addModelSelectOptions"
        />
      </div>
      <BasicButton
        :title="$t('ai.models.addModel')"
        class="btn btn-primary mb-3"
        icon="plus"
        :disabled="!modelToAddId"
        @click="addModel"
      />
    </div>
    <div v-if="selectableModels.length === 0" class="text-warning small mt-1">
      {{ $t("ai.hooks.noEnabledModels") }}
    </div>
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";
import FormSelect from "@/basic/form/Select.vue";

export default {
  name: "AIHookModelOrder",
  components: { BasicButton, BasicTable, FormSelect },
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
    };
  },
  computed: {
    tableColumns() {
      return [
        { name: "#", key: "priority", width: 1 },
        { name: this.$t("ai.common.model"), key: "modelLabel" },
      ];
    },
    tableButtons() {
      return [
        {
          icon: "arrow-up-short",
          title: this.$t("ai.actions.moveUp"),
          action: "moveUp",
          filter: [{ key: "canMoveUp", value: true }],
          options: {
            iconOnly: true,
            specifiers: { "btn-primary": true },
          },
        },
        {
          icon: "arrow-down-short",
          title: this.$t("ai.actions.moveDown"),
          action: "moveDown",
          filter: [{ key: "canMoveDown", value: true }],
          options: {
            iconOnly: true,
            specifiers: { "btn-secondary": true },
          },
        },
        {
          icon: "trash",
          title: this.$t("ai.actions.removeModel"),
          action: "remove",
          options: {
            iconOnly: true,
            specifiers: { "btn-outline-danger": true },
          },
        },
      ];
    },
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
        modelLabel: this.modelLabelById[modelId] || this.$t("ai.common.modelNumber", { id: modelId }),
        canMoveUp: index > 0,
        canMoveDown: index < this.modelIds.length - 1,
      }));
    },
    addModelSelectOptions() {
      return {
        key: `${this.idPrefix}ModelToAdd`,
        label: this.$t("ai.models.addModel"),
        help: this.$t("ai.hooks.modelOrderHelp"),
        options: [
          { value: null, name: this.$t("ai.models.selectModel") },
          ...this.modelsAvailableToAdd.map((model) => ({
            value: model.id,
            name: this.formatModelLabel(model),
          })),
        ],
      };
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
