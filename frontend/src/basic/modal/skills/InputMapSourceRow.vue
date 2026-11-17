<template>
  <div class="mb-2">
    <label class="form-label">{{ input }}:</label>
    <FormSelect
        :model-value="modelValue"
        :options="{ options: sources }"
        :value-as-object="true"
        @update:model-value="selectSource"
    />
    <div v-if="isHook && modelValue?.type === 'submission'" class="mt-1 ps-1">
      <FormRadio
          :model-value="selectedFiles[0] || null"
          :options="{ key: fieldKey, label: 'nlp.inputMap.selectFilesToInclude', options: fileChoices }"
          @update:model-value="selectFile"
      />
    </div>
  </div>
</template>

<script>
import FormSelect from "@/basic/form/Select.vue";
import FormRadio from "@/basic/form/Radio.vue";

/**
 * One skill input of the input mapping: the data-source picker and, for AI
 * hooks mapped to a submission, the submission file to include. The chosen
 * files and their validation patterns are stored on the mapping itself
 * (`selectedFiles`, `filePatterns`), so the row keeps no copy of them.
 *
 * @author Manu Sundar Raj Nandyal, Dennis Zyska, Mohammed Rawhani
 */
export default {
  name: "InputMapSourceRow",
  components: {FormSelect, FormRadio},
  props: {
    input: {type: String, required: true},
    /** Current mapping for this input, or null. */
    modelValue: {type: Object, default: null},
    sources: {type: Array, default: () => []},
    isHook: {type: Boolean, default: false},
    /** Unique form key for the submission file choice. */
    fieldKey: {type: String, required: true},
  },
  emits: ["update:modelValue"],
  computed: {
    selectedFiles() {
      return this.modelValue?.type === "submission" ? this.modelValue.selectedFiles || [] : [];
    },
    /**
     * File options from the first validation configuration: always "pdf" (the
     * PDF document) plus the named files inside the ZIP entry. Each zip option
     * carries its validation-config regex so the backend can match it.
     */
    fileOptions() {
      const configurations = this.$store.getters["table/configuration/getAll"] || [];
      const validationConfig = configurations.find(cfg => cfg.type === 1) || null;
      const requiredFiles = validationConfig?.content?.rules?.requiredFiles || [];
      const options = [{value: "pdf", label: "pdf", pattern: null}];
      const zipEntry = requiredFiles.find(f => Array.isArray(f.includeFiles) && f.includeFiles.length);
      if (zipEntry) {
        zipEntry.includeFiles.forEach(f => {
          if (f.name) options.push({value: f.name, label: f.name, pattern: f.pattern || null});
        });
      }
      return options;
    },
    fileChoices() {
      return this.fileOptions.map(f => ({value: f.value, label: f.label}));
    },
  },
  methods: {
    /**
     * Emits the chosen source. A hook submission source keeps the files chosen
     * for the previous submission source; other sources drop them.
     * @param {Object|null} source - Selected data source.
     * @returns {void}
     */
    selectSource(source) {
      if (this.isHook && source?.type === "submission") {
        const files = this.selectedFiles;
        this.$emit("update:modelValue", {...source, selectedFiles: files, filePatterns: this.buildFilePatterns(files)});
        return;
      }
      this.$emit("update:modelValue", source);
    },
    /**
     * Selects the single submission file to include (radio).
     * @param {string} fileName - File option value.
     * @returns {void}
     */
    selectFile(fileName) {
      const files = [fileName];
      this.$emit("update:modelValue", {...this.modelValue, selectedFiles: files, filePatterns: this.buildFilePatterns(files)});
    },
    /**
     * Builds a { name: pattern } map for the selected files (pdf has no pattern).
     * @param {string[]} selectedFiles - Selected file option values.
     * @returns {Object} Patterns keyed by file name.
     */
    buildFilePatterns(selectedFiles) {
      const patterns = {};
      this.fileOptions.forEach(opt => {
        if (opt.pattern && selectedFiles.includes(opt.value)) {
          patterns[opt.value] = opt.pattern;
        }
      });
      return patterns;
    },
  },
};
</script>

<style scoped>
.form-label {
  font-weight: bold;
}
</style>
