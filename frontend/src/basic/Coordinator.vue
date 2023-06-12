<template>
  <BasicModal
    ref="coordinatorModal"
    :props="{id: id}"
    lg
    name="coordinatorModal"
    @hide="reset"
  >
    <template #title>
      <slot name="title">
        <span v-if="data.id">Edit</span>
        <span v-else>New</span>
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
              {{ data.id ? textUpdate: textAdd }}
            </button>
          </slot>
      </span>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicForm from "@/basic/Form.vue";
import {v4 as uuid} from "uuid";

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
    readOnlyFields: {
      type: Array,
      required: false,
      default: () => {
        return [];
      }
    }
  },
  emits: ['submit'],
  data() {
    return {
      data: {},
      success: false,
      overrideDefaultValues: {},
      requestId: null,
    };
  },
  sockets: {
    appDataUpdateSuccess(data) {
      if (data.id === this.requestId) {
        if (data.success) {
          this.showSuccess();
        }
      }
    },
  },
  computed: {
    fields() {
      return this.$store.getters["table/" + this.table + "/getFields"].map(f => {
        if (this.readOnlyFields.includes(f.key)) {
          f.readOnly = true;
        }
        return f;
      })
    },
  },
  methods: {
    /**
     * Open the coordinator with the given id
     * @param id
     * @param defaultValues Override default values
     * @param copy If the entry should be copied
     */
    open(id = 0, defaultValues = {}, copy = false) {
      if (this.fields) {
        this.reset();
        this.overrideDefaultValues = defaultValues;
        this.requestId = uuid();
        this.data = this.getData(id, copy);
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
    close() {
      this.$refs.coordinatorModal.close();
    },
    submit() {
      const data =  {...this.data};
      this.$emit('submit', data)
      this.$socket.emit("appDataUpdate", {id: this.requestId, table: this.table, data: data});
      this.$refs.coordinatorModal.waiting = true;
    },
    showSuccess() {
      this.success = true;
      this.$refs.coordinatorModal.waiting = false;
    },
    reset() {
      this.$refs.coordinatorModal.waiting = false;
      this.overrideDefaultValues = {};
      this.data = this.getData(0);
      this.success = false;
    },
    getData(id, copy = false) {
      if (id === 0) {
        return {...this.defaultValue, ...this.overrideDefaultValues};
      } else {
        return this.getDataFromStore(id, this.table, this.fields, copy);
      }
    },
    /**
     * Get the data from the store
     * @param id Id of the key
     * @param table from which table the data should be taken
     * @param fields Fields of the table
     * @param copy If the data should be copied (id will not be provided)
     * @returns {{}}
     */
    getDataFromStore(id, table, fields, copy = false) {
      const data = this.$store.getters["table/" + table + "/get"](id);

      let return_data = fields.reduce((acc, field) => {
        // if the key is in the data, use the data value
        acc[field.key] = (field.key in data) ? data[field.key]
          // if type is table, get the data from the store
          : (field.type === "table" && this.$store.getters["table/" + field.options.table + "/hasFields"])
            ? this.$store.getters["table/" + field.options.table + "/getFiltered"](e => e[field.options.id] === id)
              .map(e =>
                this.getDataFromStore(e.id, field.options.table, this.$store.getters["table/" + field.options.table + "/getFields"], copy))
            // else use the default value
            : null;
        return acc;
      }, {});

      if (!copy) {
        return_data = {...return_data, ...{id: data.id}};
      }

      return return_data;
    },
  }
}
</script>

<style scoped>

</style>