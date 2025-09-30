<template>
  <Card title="Logs">
    <template #body>
      <BasicTable
        :columns="columns"
        :data="data"
        :options="options"
        @pagination-update="paginationUpdate"
      />
    </template>
  </Card>
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import Card from "@/components/dashboard/card/Card.vue";

/** Show the logs stored in the DB
 *
 * This component loads the logs stored in the DB to present them to admin users.
 *
 * @author Dennis Zyska
 */
export default {
  name: "DashboardLog",
  components: {Card, BasicTable},
  data() {
    return {
      options: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        totalWidth: 100,
        pagination: {
          serverSide: true,
          itemsPerPage: 10,
          itemsPerPageList: [10, 25, 50, 100],
          total: 0,
          showPages: 3,
        },
      },
      columns: [
        {name: "", key: "icon", type: "icon", width: "auto"},
        {
          name: "Level",
          key: "level",
          width: "1",
          filter: [
            {key: "error", name: "Error"},
            {key: "warn", name: "Warning"},
            {key: "info", name: "Info"},
            {key: "debug", name: "Debug"}]
        },
        {name: "Time", key: "timestamp", sortable: true, width: 2},
        {name: "User", key: "creator_name", sortable: true, sortKey: "userId", width: 1},
        {name: "Service", key: "service", width: 1},
        {name: "Message", key: "message", width: 8},
      ],
      data: [],
    }
  },
  sockets: {
    logAll: function (data) {
      this.options.pagination.total = data.count;
      this.data = data.rows.map(d => {
        d.icon = {
          icon: "bug",
          color: this.getBugColor(d.level),
        }
        return d;
      });
    }
  },
  mounted() {
    this.$socket.emit("logGetAll", {page: 0, limit: this.options.pagination.limit});
  },
  methods: {
    paginationUpdate(data) {
      this.data = [];
      this.$socket.emit("logGetAll", data);
    },
    getBugColor(level) {
      if (level === "error") {
        return "#ff0000";
      } else if (level === "warn") {
        return "#ff9900";
      } else if (level === "info") {
        return "#0000ff";
      } else {
        return "#000000";
      }
    },
  }
}
</script>

<style scoped>

</style>