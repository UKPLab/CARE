<template>
  <BasicModal
      ref="modal"
      name="ActiveSessionsModal"
      size="lg"
  >
    <template #title>
      {{ $t('users.activeSessions.title') }}
    </template>

    <template #body>
     <div v-if="filteredUserName" class="mb-2">
        <small class="text-muted">
          {{ $t('users.activeSessions.filteredUser') }}
          <span class="fw-semibold text-body">{{ filteredUserName }}</span>
        </small>
      </div>
      <BasicTable
          :columns="sessionColumns"
          :data="formattedSessions"
          :options="tableOptions"
      />
    </template>

    <template #footer>
     <small v-if="!filteredUserName" class="text-muted me-auto">
         {{ $t('users.activeSessions.activeUsers', { count: stats.activeUsers }) }}
     </small>
      <BasicButton
          class="btn btn-secondary"
          :title="$t('common.close')"
          @click="$refs.modal.close()"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";

/**
 * Live modal displaying real-time active user sessions for admins.
 * Opens unfiltered (from the widget badge) or filtered to a single user (from a table row).
 *
 * @author Dennis Zyska, Mohammed Rawhani
 */
export default {
  name: "ActiveSessionsModal",
  components: {BasicModal, BasicTable, BasicButton},

  props: {
    stats: {
      type: Object,
      required: true,
    },
  },

  data() {
    return {
      filterUserId: null,
      tableOptions: {
        striped:    true,
        hover:      true,
        small:      true,
        pagination: 10,
        search:     true,
      },
    };
  },

  computed: {
    sessionColumns() {
      return [
        { name: this.$t('users.activeSessions.socketId'), key: "socketId" },
        { name: this.$t('users.activeSessions.userId'), key: "userId", sortable: true },
        { name: this.$t('common.userName'), key: "userName", sortable: true },
        { name: this.$t('users.activeSessions.connectedAt'), key: "connectedAt", sortable: true },
        { name: this.$t('users.activeSessions.browser'), key: "browser" },
      ];
    },
    formattedSessions() {
      const source = this.filterUserId
        ? this.stats.sessions.filter(s => s.userId === this.filterUserId)
        : this.stats.sessions;

      return source.map(session => ({
        ...session,
        userId: String(session.userId),
        connectedAt: session.connectedAt
          ? new Date(session.connectedAt).toLocaleString()
          : "-",
      }));
    },

    filteredUserName() {
      if (!this.filterUserId) return null;
      const session = this.stats.sessions.find(s => s.userId === this.filterUserId);
      return session?.userName ?? null;
    },
  },

  methods: {
    open(userId = null) {
      this.filterUserId = userId;
      this.$refs.modal.open();
    },

    close() {
      this.$refs.modal.close();
    },
  },
};
</script>

<style scoped>
</style>
