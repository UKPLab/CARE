<template>
  <div class="p-3">
    <div class="mb-4">
      <h6>Primary Key Mapping</h6>
      <div class="row g-3 align-items-end">
        <div class="col-md-6">
          <label class="form-label">Source key</label>
          <select
            :value="primaryKeyMapping.sourceField"
            class="form-select"
            @change="updatePrimaryKeyField('sourceField', $event.target.value)"
          >
            <option disabled value="">Select a field</option>
            <option
              v-for="field in sourceFields"
              :key="`primary-source-${field}`"
              :value="field"
            >
              {{ field }}
            </option>
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label">Match against</label>
          <select
            :value="primaryKeyMapping.targetField"
            class="form-select"
            @change="updatePrimaryKeyField('targetField', $event.target.value)"
          >
            <option value="extId">extId</option>
            <option value="email">email</option>
          </select>
        </div>
      </div>
      <div class="form-text">
        This mapping controls how CARE matches uploaded rows to submission owners in the selected assignment.
      </div>
    </div>

    <h6 class="mb-3">Metadata Mappings</h6>

    <div v-if="mappingValidationMessages.length > 0" class="alert alert-warning">
      <div
        v-for="(message, index) in mappingValidationMessages"
        :key="`mapping-warning-${index}`"
      >
        {{ message }}
      </div>
    </div>

    <div class="mapping-panel">
      <div class="mapping-panel-header">
        <div class="mapping-panel-title-row">
          <div class="mapping-col-source">Source key</div>
          <div class="mapping-col-target">Target metaKey</div>
          <div class="mapping-col-action">Action</div>
        </div>
        <BasicButton
          class="btn btn-outline-primary btn-sm"
          title="Add Mapping"
          @click="$emit('add-mapping')"
        />
      </div>

      <div
        v-if="metadataMappings.length === 0"
        class="text-muted small"
      >
        No metadata mappings configured yet.
      </div>

      <div
        v-for="(mapping, index) in metadataMappings"
        :key="mapping.id"
        class="mapping-item"
      >
        <div class="mapping-col-source">
          <select
            :value="mapping.sourceField"
            class="form-select"
            @change="updateMappingField(index, 'sourceField', $event.target.value)"
          >
            <option disabled value="">Select a field</option>
            <option
              v-for="field in sourceFields"
              :key="`mapping-source-${mapping.id}-${field}`"
              :value="field"
            >
              {{ field }}
            </option>
          </select>
        </div>
        <div class="mapping-arrow">→</div>
        <div class="mapping-col-target">
          <input
            :value="mapping.metaKey"
            class="form-control"
            list="metadata-key-presets"
            placeholder="topic"
            type="text"
            @input="updateMappingField(index, 'metaKey', $event.target.value)"
          >
        </div>
        <div class="mapping-col-action">
          <BasicButton
            class="btn btn-outline-danger btn-sm"
            title="Remove"
            :disabled="metadataMappings.length === 1"
            @click="$emit('remove-mapping', index)"
          />
        </div>
      </div>
    </div>

    <datalist id="metadata-key-presets">
      <option value="topic"></option>
      <option value="category"></option>
      <option value="tag"></option>
    </datalist>
  </div>
</template>

<script>

import BasicButton from "@/basic/Button.vue";

/**
 * Third step of the metadata import flow: configure primary key and metadata field mappings.
 *
 * @author Linyin Huang
 */
export default {
  name: "StepMapping",
  components: { BasicButton },
  props: {
    primaryKeyMapping: {
      type: Object,
      required: true,
    },
    metadataMappings: {
      type: Array,
      default: () => [],
    },
    sourceFields: {
      type: Array,
      default: () => [],
    },
    mappingValidationMessages: {
      type: Array,
      default: () => [],
    },
  },
  emits: ["update:primaryKeyMapping", "update:metadataMappings", "add-mapping", "remove-mapping"],
  methods: {
    updatePrimaryKeyField(field, value) {
      this.$emit("update:primaryKeyMapping", {
        ...this.primaryKeyMapping,
        [field]: value,
      });
    },
    updateMappingField(index, field, value) {
      this.$emit("update:metadataMappings", this.metadataMappings.map((mapping, i) => (
        i === index ? { ...mapping, [field]: value } : mapping
      )));
    },
  },
};
</script>

<style scoped>
.mapping-panel {
  border: 1px dashed #b9b9b9;
  border-radius: 0.5rem;
  padding: 0.9rem;
  background: var(--bs-tertiary-bg, #fafafa);
}

.mapping-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.85rem;
}

.mapping-panel-title-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 0.75rem;
  flex: 1;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--bs-body-color, #555);
  padding: 0 0.125rem;
}

.mapping-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
}

.mapping-item + .mapping-item {
  margin-top: 0.75rem;
}

.mapping-col-source,
.mapping-col-target {
  min-width: 0;
}

.mapping-col-action {
  display: flex;
  justify-content: flex-end;
}

.mapping-arrow {
  color: var(--bs-secondary-color, #6c757d);
  font-size: 1rem;
  line-height: 1;
  padding-top: 0.1rem;
}

@media (max-width: 767.98px) {
  .mapping-panel-header {
    flex-direction: column;
    align-items: stretch;
  }

  .mapping-panel-title-row {
    display: none;
  }

  .mapping-item {
    grid-template-columns: 1fr;
  }

  .mapping-col-action {
    justify-content: flex-start;
  }

  .mapping-arrow {
    display: none;
  }
}
</style>
