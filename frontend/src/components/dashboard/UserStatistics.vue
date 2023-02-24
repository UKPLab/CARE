<template>
  <Card title="Users">
    <template #headerElements>
      <button
        class="btn btn-sm me-1 btn-secondary"
        type="button"
        title="Export"
        @click="exportAllStats()"
      >
        <LoadIcon icon-name="cloud-arrow-down" />
        Export all statistics
      </button>
      <button
        class="btn btn-sm me-1"
        type="button"
        title="Refresh"
        @click="loadUserData()"
      >
        <LoadIcon icon-name="arrow-clockwise" />
      </button>
    </template>
    <template #body>
      <Table
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
      <Table
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
import LoadIcon from "../../icons/LoadIcon.vue";
import Table from "@/basic/table/Table.vue";
import Card from "@/basic/Card.vue";
import ExportSingle from "@/basic/download/ExportSingle.vue";

/* UserStatistics.vue - shows various user behavior stats

This component shows several information related to user behavior useful for admins. This includes:
1. a list of users
2. basic access stats and an export functionality for them

The sub-components are views on the same dataset, i.e. filtering in one leads to filtering in all
of them.

Author: Nils Dycke (dycke@ukp...)
Source: -
*/
export default {
  name: "UserStatistics",
  components: {LoadIcon, Table, Card, ExportSingle},
  props: {
    'admin': {
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
          {name: "Role", key: "sysrole", sortable: true},
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
    loadUserStats(userIds, force = false) {
      userIds.forEach(user => {
        if (this.$store.getters["admin/getStatsByUser"](user.id) == null) {
          this.$socket.emit("statsGetByUser", {userId: user.id})
        }
      });
      this.selectedUsers = userIds;
    },
    exportAllStats() {
      this.$refs.export.requestExport({}, "json");
    },
  }
}
</script>

<style scoped>
</style>