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
      :data="rows"
      :options="tableOptions"
      :max-table-height="360"
      @update:model-value="$emit('update:selectedRows', $event)"
    />
  </div>
</template>

<script>
import BasicTable from "@/basic/Table.vue";

export default {
  name: "AIShareSelectStep",
  components: { BasicTable },
  props: {
    loading: { type: Boolean, default: false },
    columns: { type: Array, required: true },
    rows: { type: Array, required: true },
    selectedRows: { type: Array, required: true },
  },
  emits: ["update:selectedRows"],
  data() {
    return {
      tableOptions: {
        striped: true,
        hover: true,
        pagination: 10,
        selectableRows: true,
        search: true,
      },
    };
  },
  methods: {
    syncFromTable() {
      const selectedRows = Array.isArray(this.$refs.table?.currentData) ? this.$refs.table.currentData : null;
      if (selectedRows) {
        this.$emit("update:selectedRows", selectedRows);
      }
    },
  },
};
</script>
