<template>
  <div>
    <h6 class="text-secondary mt-4">{{ $t('nlp.inputMap.outputMapping') }}</h6>
    <div v-for="output in outputs" :key="output" class="mb-2">
      <label class="form-label">{{ output }}:</label>
      <FormSelect
          :model-value="mappings[output]"
          :options="{ options: destinations }"
          :value-as-object="true"
          @update:model-value="$emit('update', output, $event)"
      />
    </div>
  </div>
</template>

<script>
import FormSelect from "@/basic/form/Select.vue";

/**
 * Output mapping section: where each skill or hook output is written. Results
 * can always be saved in the document data; editor steps can also insert them
 * into the editor.
 *
 * @author Manu Sundar Raj Nandyal, Dennis Zyska, Mohammed Rawhani
 */
export default {
  name: "InputMapOutputs",
  components: {FormSelect},
  props: {
    outputs: {type: Array, required: true},
    /** Current destination per output. */
    mappings: {type: Object, required: true},
    studyStepId: {type: Number, default: null},
    workflowSteps: {type: Array, default: () => []},
  },
  emits: ["update"],
  computed: {
    destinations() {
      const sources = [
        {
          value: 'saveInDocumentData',
          name: this.$t('nlp.inputMap.saveInDocumentData'),
          type: 'documentData',
        }
      ];
      const workflow = this.workflowSteps.find(ws => ws.id === this.studyStepId);
      if (workflow?.stepType === 2) {
        sources.push({
          value: 'insertIntoEditor',
          name: this.$t('nlp.inputMap.insertIntoEditor'),
          type: 'editor',
        });
      }
      return sources;
    },
  },
};
</script>

<style scoped>
.form-label {
  font-weight: bold;
}

.text-secondary {
  color: var(--bs-secondary-color, #6c757d) !important;
}
</style>
