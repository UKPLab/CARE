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
                v-model="step.document"
                :data-table="true"
                :options="{ options: step.documentOptions, value: 'value', name: 'name' }"
                placeholder="Select a Document"
              />
              <FormDefault
                v-else
                :ref="'ref_' + f.key"
                v-model="step[f.key]"
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
   * @author Dennis Zyska
   */
  export default {
    name: "FormChoice",
    components: {FormElement, FormDefault, FormSelect},
    fetchData: ["workflow","workflow_step","document"],
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
        currentData: [],
      }
    },
    computed: {
      fields() {
        return this.$store.getters["table/" + this.options.options.table + "/getFields"];
      },
      workflowSteps() {
        const workflowId = this.formData?.workflowId;
        const allSteps = this.$store.getters["table/workflow_step/getAll"];
        const filteredSteps = allSteps.filter(step => step.workflowId === workflowId && step.workflowStepDocument === null);
        const allDocuments = this.$store.getters["table/document/getAll"];
        
        return filteredSteps.map(step => {
          const filteredDocuments = allDocuments.filter(doc => {
            if (step.stepType === 1) return doc.type === 0; // For PDF steps
            if (step.stepType === 2) return doc.type === 1; // For HTML steps
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
      }
    },
    mounted() {
      this.currentData = (this.modelValue) ? this.modelValue : [];
    },
    methods: {
      validate() {
        return Object.keys(this.$refs)
          .filter(child => typeof this.$refs[child][0].validate === 'function')
          .map(child => this.$refs[child][0].validate()).every(Boolean);
      },
    },
  }
  </script>
  
  <style scoped>
  
  </style>