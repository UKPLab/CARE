<template>
  <BasicModal
    ref="modal"
    name="traceDbChangesModal"
    size="lg"
  >
    <template #title>
      DB Changes — <code>{{ trace ? trace.action : '' }}</code>
    </template>
    <template #body>
      <div v-if="dbChanges.length > 0">
        <BasicTable
          :columns="dbChangeColumns"
          :data="dbChangeRows"
          :options="dbChangeTableOptions"
          :max-table-height="300"
        />
      </div>
      <p v-else class="text-muted mb-0">
        No database changes for this trace.
      </p>
    </template>
    <template #footer>
      <BasicButton
        class="btn-secondary"
        text="Close"
        @click="close"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";

/**
 * Leaf modal in the replay-results drill-down: shows the database changes a
 * single replayed trace produced. Opened as a child of the traces modal;
 * closing returns to it via BasicModal's nested suspend/resume.
 *
 * @author: Ilyas Mohammed
 */
export default {
  name: "TraceDbChangesModal",
  components: { BasicModal, BasicButton, BasicTable },
  data() {
    return {
      trace: null,
      dbChangeColumns: [
        { name: "Table", key: "table", sortable: true },
        { name: "Record IDs", key: "recordIds" },
        { name: "Fields Modified", key: "fields" },
        { name: "Records", key: "recordCount", sortable: true },
      ],
      dbChangeTableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: true,
      },
    };
  },
  computed: {
    /**
     * Flatten the selected trace's dbChanges into table rows.
     * @returns {Array<Object>}
     */
    dbChanges() {
      return (this.trace && this.trace.dbChanges) || [];
    },
    dbChangeRows() {
      return this.dbChanges.map((c, i) => ({
        id: i,
        table: c.table,
        recordIds: c.records ? c.records.map(r => r.id).join(", ") : "-",
        fields: c.records && c.records[0] ? c.records[0].fields.join(", ") : "-",
        recordCount: c.recordCount,
      }));
    },
  },
  methods: {
    /**
     * Open the modal for a given trace row.
     * @param {Object} trace - trace row carrying action + dbChanges
     */
    open(trace) {
      this.trace = trace;
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
  },
};
</script>
