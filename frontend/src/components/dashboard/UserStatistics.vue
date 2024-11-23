<template>
  <Card title="Users">
    <template #headerElements>
      <BasicButton
        class="btn btn-sm me-1 btn-secondary"
        title="Export"
        icon="cloud-arrow-down"
        @click="exportAllStats()"
      />
      <BasicButton
        class="btn btn-sm me-1"
        title="Refresh"
        icon="arrow-clockwise"
        @click="loadUserData()"
      />
    </template>
    <template #body>
      <BasicTable
        ref="user_table"
        :columns="user_table.columns"
        :data="users"
        :options="user_table.options"
        @rowSelection="e => loadUserStats(e)"
      />
    </template>
  </Card>
  <hr>
  <Card :title="`Stats for ${selectedUsers ? selectedUsers.length : 0} User${selectedUsers && selectedUsers.length !== 1 ? 's': ''}`">
    <template #body>
      <BasicTable
        ref="stats_table"
        :columns="stats_table.columns"
        :data="stats"
        :options="stats_table.options"
      />
    </template>
  </Card>
  <ExportSingle
    ref="export"
    name="stats"
    req-msg="statsGetAll"
    res-msg="statsData"
    :post-process="x => x.statistics"
  />
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import Card from "@/basic/Card.vue";
import ExportSingle from "@/basic/download/ExportSingle.vue";

/**
 * Shows various user behavior stats
 *
 * This component shows several information related to user behavior useful for admins. This includes:
 * 1. a list of users
 * 2. basic access stats and an export functionality for them
 *
 * The sub-components are views on the same dataset, i.e. filtering in one leads to filtering in all
 * of them.
 *
 * @author: Nils Dycke
 */
export default {
  name: "UserStatistics",
  components: { BasicTable, BasicButton, Card, ExportSingle },
  props: {
    'admin': {
      type: Boolean,
      required: false,
      default: false
    },
  },
  data() {
    return {
      user_table: {
        options: {
          striped: true,
          hover: true,
          bordered: false,
          borderless: false,
          small: false,
          pagination: 10,
          selectableRows: true
        },
        columns: [
          {name: "User", key: "userName", sortable: true},
          {name: "ID", key: "id", sortable: true},
          {name: "Last Login", key: "lastLoginAt", sortable: true},
        ],
      },
      stats_table: {
        options: {
          striped: true,
          hover: true,
          bordered: false,
          borderless: false,
          small: false,
          pagination: 20
        },
        columns: [
          {name: "Time", key: "timestamp", sortable: true},
          {name: "User", key: "userId", sortable: true},
          {name: "Action", key: "action", sortable: true},
          {name: "Data", key: "data", sortable: true},
        ],
      },
      selectedUsers: []
    }
  },
  computed: {
    users() {
      return this.$store.getters["admin/getUsers"].map(u => {
        let uNew = {...u};
        uNew.lastLoginAt = u.lastLoginAt ? (new Date(u.lastLoginAt)).toLocaleDateString() : "-";
        return uNew;
      });
    },
    stats() {
      return this.selectedUsers.reduce((acc, user) => acc.concat(this.$store.getters["admin/getStatsByUser"](user.id)), []).filter(s => s !== null);
    }
  },
  mounted() {
    this.loadUserData();
  },
  methods: {
    loadUserData() {
      this.$socket.emit("userGetData");
    },
    loadUserStats(rows) {
      rows.forEach(user => {
        if (this.$store.getters["admin/getStatsByUser"](user.id) == null) {
          this.$socket.emit("statsGetByUser", {userId: user.id})
        }
      });
      this.selectedUsers = rows;
    },
    exportAllStats() {
      this.$refs.export.requestExport({}, "json");
    },
  }
}
</script>

<style scoped>
</style>