<template>
  <Card title="Logs">
    <template #body>
      <Table
        :columns="columns"
        :data="data"
        :options="options"
      />
    </template>
  </Card>
</template>

<script>
import Table from "@/basic/table/Table.vue";
import Card from "@/basic/Card.vue";

/* Log.vue - shows the table of logs stored in the DB

This component loads the logs stored in the DB to present them to admin users.

Author: Dennis Zyska
Source: -
*/
export default {
  name: "Log",
  components: {Card, Table},
  data() {
    return {
      options: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 30,
      },
      columns: [
        {name: "", key: "icon", type: "icon"},
        {name: "Level", key: "level"},
        {name: "Time", key: "timestamp", sortable: true},
        {name: "User", key: "userId", sortable: true},
        {name: "Service", key: "service"},
        {name: "Message", key: "message"},
      ],
      data: [],
    }
  },
  sockets: {
    logAll: function (data) {
      this.data = data.map(d => {
        d.icon = "bug";
        if (d.userId === null) {
          d.userId = "System";
        }

        return d;
      });
    }
  },
  mounted() {
    this.$socket.emit("logGetAll", {limit: 100});
  }
}
</script>

<style scoped>

</style>