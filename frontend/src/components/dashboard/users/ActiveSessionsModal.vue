<template>
  <BasicModal
      ref="modal"
      name="ActiveSessionsModal"
      size="lg"
  >
    <template #title>
      Active Sessions
    </template>

    <template #body>
     <div v-if="filteredUserName" class="mb-2">
        <small class="text-muted">
          Filtered user:
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
         {{ stats.activeUsers }} active user(s)
     </small>
      <BasicButton
          class="btn btn-secondary"
          title="Close"
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

      sessionColumns: [
        {name: "Socket ID",    key: "socketId"},
        {name: "User ID",      key: "userId",      sortable: true},
        {name: "Username",     key: "userName",    sortable: true},
        {name: "Connected At", key: "connectedAt", sortable: true},
        {name: "Browser",      key: "browser"},
      ],

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
