<template>
  <FormElement :options="options">
    <template #element>
      <table class="table table-hover">
        <tbody>
        <tr v-for="(item, index) in choices" :key="'entry_' + index">
          <td v-for="field in fields" :key="field.key">
            <div class="d-flex align-items-center">
                <span class="badge bg-primary me-2">
                  <i class="bi bi-file-earmark-text"></i> {{ item.stepNumber }}
                </span>

                <div class="flex-grow-1 d-flex align-items-center">
                  <FormSelect
                    v-if="field.type === 'select'"
                    :ref="'ref_' + field.key"
                    v-model="currentData[index][field.key]"
                    :data-table="true"
                    :parent-value="item"
                    :options="{options: field.options}"
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
                  <span
                    v-if="item.hasConfiguration"
                    class="ms-2"
                  >
                    <ConfigurationModal
                      :model-value="item.configuration"
                      :study-step-id="item.id"
                      :step-number="item.stepNumber"
                      :document-id="currentData.find((entry) => entry.id === item.id)?.documentId"
                      :workflow-steps="workflowSteps"
                      @update:model-value="(configData) => handleConfigUpdate(configData, item.id)"
                    />
                  </span>
                </div>
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
import ConfigurationModal from "@/basic/modal/ConfigurationModal.vue";
// TODO: Remove this
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";

/**
 * Show a table to insert new elements
 *
 * @autor Dennis Zyska, Juliane Bechert, Linyin Huang
 */
export default {
  name: "FormChoice",
  components: { FormElement, FormDefault, FormSelect, ConfigurationModal },
  inject: {
    formData: {
      default: () => null,
    },
  },
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
  emits: ["update:modelValue"],
  data() {
    return {
      currentData: this.modelValue && this.modelValue.length > 0 ? [...this.modelValue] : [],
    };
  },
  computed: {
    fields() {
      return this.$store.getters[`table/${this.options.options.table}/getFields`];
    },
    workflowSteps() {
      if (!this.formData) return [];
      const { workflowId } = this.formData;
      return this.$store.getters["table/workflow_step/getAll"].filter((step) => step.workflowId === workflowId);
    },
    // TODO: Simplify this
    choices() {
      if (this.options.options.choices) {
        const choicesConfig = this.options.options.choices;
        const filteredChoices = this.$store.getters[`table/${choicesConfig.table}/getFiltered`]((item) => {
          return choicesConfig.filter.every((filter) => {
            switch (filter.type) {
              case "formData":
                return item[filter.key] === this.formData[filter.value];
              default:
                return item[filter.key] === filter.value;
            }
          });
        });

        // Exclude items based on `disabled` conditions
        const validChoices = filteredChoices.filter((item) => {
          if (choicesConfig.disabled) {
            return choicesConfig.disabled.every((rule) => {
              return !(rule.type === "disabledItems" && item[rule.key] !== rule.value);
            });
          }
          return true; 
        });

        // Sort IDs in ascending order and calculate step numbers directly
        let stepCounter = 1;
        let previousId = null;

        return validChoices
          .sort((a, b) => a.id - b.id) 
          .map((item) => {
            if (previousId !== null && item.id - previousId > 1) {
              stepCounter += item.id - previousId - 1;
            }
            const stepNumber = stepCounter;
            stepCounter += 1; 
            previousId = item.id; 
            return {
              ...item,
              stepNumber, 
              hasConfiguration: !!item.configuration && Object.keys(item.configuration).length > 0,
            };
          });
      }
      return [];
    },
  },
  watch: {
    modelValue: {
      handler(newValue) {
        if (JSON.stringify(newValue) !== JSON.stringify(this.currentData)) {
          this.currentData = this.choices.map((choice, index) => ({
            ...this.fields.reduce((acc, field) => {
              acc[field.key] = newValue[index]?.[field.key] || null;
              return acc;
            }, {}),
            id: choice.id,
            configuration: newValue[index]?.configuration || {}
          }));
        }
      },
      deep: true,
      immediate: true,
    },
    currentData: {
      handler(newData) {
        if (JSON.stringify(this.modelValue) !== JSON.stringify(newData)) {
          this.$emit("update:modelValue", newData);
        }
      },
      deep: true,
      immediate: true,
    },
    choices: {
      handler(newValue, oldValue) {
        if (JSON.stringify(newValue) === JSON.stringify(oldValue)) {
          return;
        }

        this.currentData = this.choices.map((c) => {
          return this.fields.reduce((acc, field) => {
            acc[field.key] = null;
            // die workflowStepId
            acc["id"] = c.id;
            return acc;
          }, {});
        });
      },
      deep: true,
      immediate: true,
    },
  },
  methods: {
    validate() {
      const allValid = this.choices.every((item, index) => {
        return this.fields.every((field) => {
          const fieldKey = field.key;
          return this.currentData[index]?.[fieldKey] !== null;
        });
      });
      return allValid;
    },
    handleConfigUpdate(configData, itemId) {
      const itemIndex = this.currentData.findIndex((item) => item.id === itemId);

      if (itemIndex !== -1) {
        const updatedCurrentData = [...this.currentData];
        updatedCurrentData[itemIndex] = {
          ...updatedCurrentData[itemIndex],
          configuration: configData,
        };

        this.currentData = updatedCurrentData;
      }
    },
  },
};
</script>

<style scoped>
.bi-gear {
  color: #6c757d; /* Bootstrap muted color */
  cursor: pointer;
}
.bi-gear:hover {
  color: #0d6efd; /* Bootstrap primary color */
}
</style>
