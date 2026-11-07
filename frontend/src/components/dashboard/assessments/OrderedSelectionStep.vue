<template>
  <h6 class="mb-1">
    {{ title }}
  </h6>
  <p class="text-muted small">
    {{ description }}
  </p>

  <BasicTable
    ref="table"
    :model-value="tableSelection"
    :columns="columns"
    :data="rows"
    :options="tableOptions"
    :max-table-height="240"
    @update:model-value="onTableSelection"
  />

  <div
    v-if="error"
    class="invalid-feedback d-block mb-2"
  >
    {{ error }}
  </div>
  <div
    v-else-if="selectedRows.length > 0"
    class="text-muted small mt-1"
  >
    {{ $t("assessmentManagement.selection.selectedCount", { count: selectedRows.length }) }}
    <template v-if="selectedRows.length > 1">
      · {{ $t("assessmentManagement.selection.reorderHint") }}
      <BasicIcon
        icon-name="arrow-down"
        :size="12"
      />
    </template>
  </div>

  <h6 class="mt-3">
    {{ $t("assessmentManagement.selection.selectedOrder") }}
  </h6>
  <p
    v-if="selectedRows.length === 0"
    class="text-muted small"
  >
    {{ emptyText }}
  </p>
  <ol class="list-group list-group-numbered mb-0">
    <li
      v-for="(row, index) in selectedRows"
      :key="row.id"
      class="list-group-item d-flex align-items-center gap-2"
    >
      <div class="ms-1 me-auto">
        <div class="fw-semibold">
          {{ row.name }}
        </div>
        <div class="text-muted small">
          {{ row.code }}
        </div>
      </div>
      <span class="btn-group">
        <BasicButton
          class="btn btn-sm btn-outline-secondary"
          icon="arrow-up"
          :title="$t('assessmentManagement.selection.moveUp')"
          :disabled="index === 0"
          @click="move(index, -1)"
        />
        <BasicButton
          class="btn btn-sm btn-outline-secondary"
          icon="arrow-down"
          :title="$t('assessmentManagement.selection.moveDown')"
          :disabled="index === selectedRows.length - 1"
          @click="move(index, 1)"
        />
        <BasicButton
          class="btn btn-sm btn-outline-danger"
          icon="x-lg"
          :title="$t('assessmentManagement.selection.remove')"
          @click="remove(row.id)"
        />
      </span>
    </li>
  </ol>
</template>

<script>
/**
 * Second step of the assessment and rubric modals: pick existing records in a
 * searchable table and arrange them in an ordered list.
 *
 * `modelValue` is the ordered id list and the single source of truth. BasicTable
 * keeps its checked rows in an array it mutates in place (push/splice) and, when
 * that array is the very array passed as `model-value`, its own change check sees
 * no difference and never emits. So the table gets a dedicated array
 * (`tableSelection`) that is watched here and mirrored into `modelValue`; the
 * emitted-array path covers select-all, where the table swaps in a new array.
 *
 * @author Eyad Mohamed
 */
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import BasicIcon from "@/basic/Icon.vue";

export default {
  name: "OrderedSelectionStep",
  components: { BasicTable, BasicButton, BasicIcon },
  props: {
    modelValue: { type: Array, required: true },
    rows: { type: Array, required: true },
    columns: { type: Array, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    emptyText: { type: String, required: true },
    error: { type: String, required: false, default: "" },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      // Rows the table shows as checked; only ever changed in place (see header)
      tableSelection: this.rowsForIds(this.modelValue),
      tableOptions: {
        striped: true,
        hover: true,
        pagination: 5,
        selectableRows: true,
        search: true,
      },
    };
  },
  computed: {
    /** Selected rows in list order; ids no longer available are skipped. */
    selectedRows() {
      return this.modelValue
        .map((id) => this.rows.find((r) => r.id === id))
        .filter(Boolean);
    },
  },
  watch: {
    modelValue(ids) {
      this.syncTableSelection(ids);
    },
    // Catches the table's in-place push/splice on the shared array
    tableSelection: {
      handler() {
        this.applyIds(this.tableSelection.map((r) => r.id), false);
      },
      deep: true,
    },
  },
  methods: {
    rowsForIds(ids) {
      return ids.map((id) => this.rows.find((r) => r.id === id)).filter(Boolean);
    },
    /** Make `tableSelection` hold exactly the rows of `ids`, without replacing the array. */
    syncTableSelection(ids) {
      const wanted = new Set(ids);
      for (let i = this.tableSelection.length - 1; i >= 0; i--) {
        if (!wanted.has(this.tableSelection[i].id)) this.tableSelection.splice(i, 1);
      }
      const present = new Set(this.tableSelection.map((r) => r.id));
      this.rowsForIds(ids.filter((id) => !present.has(id))).forEach((r) => this.tableSelection.push(r));
    },
    /** Ids of the rows matching the table's current search, across all pages. */
    visibleIds() {
      const table = this.$refs.table;
      const rows = table && typeof table.getFilteredAndSortedData === "function"
        ? table.getFilteredAndSortedData()
        : this.rows;
      return new Set(rows.map((r) => r.id));
    },
    /**
     * Turn the table's selection into the new ordered id list.
     *
     * @param {Array} tableIds - Ids the table reports as checked
     * @param {boolean} windowed - True when the table swapped in its own array
     *   (select all / deselect all). Then only rows matching the current search
     *   are authoritative, so selections hidden by the search are kept.
     */
    applyIds(tableIds, windowed) {
      let wanted = new Set(tableIds);
      if (windowed) {
        const visible = this.visibleIds();
        this.modelValue.filter((id) => !visible.has(id)).forEach((id) => wanted.add(id));
      }
      // Keep the user's order for ids that stay selected, append new picks at the end
      const kept = this.modelValue.filter((id) => wanted.has(id));
      const added = tableIds.filter((id) => !kept.includes(id));
      const next = [...kept, ...added];
      if (next.length !== this.modelValue.length || next.some((id, i) => id !== this.modelValue[i])) {
        this.$emit("update:modelValue", next);
      }
      if (windowed) this.syncTableSelection(next);
    },
    onTableSelection(selected) {
      this.applyIds(selected.map((r) => r.id), true);
    },
    move(index, offset) {
      const next = [...this.modelValue];
      const target = index + offset;
      [next[index], next[target]] = [next[target], next[index]];
      this.$emit("update:modelValue", next);
    },
    remove(id) {
      this.$emit("update:modelValue", this.modelValue.filter((v) => v !== id));
    },
  },
};
</script>
