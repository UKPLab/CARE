<template>
  <div class="mt-2 mb-3 p-3 bg-body-tertiary border rounded">
    <h6 class="mb-3 pb-2 border-bottom text-muted">
      Options
    </h6>
    <BasicForm
      v-model="optionsData"
      :fields="fields"
    />
    <small v-if="optionsData.generateAliases" class="text-muted d-block mt-1">
      Using the same seed ensures consistent aliases for your own exports. <strong>Note:</strong> Aliases are tied to your account and won't match other users' exports.
    </small>
  </div>
</template>

<script>
import BasicForm from "@/basic/Form.vue";

/**
 * StepOptions
 *
 * Provides configuration options for the export process. Currently, it allows 
 * the user to toggle alias generation for student names and set a custom seed for it.
 *
 * @author Mélissa Loew, Linyin Huang
 */

export default {
  name: "StepOptions",
  components: { BasicForm },
  props: {
    generateAliases: {
      type: Boolean,
      default: false
    },
    fakerSeed: {
      type: Number,
      default: 846569412
    },
    showGradeFormat: {
      type: Boolean,
      default: false
    },
    gradeFormat: {
      type: String,
      default: "json"
    },
    mergeCsvFiles: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:generateAliases', 'update:fakerSeed', 'update:gradeFormat', 'update:mergeCsvFiles'],
  data() {
    return {
      optionsData: {
        generateAliases: this.generateAliases,
        fakerSeed: this.fakerSeed,
        gradeFormat: this.gradeFormat,
        mergeCsvFiles: this.mergeCsvFiles
      }
    };
  },
  computed: {
    fields() {
      const formFields = [
        {
          key: "generateAliases",
          label: "Generate aliases for student names",
          type: "switch"
        }
      ];

      if (this.optionsData.generateAliases) {
        formFields.push({
          key: "fakerSeed",
          label: "Custom Seed (Optional)",
          type: "number",
          max: 999999999,
          placeholder: "e.g. 846569412"
        });
      }

      if (this.showGradeFormat) {
        formFields.push({
          key: "gradeFormat",
          label: "Grade file format",
          type: "select",
          options: [
            { name: "JSON", value: "json" },
            { name: "CSV", value: "csv" }
          ]
        });
      }

      if (this.showGradeFormat && this.optionsData.gradeFormat === "csv") {
        formFields.push({
          key: "mergeCsvFiles",
          label: "Merge CSV files by study, step, and configuration",
          type: "switch"
        });
      }

      return formFields;
    }
  },
  watch: {
    generateAliases(value) {
      this.optionsData.generateAliases = value;
    },
    fakerSeed(value) {
      this.optionsData.fakerSeed = value;
    },
    gradeFormat(value) {
      this.optionsData.gradeFormat = value;
    },
    mergeCsvFiles(value) {
      this.optionsData.mergeCsvFiles = value;
    },
    optionsData: {
      handler(value) {
        this.$emit('update:generateAliases', value.generateAliases);
        const normalizedSeed =
          value.fakerSeed === null || value.fakerSeed === undefined || value.fakerSeed === ""
            ? null
            : Number(value.fakerSeed);
        this.$emit('update:fakerSeed', Number.isNaN(normalizedSeed) ? null : normalizedSeed);
        this.$emit('update:gradeFormat', value.gradeFormat);
        this.$emit('update:mergeCsvFiles', value.mergeCsvFiles);
      },
      deep: true
    }
  }
}
</script>