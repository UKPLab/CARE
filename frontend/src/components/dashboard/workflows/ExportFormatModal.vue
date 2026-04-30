<template>
  <BasicModal
    ref="modal"
    size="md"
    name="ExportFormatModal"
  >
    <template #title>
      {{ title }}
    </template>
    <template #body>
      <div class="d-grid gap-2">
        <BasicButton
          v-for="format in supportedFormats"
          :key="format.key"
          class="btn btn-outline-primary"
          :title="format.label"
          :text="format.label"
          :icon="format.icon"
          @click="selectFormat(format.key)"
        >
          {{ format.label }}
          <small class="d-block text-muted">{{ format.description }}</small>
        </BasicButton>
      </div>
    </template>
    <template #footer>
      <BasicButton
        class="btn btn-secondary"
        title="Cancel"
        @click="close()"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import {downloadObjectsAs, getSupportedExportFormats} from "@/assets/utils";

/**
 * Export Format Modal Component
 * 
 * Allows users to export workflows in either JSON or YAML format. The exported file will contain an array of workflow objects with their steps, excluding certain metadata fields.
 * 
 * @author Karim Ouf
 */
export default {
  name: "ExportFormatModal",
  components: { BasicModal, BasicButton },
  emits: ['formatSelected'],
  props: {
    title: {
      type: String,
      default: "Export",
    },
  },
  computed: {
    supportedFormats() {
      return getSupportedExportFormats();
    },
  },
  data() {
    return {
      filterId: null,
      table: null,
      childTable: null,
      childTableOptions: null,
      tableOptions: null,
    };
  },
  methods: {
    /**
     * Opens the export modal.
     * @param {number|null} id - ID of a single record to export. If null, all records in the table are exported.
     * @param {string|null} table - Table name to export from (e.g. "tag_set", "workflow").
     * @param {string|null} childTable - Optional child table to nest under each parent record (e.g. "tag", "workflow_step").
     * @param {object|null} tableOptions - Options for the parent table export (currently unused, reserved for future use).
     * @param {object|null} childTableOptions - Options for child table export.
     * @param {string} [childTableOptions.key] - Key name to nest children under in the exported object. Defaults to the childTable name.
     *
     * @example
     * Export a single record with no children
     * this.$refs.exportFormatModal.open(template.id, "template");
     *
     * @example
     * Export all records in a table
     * this.$refs.exportFormatModal.open(null, "workflow");
     *
     * @example
     * Export a single record with nested children (steps)
     * this.$refs.exportFormatModal.open(workflow.id, "workflow", "workflow_step");
     *
     * @example
     * Export with a custom key for nested children
     * this.$refs.exportFormatModal.open(tagSet.id, "tag_set", "tag", null, { key: "tags" });
     */
    open(id = null, table = null, childTable = null, tableOptions = null, childTableOptions = null) {
      this.filterId = id;
      this.table = table;
      this.childTable = childTable;
      this.tableOptions = tableOptions;
      this.childTableOptions = childTableOptions;
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    selectFormat(format) {
      this.close();
      this.$emit('formatSelected', format);
      if (this.table) {
        this.downloadDataWithFormat(format);
      }
    },
    downloadDataWithFormat(format) {
      const attributesToDelete = [
        "draft",
        "anonymous",
        "createdAt",
        "updatedAt",
        "deleted",
        "deletedAt",
        "userId"
      ];

      const tableName = this.table;
      const childTableName = this.childTable;
      const items = this.$store.getters[`table/${tableName}/getFiltered`](
        (w) => (this.filterId === null || w.id === this.filterId));

      let result = items;

      if (childTableName) {
        const fkField = tableName.replace(/_([a-z])/g, (_, c) => c.toUpperCase()) + 'Id';
        result = items.map(item => {
          const children = this.$store.getters[`table/${childTableName}/getFiltered`](
            (child) => child[fkField] === item.id && !child.deleted
          ).map(child => Object.fromEntries(Object.entries(child).filter(([key]) => !attributesToDelete.includes(key) && key !== 'id')));
          return { ...item, [this.childTableOptions.key || this.childTable]: children };
        });
      }
      result = result.map(item => Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'id')));

      const filename = this.filterId
        ? `${tableName}_${this.filterId}_${Date.now()}`
        : `${tableName}s_${Date.now()}`;
      downloadObjectsAs(result, filename, format);
      this.eventBus.emit("toast", {
        title: "Export Successful",
        message: `${tableName}${this.filterId ? '' : 's'} exported successfully in ${format.toUpperCase()} format`,
        variant: "success",
      });
    },
  }
}
</script>

<style scoped>
.btn small {
  font-size: 0.75rem;
  margin-top: 0.25rem;
}
</style>