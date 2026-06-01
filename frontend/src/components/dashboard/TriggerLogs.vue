<template>
  <Card title="Trigger logs">
    <template #body>
      <BasicTable
        :columns="columns"
        :data="logs"
        :options="options"
        :buttons="buttons"
        :max-table-height="'65vh'"
        @action="onAction"
      />
    </template>
  </Card>
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicTable from "@/basic/Table.vue";

export default {
  name: "DashboardTriggerLogs",
  components: {
    Card,
    BasicTable,
  },
  data() {
    return {
      options: {
        striped: true,
        hover: true,
        pagination: 10,
      },
      columns: [
        { name: "Trigger", key: "triggerName" },
        { name: "Status", key: "status", type: "badge" },
        { name: "Started", key: "startedAt", type: "datetime" },
        { name: "Completed", key: "completedAt", type: "datetime" },
      ],
      logs: [],
      buttons: [
        {
          icon: "arrow-repeat",
          options: {
            iconOnly: true,
            specifiers: { "btn-outline-primary": true },
          },
          title: "Re-execute trigger",
          action: "reexecute",
        },
        {
          icon: "shuffle",
          options: {
            iconOnly: true,
            specifiers: { "btn-outline-secondary": true },
          },
          title: "Apply different trigger",
          action: "applyDifferent",
        },
        {
          icon: "info-circle",
          options: {
            iconOnly: true,
            specifiers: { "btn-outline-dark": true },
          },
          title: "View trigger details",
          action: "viewDetails",
        },
      ],
    };
  },
  methods: {
    onAction() {
      // placeholder for queue actions
    },
  },
};
</script>
