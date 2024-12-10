<template>
  <FormElement :options="options">
    <template #element>
      <table class="table table-hover">
        <tbody>
        <tr v-for="(item, index) in choices" :key="'entry_' + index">
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
import {sorter} from "@/assets/utils";

/**
 * Show a table to insert new elements
 *
 * @autor Dennis Zyska, Juliane Bechert
 */
export default {
  name: "FormChoice",
  components: {FormElement, FormDefault, FormSelect},
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
      currentData: this.modelValue && this.modelValue.length > 0
        ? [...this.modelValue]
        : [],
    };
  },
  computed: {
    fields() {
      return this.$store.getters[`table/${this.options.options.table}/getFields`];
    },
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

        return sorter(validChoices, choicesConfig.sort);
      }
      return [];
    },
  },
  watch: {
    modelValue: {
      handler(newValue) {
        if (JSON.stringify(newValue) !== JSON.stringify(this.currentData)) {

          this.currentData = this.choices.map((c, index) => {
            return this.fields.reduce((acc, field) => {
              acc[field.key] = newValue[index][field.key];
              // die workflowStepId
              acc["id"] = c.id;
              return acc;
            }, {});
          });
        }
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
    }
  },
  methods: {
    validate() { 
      const allValid = this.choices
      .every((item, index) => {
        return this.fields.every(field => {
          const fieldKey = field.key;
          return this.currentData[index]?.[fieldKey] !== null; 
        });
      });
      return allValid;
    },
  },
};
</script>

<style scoped>
</style>
