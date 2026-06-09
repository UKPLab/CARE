<template>
  <div>
    <div class="mb-3">
      <label class="form-label" :for="`${idPrefix}ModelToAdd`">
        Models
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

    <div v-if="modelIds.length > 0" class="table-responsive">
      <table class="table table-sm table-bordered align-middle">
        <thead class="table-light">
          <tr>
            <th scope="col" style="width: 70px;">#</th>
            <th scope="col">Model</th>
            <th scope="col" style="width: 260px;">Move</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(modelId, index) in modelIds"
            :key="modelId"
          >
            <th scope="row">{{ index + 1 }}</th>
            <td>{{ modelLabelById[modelId] || `Model #${modelId}` }}</td>
            <td>
              <div class="btn-group btn-group-sm">
                <BasicButton
                  title=""
                  class="btn btn-primary btn-sm"
                  icon="arrow-up-short"
                  :disabled="index === 0"
                  @click="moveModel(index, -1)"
                />
                <BasicButton
                  title=""
                  class="btn btn-secondary btn-sm"
                  icon="arrow-down-short"
                  :disabled="index === modelIds.length - 1"
                  @click="moveModel(index, 1)"
                />
                <BasicButton
                  title=""
                  class="btn btn-outline-danger btn-sm"
                  icon="trash"
                  @click="removeModel(index)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="text-muted small">
      Add at least one model before continuing.
    </div>
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";

export default {
  name: "AIHookModelOrder",
  components: { BasicButton },
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
  },
};
</script>
