<template>
  <FormElement :options="options">
    <template #element>
      <table class="table table-hover">
        <tbody>
          <tr v-for="(item, index) in choiceItems" :key="'entry_' + index">
            <td v-for="field in fields" :key="field.key">
              <div class="d-flex align-items-center">
                <span class="badge bg-primary me-2">
                  <i class="bi bi-file-earmark-text"></i> {{ index + 1 }}
                </span>
                <FormSelect
                  v-if="field.type === 'select'"
                  :ref="'ref_' + field.key"
                  v-model="currentData[index][field.key]"
                  :data-table="true"
                  :options="{ options: item.allChoiceOptions, value: 'value', name: 'name' }"
                  :placeholder="field.label"
                  class="flex-grow-1"  
                  style="min-width: 200px; max-width: 800px;"
                />
                <FormDefault
                  v-else
                  :ref="'ref_' + field.key"
                  v-model="currentData[index][field.key]"
                  :data-table="true"
                  :options="field"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </FormElement>
</template>

<script>
import FormElement from "@/basic/form/Element.vue";
import FormDefault from "@/basic/form/Default.vue";
import FormSelect from "@/basic/form/Select.vue";

/**
 * Show a table to insert new elements
 *
 * @autor Dennis Zyska, Juliane Bechert
 */
export default {
  name: "FormChoice",
  components: { FormElement, FormDefault, FormSelect },
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
      default: () => null,
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      currentData: this.modelValue && this.modelValue.length > 0 
        ? [...this.modelValue] 
        : [],
    };
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
  computed: {
    fields() {
      return this.$store.getters[`table/${this.options.options.table}/getFields`];
    },
    choiceItems() {
      const fieldsData = this.fields.find(field => field.key); // in our case we need documentId defined in study_step
      const relatedDataOptions = fieldsData?.options?.relatedTable;

      const fieldsItems = fieldsData
        ? this.$store.getters[`table/${fieldsData.options.table}/getAll`] // in our case all documents 
        : [];
      const relatedItems = relatedDataOptions // in our case workflow_step data
        ? this.$store.getters[`table/${relatedDataOptions.table}/getAll`]
        : [];

      const formDataId = this.formData?.workflowId; // in our case we need workflowId

      const choiceOptions = relatedItems // TODO this part needs to be more generalized
        .filter(relatedItemData => relatedItemData.workflowId === formDataId && relatedItemData.workflowStepDocument === null)
        .map(relatedItemData => {
          const filteredItems = fieldsItems.filter(doc => {
            if (relatedItemData.stepType === 1) return doc.type === 0; // if workflow_step type = 1 use PDF
            if (relatedItemData.stepType === 2) return doc.type === 1; // if workflow_step type = 2 use HTML
            return false;
          });

          return {
            ...relatedItemData,
            allChoiceOptions: filteredItems.map(doc => ({
              value: doc.id,
              name: doc.name || doc.title
            }))
          };
        });
      
      if (!this.currentData.length) {
        this.currentData = choiceOptions.map(step => ({
          stepId: step.id,
          documentId: null, 
        }));
      }
      
      return choiceOptions;
    }
  },
  mounted() {
    this.initializeCurrentData();
  },
  methods: {
    initializeCurrentData() {
    if (this.modelValue && this.modelValue.length) {
      this.currentData = [...this.modelValue];
    } else {
      this.currentData = this.choiceItems.map(item => {
        const entry = { stepId: item.id };
        this.fields.forEach(field => {
          entry[field.key] = null;
        });
        return entry;
      });
    }
  },
    validate() {
      const allValid = this.currentData.every(entry => entry.documentId !== null);
      if (!allValid) {
        this.$socket.emit("#toast", {
          message: "Required field missing",
          title: "Error",
          variant: "stepDocuments",
        });
      }
      return allValid;
    },
  },
};
</script>

<style scoped>
</style>