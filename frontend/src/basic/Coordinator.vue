<template>
  <BasicModal
    ref="coordinatorModal"
    :props="{id: id, hash: hash, resets: resets}"
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
      required: true,
    },
  },
  emits: ['submit'],
  data() {
    return {
      id: 0,
      data: {},
      success: false,
      hash: null,
      resets: 0,
      overrideDefaultValues: {},
    };
  },
  computed: {
    newData() {
      // eslint-disable-next-line no-unused-vars
      const resetCounter = this.resets; //do not remove; need for refreshing study object on modal hide!
      if (this.id === 0) {
        return {...this.defaultValue, ...this.overrideDefaultValues};
      } else {
        return {...this.$store.getters[this.table + "/get"](this.id)};
      }
    },
    fields() {
      return this.$store.getters[this.table + "/getFields"];
    },
  },
  watch: {
    newData() {
      this.data = this.newData;
    },
  },
  beforeMount() {
    this.study = this.defaultValue;
  },
  methods: {
    /**
     * Open the coordinator with the given id
     * @param id
     * @param defaultValues Override default values
     */
    open(id, defaultValues) {
      this.id = id;
      this.overrideDefaultValues = defaultValues;
      this.reset();
      this.$refs.coordinatorModal.open();
    },
    close() {
      this.$refs.coordinatorModal.close();
    },
    submit() {
      this.$emit('submit', this.data)
      this.$refs.coordinatorModal.waiting = true;
    },
    showSuccess() {
      this.success = true;
      this.$refs.coordinatorModal.waiting = false;
    },
    reset() {
      this.$refs.coordinatorModal.waiting = false;
      this.success = false;
      this.resets++;
    },
  }
}
</script>

<style scoped>

</style>