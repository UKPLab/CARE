<template>
  <FormElement :options="options">
    <template #element>
      <table class="table table-hover">
        <thead>
          <tr>
            <th v-for="f in fields" :key="f.name" scope="col">
              {{ f.label }}
            </th>
            <th scope="col">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(step, stepIndex) in workflowSteps" :key="'step_' + stepIndex">
            <td :colspan="fields.length + 2" class="font-weight-bold">
              Select Document for Workflow Step {{ stepIndex + 1 }}: {{ step.name }}
            </td>
          </tr>
          <tr v-for="(currentData, index) in currentData" :key="'entry_' + index">
            <td>
              <FormSelect
                v-if="allDocumentOptions"
                :ref="index"
                v-model="currentData.document"
                :options="allDocumentOptions"
                placeholder="Select a Document"
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
    watch: {
      modelValue: {
        handler() {
          this.currentData = (this.modelValue) ? this.modelValue : [];
        }, deep: true
      }
    },
      workflowSteps: {
        handler() {
          console.log("WorkflowSteps changed: updating currentData");
          this.updateCurrentData();
        },
        immediate: true,
        deep: true,
      },
    computed: {
      fields() {
        return this.$store.getters["table/" + this.options.options.table + "/getFields"];
      },
      workflowSteps() {
        const workflowId = this.formData?.workflowId;
        const allSteps = this.$store.getters["table/workflow_step/getAll"];
        const steps = allSteps.filter((step) => step.workflowId === workflowId && step.workflowStepDocument === null);
        return steps;
      },
      allDocumentOptions() {
        console.log("Computed: Fetching all document options.");
        if (!this.options || !this.options.options) {
          console.log("Options are not fully available yet.");
          return [];
        }
        const allDocuments = this.$store.getters["table/document/getAll"];
        console.log("Computed: All Documents: ", allDocuments);
        return allDocuments;
      },
      tableIndices() {
        return this.currentData.map((e, i) => ({
          index: i,
          deleted: e.deleted
        })).filter((e) => !e.deleted).map(e => e.index)
      },
      data() {
        return this.$store.getters["table/" + this.options.options.table + "/getAll"].filter(
          d => d[this.options.options.id] === this.options.options.value
        );
      },
    },
    mounted() {
      this.currentData = (this.modelValue) ? this.modelValue : [];
    },
    methods: {
      updateCurrentData() {
        console.log("Updating currentData based on workflowSteps.");
        const newData = this.workflowSteps.map((step) => {
          const newEntry = {};
          this.fields.forEach((f) => {
            newEntry[f.key] = "default" in f ? f.default : null;
          });
          newEntry.stepId = step.id;
          newEntry.stepName = step.name;
          newEntry.document = null;
          return newEntry;
        });
        this.currentData = newData;
        console.log("Updated currentData: ", this.currentData);
      },
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