<template>
  <div class="mt-2 mb-3 p-3 bg-light border rounded">
    <h6 class="mb-3 pb-2 border-bottom text-muted">
      Document Options
    </h6>
    <div class="mb-3">
      <label class="form-label mb-0 d-block">Document Types to Include</label>
      <a href="#" class="link-secondary small d-inline-block mb-2" @click.prevent="toggleAllTypes">
        {{ allTypesSelected ? 'Unselect All' : 'Select All' }}
      </a>
      <div v-for="opt in documentTypeOptions" :key="opt.value" class="form-check">
        <input
          :id="'doc-type-' + opt.value"
          class="form-check-input"
          type="checkbox"
          :checked="optionsData.selectedTypes.includes(opt.value)"
          @change="toggleType(opt.value)"
        />
        <label class="form-check-label" :for="'doc-type-' + opt.value">
          {{ opt.label }}
        </label>
      </div>
    </div>
    <BasicForm
      v-model="optionsData"
      :fields="fields"
    />
  </div>
</template>

<script>
import BasicForm from "@/basic/Form.vue";

/**
 * StepOptionsDocuments
 *
 * Provides configuration options for the documents export: which document
 * types to include, and whether to exclude non-consenting users' edits/annotations.
 *
 * @author Mélissa Loew
 */
export default {
  name: "StepOptionsDocuments",
  components: { BasicForm },
  props: {
    selectedTypes: {
      type: Array,
      default: () => [0, 1, 2, 4]
    },
    excludeNonConsentingEdits: {
      type: Boolean,
      default: false
    },
    excludeNonConsentingAnnotations: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:selectedTypes', 'update:excludeNonConsentingEdits', 'update:excludeNonConsentingAnnotations'],
  data() {
    return {
      optionsData: {
        selectedTypes: this.selectedTypes,
        excludeNonConsentingEdits: this.excludeNonConsentingEdits,
        excludeNonConsentingAnnotations: this.excludeNonConsentingAnnotations
      }
    };
  },
  computed: {
    documentTypeOptions() {
      return [
        { label: "PDF — Includes annotations and comments", value: 0 },
        { label: "HTML — Includes edits, plain text and HTML", value: 1 },
        { label: "Modal — Includes edits, plain text and HTML", value: 2 },
        { label: "ZIP — Includes the zip file", value: 4 },
      ];
    },
    allTypesSelected() {
      return this.documentTypeOptions.every(opt => this.optionsData.selectedTypes.includes(opt.value));
    },
    hasEditorTypes() {
      return this.optionsData.selectedTypes.some(t => t === 1 || t === 2);
    },
    hasPdfTypes() {
      return this.optionsData.selectedTypes.some(t => t === 0);
    },
    fields() {
      const formFields = [];

      if (this.hasEditorTypes) {
        formFields.push({
          key: "excludeNonConsentingEdits",
          label: "Exclude edits from non-consenting users",
          type: "switch",
        });
      }
      if (this.hasPdfTypes) {
        formFields.push({
          key: "excludeNonConsentingAnnotations",
          label: "Exclude annotations and comments from non-consenting users",
          type: "switch",
        });
      }

      return formFields;
    }
  },
  watch: {
    selectedTypes(value) {
      this.optionsData.selectedTypes = value;
    },
    excludeNonConsentingEdits(value) {
      this.optionsData.excludeNonConsentingEdits = value;
    },
    excludeNonConsentingAnnotations(value) {
      this.optionsData.excludeNonConsentingAnnotations = value;
    },
    hasEditorTypes(val) {
      if (!val) this.optionsData.excludeNonConsentingEdits = false;
    },
    hasPdfTypes(val) {
      if (!val) this.optionsData.excludeNonConsentingAnnotations = false;
    },
    optionsData: {
      handler(value) {
        this.$emit('update:selectedTypes', value.selectedTypes);
        this.$emit('update:excludeNonConsentingEdits', value.excludeNonConsentingEdits);
        this.$emit('update:excludeNonConsentingAnnotations', value.excludeNonConsentingAnnotations);
      },
      deep: true
    }
  },
  methods: {
    toggleAllTypes() {
      this.optionsData.selectedTypes = this.allTypesSelected
        ? []
        : this.documentTypeOptions.map(opt => opt.value);
    },
    toggleType(value) {
      const idx = this.optionsData.selectedTypes.indexOf(value);
      if (idx >= 0) {
        this.optionsData.selectedTypes.splice(idx, 1);
      } else {
        this.optionsData.selectedTypes.push(value);
      }
    }
  }
}
</script>