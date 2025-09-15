<template>
    <BasicModal
      ref="nodeEditorModal"
      name="nodeEditorModal"
      lg
    >
      <template #title>
        <slot name="title">
          <span v-if="id > 0">Edit</span>
          <span v-else>New</span>
          Node
        </slot>
      </template>
      <template #body>
        <FormBuilder
          ref="form"
          :table="table"
          :table-namespace="tableNamespace"
          :read-only-fields="readOnlyFields"
        />
      </template>
      <template #footer>
        <button
          class="btn btn-secondary"
          @click="submit"
        >Update Node
        </button>
      </template>
    </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import FormBuilder from "@/basic/form/Builder.vue";
import {computed} from "vue";

/**
 * Basic Node Editor
 *
 * Opens a new coordinator modal to edit a node in the graph
 *
 * @author: Dennis Zyska
 */
export default {
  name: "BasicNodeAdder",
  components: {FormBuilder, BasicModal},
  provide() {
    return {
      // overwrite mainModal to support sub modals
      mainModal: computed(() => this.$refs.nodeEditorModal),
    }
  },
  props: {
    table: {
      type: String,
      required: true,
    },
    tableNamespace: {
      type: String,
      required: false,
      default: "table",
    },
    readOnlyFields: {
      type: Array,
      required: false,
      default: () => {
        return [];
      }
    }
  },
  emits: ["update:node"],
  data() {
    return {
      currentData: {},
      currentNodeId: null,
    };
  },
  methods: {
    open(nodeId, data) {
      this.currentNodeId = nodeId;
      this.currentData = data;
      this.$refs.nodeEditorModal.open();
    },
    submit() {
      if (this.$refs.form.validate()) {
        this.$emit("update:node", this.currentNodeId, this.$refs.form.getData());
        this.close();
      }
    },
    close() {
      this.$refs.nodeEditorModal.close();
    },
  }
}
</script>

<style scoped>

</style>
