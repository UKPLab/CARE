<template>
  <BasicModal
    ref="coordinatorModal"
    :props="{ id: id }"
    size="lg"
    name="coordinatorModal"
    @hide="reset"
  >
    <template #title>
      <slot name="title">
        <span v-if="data.id">{{ $t('common.editItem', { item: title }) }}</span>
        <span v-else>{{ $t('common.newItem', { item: title }) }}</span>
      </slot>
    </template>
    <template #body>
      <span v-if="success">
        <slot name="success">
          <span v-if="data.id"> {{$t('coordinator.entryUpdated')}}</span>
          <span v-else>{{$t('coordinator.entryAdded')}}</span>
        </slot>
      </span>
      <span v-else>
        <BasicForm
          ref="form"
          v-model="data"
          :fields="fields"
          @update:config-status="handleConfigStatusChange"
        />
      </span>
    </template>
    <template #footer>
      <span
        v-if="success"
        class="btn-group"
      >
        <slot name="success-footer">
          <slot name="buttons" />
          <button
            class="btn btn-secondary"
            @click="$refs.coordinatorModal.close()"
          >
          {{$t('common.close')}}
          </button>
        </slot>
      </span>
      <span
        v-else
        class="btn-group"
      >
        <slot name="footer">
          <slot name="buttons" />
          <button
            class="btn btn-secondary"
            type="button"
            @click="$refs.coordinatorModal.close()"
          >
            {{ textCancel  || $t('common.cancel')}}
          </button>
          <button
            class="btn btn-primary me-2"
            type="button"
            @click="submit"
          >
            {{ data.id ? (textUpdate || $t('common.update')) : (textAdd || $t('common.add')) }}
          </button>
        </slot>
      </span>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicForm from "@/basic/Form.vue";
import { resolveApiMessage, sorter } from "@/assets/utils.js";

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
 * @author: Dennis Zyska, Linyin Huang
 */
export default {
  name: "BasicCoordinator",
  components: { BasicModal, BasicForm },
  props: {
    title: {
      type: String,
      required: true,
    },
    // Empty defaults: footer uses `textX || $t(...)`; a literal default is always truthy and skips i18n.
    textAdd: {
      type: String,
      default: "",
    },
    textUpdate: {
      type: String,
      default: "",
    },
    textCancel: {
      type: String,
      default: "",
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
      },
    },
    customSubmit: {
      type: Boolean,
      required: false,
      default: false,
    },
    fieldsOverride: {
      type: Array,
      required: false,
      default: null,
    },
    noSuccessMessage: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  emits: ["submit", "success"],
  data() {
    return {
      data: {},
      success: false,
      configStatus: {},
      overrideDefaultValues: {},
    };
  },
  computed: {
    fields() {
      const baseFields =
        this.fieldsOverride ||
        this.$store.getters["table/" + this.table + "/getFields"] ||
        [];

      return baseFields.map((f) => {
        const field = { ...f };
        if (this.readOnlyFields.includes(field.key)) {
          field.readOnly = true;
        }
        return field;
      });
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    username() {
      return this.$store.getters['auth/getUsername'];
    },
  },
  methods: {
    /**
     * Open the coordinator with the given id
     * @param id
     * @param defaultValues Override default values
     * @param copy If the entry should be copied
     * @param dataOverrides Additional data to override after fetching
     */
    open(id = 0, defaultValues = {}, copy = false, dataOverrides = {}) {
      if (this.fields) {
        this.reset();
        this.overrideDefaultValues = defaultValues;
        this.data = this.getData(id, copy);
        // Apply data overrides after fetching data
        this.data = { ...this.data, ...dataOverrides };
        this.$refs.coordinatorModal.open();
      } else {
        this.eventBus.emit("toast", {
          title: this.$t('common.error'),
          message: this.$t('coordinator.errors.noFieldsDefined', { table: this.table }),
          variant: "danger",
        });
      }
    },
    close() {
      this.$refs.coordinatorModal.close();
    },
    handleConfigStatusChange(status) {
      this.configStatus = status;
    },
    submit() {
      const isValidated = this.$refs.form.validate();
      const { hasIncompleteConfig, incompleteSteps } = this.configStatus;
      
      if (!isValidated) return;
      if (hasIncompleteConfig) {
        const stepMessage = incompleteSteps.length === 1
          ? this.$t('coordinator.errors.stepSingle', { n: incompleteSteps[0] })
          : this.$t('coordinator.errors.stepMultiple', {
              list: incompleteSteps.slice(0, -1).join(", "),
              last: incompleteSteps[incompleteSteps.length - 1]
            });
        this.eventBus.emit("toast", {
          title: this.$t('coordinator.errors.incompleteConfig'),
          message: this.$t('coordinator.errors.incompleteConfigDetail', { steps: stepMessage }),
          variant: "danger",
        });
        return;
      }

      const data = { ...this.data };
      this.$emit("submit", data);

      if (this.customSubmit) {
        this.$refs.coordinatorModal.waiting = true;
        return;
      }

      this.$socket.emit(
        "appDataUpdate",
        {
          table: this.table,
          data: data,
        },
        (result) => {
          if (result.success) {
            this.showSuccess();
            this.$emit("success", result.data, data.id ? 'update' : 'create');
          } else {
            this.$refs.coordinatorModal.waiting = false;
            this.eventBus.emit("toast", {
              title: this.$t('coordinator.errors.saveFailed'),
              message: resolveApiMessage(result),
              variant: "danger",
            });
          }
        }
      );
      this.$refs.coordinatorModal.waiting = true;
    },
    showSuccess() {
      this.$refs.coordinatorModal.waiting = false;
      if (this.noSuccessMessage) {
        this.$refs.coordinatorModal.close();
      } else {
        this.success = true;
      }
    },
    reset() {
      this.$refs.coordinatorModal.waiting = false;
      this.overrideDefaultValues = {};
      this.data = this.getData(0);
      this.success = false;
      this.eventBus.emit("resetFormField");
    },
    getData(id, copy = false) {
      if (id === 0) {
        return { ...this.defaultValue, ...this.overrideDefaultValues };
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

      let returnData = fields.reduce((acc, field) => {
        // if the key is in the data, use the data value
        if (field.key in data) {
          acc[field.key] = data[field.key];
        } else if (
          ["table", "choice"].includes(field.type) &&
          field.options &&
          field.options.table &&
          this.$store.getters["table/" + field.options.table + "/hasFields"]
        ) {
          // Handle table/choice type fields that aren't directly in the data
          acc[field.key] = sorter(
            this.$store.getters["table/" + field.options.table + "/getFiltered"]((e) => e[field.options.id] === id),
            field.options.sort
          )
            .filter((e) => e[field.options.key] === data[field.key])
            .map((e) => {
              // Create a copy of the original entry
              const{id, ...copyData} = e;
              copyData.userId = this.userId;
              if (copyData.creator_name) {
                copyData.creator_name = this.username;
              };
            
              // If this entry has a documentId, fetch the parent document ID
              if (e.documentId) {
                const document = this.$store.getters["table/document/get"](e.documentId);
                if (document) {
                  copyData.parentDocumentId = document.parentDocumentId;
                }
              }

              // Get related data
              const relatedData = this.getDataFromStore(
                e.id,
                field.options.table,
                this.$store.getters["table/" + field.options.table + "/getFields"],
                copy
              );
              // Merge while preserving original properties
              return { ...copyData, ...relatedData };
            });
        } else {
          acc[field.key] = null;
        }
        return acc;
      }, {});

      if (!copy) {
        returnData = { ...returnData, ...{ id: data.id } };
      }

      return returnData;
    },
  },
};
</script>

<style scoped></style>