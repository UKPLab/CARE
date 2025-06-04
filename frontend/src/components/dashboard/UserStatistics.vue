<template>
  <Card title="Users">
    <template #headerElements>
      <BasicButton
          class="btn btn-sm me-1 btn-secondary"
          title="Export as CSV"
          icon="cloud-arrow-down"
          @click="downloadBehaviourData('csv')"
      />
      <BasicButton
          class="btn btn-sm me-1 btn-secondary"
          title="Export as JSON"
          icon="cloud-arrow-down"
          @click="downloadBehaviourData('json')"
      />
    </template>
    <template #body>
      <BasicTable
          ref="user_table"
          v-model="selectedUsers"
          :columns="user_table.columns"
          :data="users"
          :options="user_table.options"
      />
    </template>
  </Card>
  <hr>
  <Card
      :title="`Stats for ${selectedUsers ? selectedUsers.length : 0} User${selectedUsers && selectedUsers.length !== 1 ? 's': ''}`">
    <template #body>
      <BasicTable
          ref="stats_table"
          :columns="stats_table.columns"
          :data="stats"
          :options="stats_table.options"
      />
    </template>
  </Card>
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import Card from "@/basic/Card.vue";
import ExportSingle from "@/basic/download/ExportSingle.vue";
import {downloadObjectsAs} from "@/assets/utils";

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
  components: {BasicTable, BasicButton, Card, ExportSingle},
  subscribeTable: ["user"],
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
          selectableRows: true,
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
      return this.$store.getters["table/user/getAll"].map(u => {
        let uNew = {...u};
        uNew.lastLoginAt = u.lastLoginAt ? (new Date(u.lastLoginAt)).toLocaleDateString() : "-";
        return uNew;
      });
    },
    stats() {
      return this.selectedUsers.reduce((acc, user) => acc.concat(this.$store.getters["admin/getStatsByUser"](user.id)), []).filter(s => s !== null);
    }
  },
  watch: {
    selectedUsers: {
      handler(newUsers) {
        newUsers.forEach(user => {
          if (this.$store.getters["admin/getStatsByUser"](user.id) == null) {
            this.$socket.emit("statsGetByUser", {userId: user.id})
          }
        });
      },
      deep: true,
    },
  },
  methods: {
    async downloadBehaviourData(file_type = "csv") {
      new Promise((resolve) => {
        this.$socket.emit("statsGet", {}, (response) => {
          resolve(response);
        });
      }).then(response => {
        if (response.success) {
          const filename = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '_behaviour_data';
          downloadObjectsAs(response.data, filename, file_type);
        } else {
          this.eventBus.emit('toast', {
            title: "Export Failed",
            message: "Export failed.",
            variant: "danger"
          });
        }
      });
    },
  }
}
</script>

<style scoped>
</style>