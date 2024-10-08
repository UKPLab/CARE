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
          <tr v-for="index in tableIndices" :key="index">
            <td v-for="f in fields" :key="f.name">
              <FormSelect
                v-if="f.type === 'select'"
                :ref="'ref_' + f.key"
                v-model="currentData[index][f.key]"
                :data-table="true"
                :options="f"
              />
              <FormDefault
                v-else
                :ref="'ref_' + f.key"
                v-model="currentData[index][f.key]"
                :data-table="true"
                :options="f"
              />
            </td>
            <td>
              <button
                class="btn btn-outline-primary"
                type="button"
                @click="deleteEntry(index)"
              >
                <svg
                  class="bi bi-trash3"
                  fill="currentColor"
                  height="16"
                  viewBox="0 0 16 16"
                  width="16"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1h-.995a.59.59 0 0 0-.01 0H11Zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5h9.916Zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47ZM8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5Z"
                  />
                </svg>
              </button>
            </td>
          </tr>
          <tr>
            <td
              colspan="4"
              style="text-align-last: end"
            >
              <button
                class="btn btn-primary"
                type="button"
                @click="add()"
              >
                Add
              </button>
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
    props: {
      options: { // hier bekommen wir workflowstepDocument - hier kann gefiltert werden, welche Dokumente gebraucht werden
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
      currentData: {
        handler() {
          this.$emit("update:modelValue", this.currentData);
        }, deep: true
      },
      modelValue: {
        handler() {
          this.currentData = (this.modelValue) ? this.modelValue : [];
        }, deep: true
      }
    },
    computed: {
      fields() {
        return this.$store.getters["table/" + this.options.options.table + "/getFields"];
      },
      /**
       * Get the indices of the current data whereby deleted elements are filtered out
       */
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
      add() {
        const newEntry = {};
        this.fields.forEach(f => {
          newEntry[f.key] = "default" in f 
            ? f.default 
            : null
        });

        if (Object.keys(newEntry).length) {
          this.currentData.push(newEntry);
        }
      },
      deleteEntry(index) {
        if (this.currentData[index].id) {
          this.currentData[index].deleted = true;
        } else {
          this.currentData.splice(index, 1);
        }
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