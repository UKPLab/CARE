<template>
  <div class="container">
    <div class="row gy-2">
      <div class="col">
        <Card title="Users">
          <template v-slot:headerElements>
            <button class="btn btn-sm me-1 btn-secondary" type="button" @click="exportAllStats()" title="Export">
              <LoadIcon iconName="cloud-arrow-down"></LoadIcon>
              Export all statistics
            </button>
            <button class="btn btn-sm me-1" type="button" @click="loadUserData()" title="Refresh">
              <LoadIcon iconName="arrow-clockwise"></LoadIcon>
            </button>
          </template>
          <template v-slot:body>
            <Table :columns="user_table.columns"
                   :data="users"
                   :options="user_table.options"
                   ref="user_table"
                   @rowSelection="e => loadUserStats(e)"></Table>
          </template>
        </Card>
      </div>
    </div>
    <div class="row gy-2">
      <div class="col">
        <Card title="User Log">
          <template v-slot:body>
            <Table :columns="stats_table.columns"
                   :data="stats"
                   :options="stats_table.options"
                   ref="stats_table"
            ></Table>
          </template>
        </Card>
      </div>
    </div>
  </div>
  <ExportSingle name="stats" req-msg="statsGetAll" res-msg="statsAll" ref="export" :post-process="x => x.statistics">
  </ExportSingle>
</template>

<script>
/* BehaviorDashboard.vue - shows various user behavior stats

This component shows several information related to user behavior useful for admins. This includes:
1. a list of users
2. basic access stats and an export functionality for them

The sub-components are views on the same dataset, i.e. filtering in one leads to filtering in all
of them.

Author: Nils Dycke (dycke@ukp...)
Source: -
*/
import LoadIcon from "../../icons/LoadIcon.vue";
import Table from "@/basic/table/Table.vue";
import Card from "@/basic/Card.vue";
import ExportSingle from "@/basic/download/ExportSingle.vue";

export default {
  name: "UserStatistics",
  components: {LoadIcon, Table, Card, ExportSingle},
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
  props: {
    'admin': {
      required: false,
      default: false
    },
  },
  mounted() {
    this.loadUserData();
  },
  computed: {
    users() {
      return this.$store.getters["admin/getUsers"];
    },
    stats() {
      return this.selectedUsers.reduce((acc, user) => acc.concat(this.$store.getters["admin/getStatsByUser"](user.id)), []).filter(s => s !== null);
    }
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