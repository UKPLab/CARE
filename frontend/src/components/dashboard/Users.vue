<template>
  <Card title="Users">
    <template #headerElements>
      <div class="d-flex align-items-center flex-wrap gap-2">
        <BasicButton
            class="btn btn-secondary btn-sm"
            title="Live Sessions"
            text="Live Sessions"
            icon="people-fill"
            @click="openSessionDetailsModal()"
        />
        <BasicButton
            class="btn btn-secondary btn-sm"
            title="Download Users"
            text="Download Users"
            icon="download"
            @click="downloadUsers"
        />
        <BasicButton
            class="btn btn-secondary btn-sm"
            title="Rights Management"
            text="Rights Management"
            icon="shield-lock"
            @click="openRightsManagementModal"
        />
        <BasicButton
            class="btn btn-secondary btn-sm"
            title="Upload Password"
            text="Upload Password"
            icon="key"
            @click="openUploadModal"
        />
        <BasicButton
            class="btn btn-secondary btn-sm"
            title="Import via CSV"
            text="Import CSV"
            icon="filetype-csv"
            @click="openImportModal('csv')"
        />
        <BasicButton
            class="btn btn-secondary btn-sm"
            title="Import via Moodle"
            text="Import via Moodle"
            icon="box-arrow-in-down"
            @click="openImportModal('moodle')"
        />
        <BasicButton
            class="btn btn-primary btn-sm"
            title="Add User"
            text="Add User"
            icon="person-plus"
            @click="openUserAddModal"
        />
      </div>
    </template>
    <template #body>
      <BasicTable
          :columns="columns"
          :data="users"
          :options="options"
          :buttons="buttons"
          @action="chooseAction"
          :max-table-height="'65vh'"
      />
    </template>
  </Card>
  <DetailsModal
      v-if="modals.details"
      ref="detailsModal"
      @update-user="fetchUsers"
      @hide="modals.details = false"
  />
  <RightsModal v-if="modals.rights" ref="rightsModal" @hide="modals.rights = false"/>
  <RightsManagementModal
    v-if="modals.rightsManagement"
    ref="rightsManagementModal"
    @update-user="fetchUsers"
    @hide="modals.rightsManagement = false"
  />
  <PasswordModal v-if="modals.password" ref="passwordModal" @hide="modals.password = false"/>
  <ImportModal
      v-if="modals.import"
      ref="importModal"
      @update-user="fetchUsers"
      @hide="modals.import = false"
  />
  <UploadModal v-if="modals.upload" ref="uploadModal" @hide="modals.upload = false"/>
  <UserAddModal
      v-if="modals.userAdd"
      ref="userAddModal"
      @update-user="fetchUsers"
      @hide="modals.userAdd = false"
  />
  <ConfirmModal v-if="modals.confirm" ref="confirmModal" @hide="modals.confirm = false"/>

  <ActiveSessionsModal
    v-if="modals.activeSessions"
    ref="activeSessionsModal"
    :stats="monitorStats"
    @hide="modals.activeSessions = false"
/>

</template>

<script>
import BasicTable from "@/basic/Table.vue";
import Card from "@/basic/dashboard/card/Card.vue";
import BasicButton from "@/basic/Button.vue";
import DetailsModal from "./users/DetailsModal.vue";
import RightsModal from "./users/RightsModal.vue";
import RightsManagementModal from "./users/RightsManagementModal.vue";
import ImportModal from "./users/ImportModal.vue";
import UploadModal from "./users/UploadModal.vue";
import UserAddModal from "./users/UserCreateModal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import PasswordModal from "@/basic/modal/PasswordModal.vue";
import {downloadObjectsAs} from "@/assets/utils";
import ActiveSessionsModal from "./users/ActiveSessionsModal.vue";

/**
 * Display user list by users' role
 *
 * @author: Linyin Huang, Karim Ouf, Dennis Zyska
 */
export default {
  name: "DashboardUsers",
  subscribeTable: ["user"],
  components: {
    Card,
    BasicTable,
    DetailsModal,
    PasswordModal,
    RightsModal,
    RightsManagementModal,
    BasicButton,
    ImportModal,
    UploadModal,
    UserAddModal,
    ConfirmModal,
    ActiveSessionsModal,
  },
  props: {
    admin: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    return {
      modals: {
        details: false,
        rights: false,
        rightsManagement: false,
        password: false,
        import: false,
        upload: false,
        userAdd: false,
        confirm: false,
        activeSessions: false,
      },
      monitorStats: {
        activeSessions: 0,
        activeUsers: 0,
        connectedUsers: [],
        sessions: [],
        loading: true,
        error: null,
      },
      options: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
        search: true,
        sort: {
          column: "id",
          order: "ASC",
        },
      },
      columns: [
        { name: '', key: 'activeIndicator', type: 'icon', sortable: true, sortKey: 'isActive', width: 1, fixed: "left",
          style: { width: '1px', whiteSpace: "nowrap", textAlign: "center" },
          typeOptions: { size: 6 } },
        {name: "ID", key: "id", sortable: true, fixed: "left"},
        {name: "First Name", key: "firstName", fixed: "left"},
        {name: "Last Name", key: "lastName"},
        {name: "User", key: "userName"},
        {name: "Email", key: "email"},
        {name: "Accept Terms", key: "acceptTerms", sortable: true},
        {name: "Accept Stats", key: "acceptStats", sortable: true},
        {name: "Accept Data Sharing", key: "acceptDataSharing", sortable: true},
        {name: "Verified", key: "emailVerified"},
        {name: "Last Login", key: "lastLoginAt", sortable: true},
      ],
      // Possible values for role here are all the roles in the DB.
      role: "all",
    };
  },
  computed: {
    users() {
      const activeIds = new Set(this.monitorStats.connectedUsers.map(u => u.userId));
      return this.$store.getters["admin/getUsersByRole"].map((user) => {
        const isActive = activeIds.has(user.id);
        return {
          ...this.formatUserData(user),
          isActive,
          activeIndicator: isActive
            ? { icon: 'circle-fill', color: '#198754', title: 'Online' }
            : { icon: 'circle', color: '#6c757d', title: 'Offline' },
        };
      });
    },
    usersExport() {
      return this.users.filter(user => !user.deleted).map((user) => {
        return {
          ID: user.id,
          "First Name": user.firstName,
          "Last Name": user.lastName,
          User: user.userName,
          Email: user.email,
          "Accept Terms": user.acceptTerms,
          "Accept Stats": user.acceptStats,
          "Accept Data Sharing": user.acceptDataSharing,
          "Accept Date": user.acceptedAt,
          "Last Login": user.lastLoginAt,
          "Created": user.createdAt,
          "External ID": user.extId,
          "Verified": user.emailVerified,
          "Roles": user.roles.map(role => this.systemRoles.find((r) => r.id === role)?.name).join(", "),
        };
      });
    },
    systemRoles() {
      return this.$store.getters["admin/getSystemRoles"];
    },
    buttons() {
      return [
        {
          title: "Edit User",
          action: "editUser",
          stats: {
            userId: "id",
          },
          icon: "pencil",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
        },
        {
          title: "View Rights",
          action: "viewRights",
          stats: {
            userId: "id",
          },
          icon: "card-list",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
        },
        {
          title: "Reset Password",
          action: "resetPassword",
          stats: {
            userId: "id",
          },
          icon: "person-lock",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
        },
        {
          title: "View Sessions",
          action: "viewSessions",
          stats: {
            userId: "id",
          },
          icon: "display",
          filter: [{ key: "isActive", value: true }],
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
        },
        {
          title: "Delete User",
          action: "deleteUser",
          stats: {
            userId: "id",
          },
          icon: "trash",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
        },
      ];
    },
  },
  sockets: {
    monitorStatsUpdate(data) {
      this.handleMonitorUpdate(data);
    },
  },
  mounted() {
    this.fetchUsers();
    this.$socket.emit("userMonitorSubscribe", {}, (response) => {
      if (response?.success) {
        this.monitorStats = { ...this.monitorStats, ...response.data, loading: false, error: null };
      } else {
        this.monitorStats.loading = false;
        this.monitorStats.error = response?.message ?? "Monitor unavailable";
      }
    });
  },
  beforeUnmount() {
    this.$socket.emit("userMonitorUnsubscribe", {});
  },
  methods: {
    openDetailsModal(userId) {
      this.modals.details = true;
      this.$nextTick(() => this.$refs.detailsModal?.open(userId));
    },
    openRightsModal(userId) {
      this.modals.rights = true;
      this.$nextTick(() => this.$refs.rightsModal?.open(userId));
    },
    openRightsManagementModal() {
      this.modals.rightsManagement = true;
      this.$nextTick(() => this.$refs.rightsManagementModal?.open());
    },
    openPasswordModal(userId) {
      this.modals.password = true;
      this.$nextTick(() => this.$refs.passwordModal?.open(userId));
    },
    openImportModal(type) {
      this.modals.import = true;
      this.$nextTick(() => this.$refs.importModal?.open(type));
    },
    openUploadModal() {
      this.modals.upload = true;
      this.$nextTick(() => this.$refs.uploadModal?.open());
    },
    openUserAddModal() {
      this.modals.userAdd = true;
      this.$nextTick(() => this.$refs.userAddModal?.open());
    },
    openConfirmModal(name, message, warning, cb) {
      this.modals.confirm = true;
      this.$nextTick(() => this.$refs.confirmModal?.open(name, message, warning, cb));
    },
    fetchUsers() {
      this.$socket.emit("userGetByRole", {role: this.role}, (response) => {
        if (!response.success) {
          this.eventBus.emit("toast", {
            title: "Error fetching users",
            message: response.message,
            variant: "danger",
          });
        }
      });
    },
    formatUserData(user) {
      const formatDate = (date) => (date ? new Date(date).toLocaleDateString() : "-");

      return {
        ...user,
        lastLoginAt: formatDate(user.lastLoginAt),
      };
    },
    chooseAction(data) {
      switch (data.action) {
        case "editUser":
          this.openUserDetailsModal(data.params);
          break;
        case "viewRights":
          this.openViewRightsModal(data.params);
          break;
        case "resetPassword":
          this.openResetPasswordModal(data.params);
          break;
        case "editReviews":
          this.openEditReviewsModal(data.params);
          break;
        case "viewSessions":
          this.openSessionDetailsModal(data.params);
          break;
        case "deleteUser":
          this.deleteUser(data.params);
          break;
      }
    },
    openUserDetailsModal(user) {
      this.openDetailsModal(user.id);
    },
    openViewRightsModal(user) {
      this.openRightsModal(user.id);
    },
    openResetPasswordModal(user) {
      this.openPasswordModal(user.id);
    },
    deleteUser(user) {
      this.openConfirmModal("Delete User", "Are you sure you want to delete this user?", null, (val) => {
        if (val) {
          this.$socket.emit(
              "appDataUpdate",
              {
                table: "user",
                data: {
                  id: user.id,
                  deleted: true,
                },
              },
              (result) => {
                if (result.success) {
                  this.eventBus.emit("toast", {
                    title: "User deleted",
                    message: "User has been deleted",
                    variant: "success",
                  });
                  this.fetchUsers();
                } else {
                  this.eventBus.emit("toast", {
                    title: "User not deleted",
                    message: result.message,
                    variant: "danger",
                  });
                }
              }
          );
        }
      });
    },
    downloadUsers() {
      const filename = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '_users';
      downloadObjectsAs(this.usersExport, filename, "csv");
    },
    openSessionDetailsModal(params = null) {
      const userId = params ? params.id : null;
      this.modals.activeSessions = true;
      this.$nextTick(() => this.$refs.activeSessionsModal?.open(userId));
    },
    handleMonitorUpdate(data) {
      if (data) {
        this.monitorStats = { ...data, loading: false, error: null };
      }
    },
  },
};
</script>

<style scoped></style>
