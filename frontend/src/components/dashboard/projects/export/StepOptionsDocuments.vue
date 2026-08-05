<template>
  <div class="mt-2 mb-3 p-3 bg-light border rounded">
    <h6 class="mb-3 pb-2 border-bottom text-muted">
      Document Options
    </h6>
    <div class="d-flex justify-content-end gap-2 mb-2">
      <BasicButton
        class="btn btn-sm btn-outline-secondary"
        title="Select All"
        @click="selectAllTypes"
      />
      <BasicButton
        class="btn btn-sm btn-outline-secondary"
        title="Unselect All"
        @click="unselectAllTypes"
      />
    </div>
    <BasicForm
      v-model="optionsData"
      :fields="fields"
    />
  </div>
</template>

<script>
import BasicForm from "@/basic/Form.vue";
import BasicButton from "@/basic/Button.vue";

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
  components: { BasicForm, BasicButton },
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
    hasEditorTypes() {
      return this.optionsData.selectedTypes.some(t => t === 1 || t === 2);
    },
    hasPdfTypes() {
      return this.optionsData.selectedTypes.some(t => t === 0);
    },
    fields() {
      const formFields = [
        {
          key: "selectedTypes",
          label: "Document Types to Include",
          type: "checkbox",
          options: [
            { label: "PDF — Includes annotations and comments", value: 0 },
            { label: "HTML — Includes edits, plain text and HTML", value: 1 },
            { label: "Modal — Includes edits, plain text and HTML", value: 2 },
            { label: "ZIP — Includes the zip file", value: 4 },
          ],
        },
      ];

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
    selectAllTypes() {
      this.optionsData.selectedTypes = this.fields.find(f => f.key === 'selectedTypes').options.map(o => o.value);
    },
    unselectAllTypes() {
      this.optionsData.selectedTypes = [];
    }
  }
}
</script>