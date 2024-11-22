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
import {sorter} from "@/assets/utils.js";
Array.prototype.sorter = sorter;

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
  watch: {
    modelValue: {
      handler(newValue) {
        if (JSON.stringify(newValue) !== JSON.stringify(this.currentData)) {
          this.currentData = [...newValue];
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
      handler() {
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
  computed: {
    fields() {
      return this.$store.getters[`table/${this.options.options.table}/getFields`];
    },
    choices() {
      if (this.options.options.choices) {
        const choicesConfig = this.options.options.choices;
        return this.$store.getters[`table/${choicesConfig.table}/getFiltered`](
          (e) => choicesConfig.filter.every(
            (f) => {
              switch (f.type) {
                case "formData":
                  return e[f.key] === this.formData[f.value];
                default:
                  return e[f.key] === f.value
              }
            }
          )).sorter(choicesConfig.sort);
      }
      return [];
    },
  },
  methods: {
    // TODO needs to be adapted to the new structure
    validate() {
      const allValid = this.currentData.every(entry => entry.studyId !== null);
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