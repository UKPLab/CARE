<template>
  <FormElement :options="options">
    <template #element>
      <table class="table table-hover">
        <thead>
          <tr v-for="(step, index) in workflowSteps" :key="'step_' + index">
            <th :colspan="fields.length + 1" class="font-weight-bold">
              Select Document for Workflow Step {{ index + 1 }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(step, index) in workflowSteps" :key="'entry_' + index">
            <td v-for="f in fields" :key="f.name">
              <FormSelect
                v-if="f.type === 'select'"
                :ref="'ref_' + f.key"
                v-model="currentData[index].documentId"
                :data-table="true"
                :options="{ options: step.documentOptions, value: 'value', name: 'name' }"
                placeholder="Select a Document"
              />
              <FormDefault
                v-else
                :ref="'ref_' + f.key"
                v-model="currentData[index][f.key]"
                :data-table="true"
                :options="f"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </FormElement>
</template>

<script>
import FormElement from "@/basic/form/Element.vue"
import FormDefault from "@/basic/form/Default.vue"
import FormSelect from "@/basic/form/Select.vue"

/**
 * Show a table to insert new elements
 *
 * @autor Dennis Zyska, Juliane Bechert
 */
export default {
  name: "FormChoice",
  components: {FormElement, FormDefault, FormSelect},
  fetchData: ["workflow","workflow_step","document","study_step"],
  props: {
    options: { 
      type: Object,
      required: true,
    },
    modelValue: {
      type: Array,
      required: false,
      default: () => [],
    },
  },
  inject: {
    formData: {
      default: () => null
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      currentData: this.modelValue && this.modelValue.length > 0 
        ? [...this.modelValue] 
        : []  
    };
  },
  computed: {
    fields() {
      return this.$store.getters["table/" + this.options.options.table + "/getFields"];
    },
    workflowSteps() {
      const workflowId = this.formData?.workflowId;
      const allSteps = this.$store.getters["table/workflow_step/getAll"];
      const allDocuments = this.$store.getters["table/document/getAll"];
      
      const steps = allSteps
        .filter(step => step.workflowId === workflowId && step.workflowStepDocument === null)
        .map(step => {
          const filteredDocuments = allDocuments.filter(doc => {
            if (step.stepType === 1) return doc.type === 0; // PDF
            if (step.stepType === 2) return doc.type === 1; // HTML
            return false;
          });

          return {
            ...step,
            documentOptions: filteredDocuments.map(doc => ({
              value: doc.id,
              name: doc.name || doc.title
            }))
          };
        });
      
      if (!this.currentData.length) {
        this.currentData = steps.map(step => ({
          stepId: step.id,
          documentId: null, 
        }));
      }
      
      return steps;
    }
  },
  mounted() {
    this.initializeCurrentData();
  },
  watch: {
    modelValue: {
      handler(newValue) {
        this.currentData = newValue && newValue.length > 0 ? [...newValue] : this.currentData;
      },
      immediate: true,
      deep: true,
    },
    currentData: {
      handler() { 
        this.$emit("update:modelValue", this.currentData);
      },
      deep: true,
      immediate: true,
    }
  },
  methods: {
    initializeCurrentData() {
      if (this.modelValue && this.modelValue.length) {
        this.currentData = [...this.modelValue];
      } else {
        this.currentData = this.workflowSteps.map(step => ({
          stepId: step.id,
          documentId: null, 
        }));
      }
    },
    validate() {
      const allValid = this.currentData.every(entry => entry.documentId !== null);
      if (!allValid) {
        this.$socket.emit('#toast', {
          message: 'Required field missing',
          title: 'Error',
          variant: 'stepDocuments'
        });
      }
      return allValid;
    },
  }
}
</script>

<style scoped>
</style>
