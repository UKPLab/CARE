<template>
  <BasicModal
    ref="coordinatorModal"
    :props="{id: id, resets: resets}"
    lg
    name="coordinatorModal"
    @hide="reset"
  >
    <template #title>
      <slot name="title">
        <span v-if="id === 0">New</span>
        <span v-else>Edit</span>
        {{ title }}
      </slot>
    </template>
    <template #body>
      <span v-if="success">
        <slot name="success">
          The entry is successfully updated!
        </slot>
      </span>
      <span v-else>
        <BasicForm
          v-model="data"
          :fields="fields"
        />
      </span>
    </template>
    <template #footer>
      <span
        v-if="success"
        class="btn-group"
      >
        <slot name="success-footer">
          <button
            class="btn btn-secondary"
            @click="$refs.coordinatorModal.close()"
          >Close</button>
        </slot>
      </span>
      <span
        v-else
        class="btn-group"
      >
        <slot name="footer">
            <button
              class="btn btn-secondary"
              type="button"
              @click="$refs.coordinatorModal.close()"
            >{{ textCancel }}</button>
            <button
              class="btn btn-primary me-2"
              type="button"
              @click="submit"
            >
              {{ id === 0 ? textAdd : textUpdate }}
            </button>
          </slot>
      </span>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicForm from "@/basic/Form.vue";

/**
 * Basic Coordinator to add or edit database entries
 *
 * @props title: String Title of the modal
 * @props fields: Array Fields for basic form
 * @props textAdd: String Text for add button
 * @props textUpdate: String Text for update button
 * @props textCancel: String Text for cancel button
 * @props store: String Store in which the data is stored
 * @props defaultValue: Object Default value for the data
 * @slot title: Title of the modal
 * @slot success: Use slot to overwrite success message
 * @slot success-footer: Use slot to overwrite footer for if success
 * @slot footer: Use slot to overwrite footer for the modal
 * @emits submit: Submit event with the new data content
 *
 * @author: Dennis Zyska
 */
export default {
  name: "BasicCoordinator",
  components: {BasicModal, BasicForm},
  props: {
    title: {
      type: String,
      required: true,
    },
    textAdd: {
      type: String,
      default: "Add",
    },
    textUpdate: {
      type: String,
      default: "Update",
    },
    textCancel: {
      type: String,
      default: "Cancel",
    },
    table: {
      type: String,
      required: true,
    },
    defaultValue: {
      type: Object,
      required: false,
      default: () => {
        return {};
      },
    },
  },
  emits: ['submit'],
  data() {
    return {
      id: 0,
      data: {},
      success: false,
      overrideDefaultValues: {},
    };
  },
  computed: {
    fields() {
      return this.$store.getters["table/" + this.table + "/getFields"];
    },
  },
  methods: {
    /**
     * Open the coordinator with the given id
     * @param id
     * @param defaultValues Override default values
     */
    open(id, defaultValues) {
      if (this.fields) {
        this.reset();
        this.overrideDefaultValues = defaultValues;
        this.id = id;
        this.data = this.getData(id);
        this.$refs.coordinatorModal.open();
      } else {
        this.eventBus.emit('toast', {
          title: 'Error',
          message: 'The table '
            + this.table
            + ' has no defined fields!',
          type: 'error',
        });
      }
    },
    copy(id, defaultValues) {
      this.open(id, defaultValues);
      this.id = 0;
    },
    close() {
      this.$refs.coordinatorModal.close();
    },
    submit() {
      this.$emit('submit', {...this.data, ...{id: this.id}})
      this.$refs.coordinatorModal.waiting = true;
    },
    showSuccess() {
      this.success = true;
      this.$refs.coordinatorModal.waiting = false;
    },
    reset() {
      this.$refs.coordinatorModal.waiting = false;
      this.overrideDefaultValues = {};
      this.id = 0;
      this.data = this.getData(0);
      this.success = false;
    },
    getData(id) {
      if (id === 0) {
        return {...this.defaultValue, ...this.overrideDefaultValues};
      } else {
        return this.getDataFromStore(id, this.table, this.fields);
      }
    },
    /**
     * Get the data from the store
     * @param id Id of the key
     * @param table from which table the data should be taken
     * @param fields Fields of the table
     * @returns {{}}
     */
    getDataFromStore(id, table, fields) {
      const data = this.$store.getters["table/" + table + "/get"](id);
      return fields.reduce((acc, field) => {
        // if the key is in the data, use the data value
        acc[field.key] = (field.key in data) ? data[field.key]
          // if type is table, get the data from the store
          : (field.type === "table" && this.$store.getters["table/" + field.options.table + "/hasFields"])
            ? this.$store.getters["table/" + field.options.table + "/getFiltered"](e => e[field.options.id] === id).map(e => this.getDataFromStore(e.id, field.options.table, this.$store.getters["table/" + field.options.table + "/getFields"]))
            // else use the default value
            : null;
        return acc;
      }, {});
    },
  }
}
</script>

<style scoped>

</style>