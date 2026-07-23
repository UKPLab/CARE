<template>
  <Card :title="$t('users.title')">
    <template #headerElements>
      <div class="btn-group gap-2">
        <BasicButton
            class="btn btn-sm btn-secondary"
            :title="$t('users.stats.exportCsv')"
            icon="cloud-arrow-down"
            @click="downloadBehaviourData('csv')"
        />
        <BasicButton
            class="btn btn-sm btn-secondary"
            :title="$t('users.stats.exportJson')"
            icon="cloud-arrow-down"
            @click="downloadBehaviourData('json')"
        />
      </div>
    </template>
    <template #body>
      <BasicTable
          ref="user_table"
          v-model="selectedUsers"
          :columns="userTableColumns"
          :data="users"
          :options="user_table.options"
          :max-table-height="'25vh'"
      />
    </template>
  </Card>
  <hr>
  <Card
      :title="$t('users.stats.userStatsTitle', selectedUsers ? selectedUsers.length : 0, { count: selectedUsers ? selectedUsers.length : 0 })">
    <template #body>
      <BasicTable
          ref="stats_table"
          :columns="statsTableColumns"
          :data="stats"
          :options="stats_table.options"
          :max-table-height="'25vh'"
      />
    </template>
  </Card>
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import Card from "@/basic/dashboard/card/Card.vue";
import {downloadObjectsAs, formatLocalizedDate} from "@/assets/utils";

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
  components: {BasicTable, BasicButton, Card},
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
      },
      selectedUsers: []
    }
  },
  computed: {
    userTableColumns() {
      return [
        {name: this.$t('users.stats.columns.user'), key: "userName", sortable: true},
        {name: this.$t('users.stats.columns.id'), key: "id", sortable: true},
        {name: this.$t('users.stats.columns.lastLogin'), key: "lastLoginAt", sortable: true},
      ];
    },
    statsTableColumns() {
      return [
        {name: this.$t('users.stats.columns.time'), key: "timestamp", sortable: true},
        {name: this.$t('users.stats.columns.user'), key: "userId", sortable: true},
        {name: this.$t('users.stats.columns.action'), key: "action", sortable: true},
        {name: this.$t('users.stats.columns.data'), key: "data", sortable: true},
      ];
    },
    users() {
      return this.$store.getters["table/user/getAll"].map(u => {
        let uNew = {...u};
        uNew.lastLoginAt = u.lastLoginAt ? formatLocalizedDate(u.lastLoginAt) : "-";
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
            title: this.$t('users.stats.toasts.exportFailedTitle'),
            message: this.$t('users.stats.toasts.exportFailedMessage'),
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