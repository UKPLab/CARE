<template>
  <div v-if="loading" class="text-muted mb-2">
    {{ $t("ai.share.loadingOptions") }}
  </div>
  <div
    v-else
    @click="syncFromTable"
    @change="syncFromTable"
  >
    <BasicTable
      ref="table"
      :model-value="selectedRows"
      :columns="columns"
      :data="readonly ? selectedRows : rows"
      :options="tableOptions"
      :max-table-height="360"
      @update:model-value="emitSelection"
    />
  </div>
</template>

<script>
import BasicTable from "@/basic/Table.vue";

/**
 * Recipient table for sharing an AI resource. Lists other users or user roles
 * (depending on `mode`) and keeps the selection as an id list. With `readonly`
 * it only shows the selected recipients, e.g. on the review step.
 *
 * The parent subscribes to the user and user_role tables.
 */
export default {
  name: "AIShareSelectStep",
  components: { BasicTable },
  props: {
    loading: { type: Boolean, default: false },
    mode: { type: String, default: "users" },
    currentUserId: { type: Number, required: true },
    selectedIds: { type: Array, required: true },
    readonly: { type: Boolean, default: false },
  },
  emits: ["update:selectedIds"],
  computed: {
    tableOptions() {
      if (this.readonly) {
        return { striped: true, hover: true, pagination: 10 };
      }
      return { striped: true, hover: true, pagination: 10, selectableRows: true, search: true };
    },
    columns() {
      const labelColumn = this.mode === "roles" ? this.$t("ai.common.role") : this.$t("ai.common.name");
      return [
        { name: labelColumn, key: "label", sortable: true },
        { name: this.$t("ai.share.type"), key: "type", sortable: true },
      ];
    },
    rows() {
      if (this.mode === "roles") {
        return (this.$store.getters["table/user_role/getAll"] || [])
          .filter((role) => !role.deleted)
          .map((role) => ({
            id: role.id,
            label: role.name || this.$t("ai.common.roleNumber", { id: role.id }),
            type: this.$t("ai.common.role"),
          }));
      }
      const me = Number(this.currentUserId);
      return (this.$store.getters["table/user/getAll"] || [])
        .filter((user) => !user.deleted && Number(user.id) !== me)
        .map((user) => ({ id: user.id, label: user.userName, type: this.$t("ai.common.user") }));
    },
    selectedRows() {
      const ids = new Set(this.normalizeIds(this.selectedIds));
      return this.rows.filter((row) => ids.has(Number(row.id)));
    },
  },
  methods: {
    normalizeIds(ids) {
      return [...new Set((ids || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
    },
    emitSelection(rows) {
      if (this.readonly) return;
      this.$emit("update:selectedIds", this.normalizeIds((rows || []).map((row) => row.id)));
    },
    syncFromTable() {
      const selectedRows = Array.isArray(this.$refs.table?.currentData) ? this.$refs.table.currentData : null;
      if (selectedRows) {
        this.emitSelection(selectedRows);
      }
    },
  },
};
</script>
