<template>
  <Card :title="title">
    <template
      v-if="$slots.headerActions"
      #headerElements
    >
      <slot name="headerActions" />
    </template>
    <template #body>
      <BasicTable
        :columns="columns"
        :data="data"
        :options="resolvedTableOptions"
        :buttons="buttons"
        :max-table-height="maxTableHeight"
        @action="$emit('action', $event)"
      >
        <template
          v-if="$slots.tableExtras"
          #additional-buttons
        >
          <slot name="tableExtras" />
        </template>
      </BasicTable>
      <slot name="afterTable" />
    </template>
  </Card>
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicTable from "@/basic/Table.vue";
import {
  DEFAULT_DASHBOARD_TABLE_OPTIONS,
  DASHBOARD_TABLE_HEIGHT,
} from "@/basic/dashboard/constants.js";

/**
 * Shared shell for dashboard list pages: card, header actions, and BasicTable.
 * Pages supply columns, data, and row buttons; table defaults come from constants.
 *
 * @param {String} title - Card title
 * @param {Array} columns - BasicTable column definitions
 * @param {Array} data - BasicTable row data
 * @param {Array} buttons - BasicTable row-action buttons
 * @param {Object} tableOptions - Extra BasicTable options merged onto defaults
 * @param {String|Number} maxTableHeight - Max table height (defaults to DASHBOARD_TABLE_HEIGHT)
 *
 * @author Mohammad Elwan
 */
export default {
  name: "DashboardListPage",
  components: { Card, BasicTable },
  props: {
    title: {
      type: String,
      required: true,
    },
    columns: {
      type: Array,
      required: true,
    },
    data: {
      type: Array,
      required: true,
    },
    buttons: {
      type: Array,
      required: false,
      default: () => [],
    },
    tableOptions: {
      type: Object,
      required: false,
      default: null,
    },
    maxTableHeight: {
      type: [String, Number],
      required: false,
      default: DASHBOARD_TABLE_HEIGHT,
    },
  },
  emits: ["action"],
  computed: {
    resolvedTableOptions() {
      return this.tableOptions
        ? { ...DEFAULT_DASHBOARD_TABLE_OPTIONS, ...this.tableOptions }
        : { ...DEFAULT_DASHBOARD_TABLE_OPTIONS };
    },
  },
};
</script>

<style scoped>
:deep(.card-body) {
  padding: 1rem;
}
</style>
