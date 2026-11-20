<template>
  <div>
  <DashboardListPage
      :title="$t('users.title')"
      :columns="columns"
      :data="users"
      :buttons="buttons"
      :table-options="options"
      @action="chooseAction"
  >
    <template #headerActions>
      <UsersToolbar
          @live-sessions="openSessionDetailsModal()"
          @rights-management="openRightsManagementModal"
          @role-management="$refs.roleManagementModal.open()"
          @upload-passwords="openUploadModal"
          @import="openImportModal"
          @add-user="openUserAddModal"
      />
    </template>
  </DashboardListPage>
  <DetailsModal
      v-if="modals.details"
      ref="detailsModal"
      @hide="modals.details = false"
  />
  <RightsModal v-if="modals.rights" ref="rightsModal" @hide="modals.rights = false"/>
  <RightsManagementModal
    v-if="modals.rightsManagement"
    ref="rightsManagementModal"
    @hide="modals.rightsManagement = false"
  />
  <RoleManagementModal
    ref="roleManagementModal"
  />
  <PasswordModal ref="passwordModal" />
  <ImportModal
      v-if="modals.import"
      ref="importModal"
      @hide="modals.import = false"
  />
  <UploadModal v-if="modals.upload" ref="uploadModal" @hide="modals.upload = false"/>
  <UserAddModal
      v-if="modals.userAdd"
      ref="userAddModal"
      @hide="modals.userAdd = false"
  />
  <ConfirmModal v-if="modals.confirm" ref="confirmModal" @hide="modals.confirm = false"/>

  <ActiveSessionsModal
    v-if="modals.activeSessions"
    ref="activeSessionsModal"
    :stats="monitorStats"
    @hide="modals.activeSessions = false"
  />
  </div>
</template>

<script>
import UsersToolbar from "./users/UsersToolbar.vue";
import DetailsModal from "./users/DetailsModal.vue";
import RightsModal from "./users/RightsModal.vue";
import RightsManagementModal from "./users/RightsManagementModal.vue";
import RoleManagementModal from "./users/RoleManagementModal.vue";
import ImportModal from "./users/ImportModal.vue";
import UploadModal from "./users/UploadModal.vue";
import UserAddModal from "./users/UserCreateModal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import PasswordModal from "@/basic/modal/PasswordModal.vue";
import {formatLocalizedDate, resolveApiMessage} from "@/assets/utils";
import ActiveSessionsModal from "./users/ActiveSessionsModal.vue";
import DashboardListPage from "@/basic/dashboard/ListPage.vue";
import { withSearch } from "@/basic/dashboard/constants.js";
import { dashboardRowAction, dashboardRowButton } from "@/basic/dashboard/actions.js";

/**
 * Display user list by users' role
 *
 * @author: Linyin Huang, Karim Ouf, Dennis Zyska
 */
export default {
  name: "DashboardUsers",
  subscribeTable: ["user"],
  components: {
    DashboardListPage,
    DetailsModal,
    PasswordModal,
    RightsModal,
    RightsManagementModal,
    UsersToolbar,
    ImportModal,
    UploadModal,
    UserAddModal,
    ConfirmModal,
    RoleManagementModal,
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
      options: withSearch({
        sort: {
          column: "id",
          order: "ASC",
        },
      }),
    };
  },
  computed: {
    columns() {
      return [
        {
          name: '',
          key: 'activeIndicator',
          filterKey: 'isActive',
          type: 'icon',
          sortable: true,
          sortKey: 'isActive',
          width: 1,
          fixed: 'left',
          style: { width: '1px', whiteSpace: 'nowrap', textAlign: 'center' },
          typeOptions: { size: 6 },
          filter: [
            { key: 'true', name: this.$t('common.active') },
            { key: 'false', name: this.$t('common.inactive') },
          ],
        },
        {name: this.$t('common.id'), key: "id", sortable: true, fixed: "left"},
        {name: this.$t('users.columns.firstName'), key: "firstName", fixed: "left"},
        {name: this.$t('users.columns.lastName'), key: "lastName"},
        {name: this.$t('users.columns.userName'), key: "userName"},
        {name: this.$t('users.columns.email'), key: "email"},
        {name: this.$t('users.columns.acceptTerms'), key: "acceptTerms", sortable: true},
        {name: this.$t('users.columns.acceptStats'), key: "acceptStats", sortable: true},
        {name: this.$t('users.columns.acceptDataSharing'), key: "acceptDataSharing", sortable: true},
        {name: this.$t('users.columns.verified'), key: "emailVerified"},
        {name: this.$t('users.columns.lastLogin'), key: "lastLoginAt", sortable: true},
      ];
    },
    monitorStats() {
      return this.$store.getters["admin/getMonitorStats"];
    },
    users() {
      const activeIds = new Set(this.monitorStats.connectedUsers.map(u => u.userId));
      return this.$store.getters["table/user/getAll"].map((user) => {
        const isActive = activeIds.has(user.id);
        return {
          ...this.formatUserData(user),
          isActive,
          activeIndicator: isActive
            ? { icon: 'circle-fill', color: '#198754', title: this.$t('common.online') }
            : { icon: 'circle', color: '#6c757d', title: this.$t('common.offline') },
        };
      });
    },
    buttons() {
      // Every user row button reports the user id in its stats.
      const userStats = { stats: { userId: "id" } };
      return [
        dashboardRowAction("edit", { ...userStats, title: this.$t('users.editUser'), action: "editUser" }),
        dashboardRowAction("rights", { ...userStats, title: this.$t('users.viewRights'), action: "viewRights" }),
        dashboardRowButton("person-lock", { ...userStats, title: this.$t('users.resetPassword'), action: "resetPassword" }),
        dashboardRowButton("display", {
          ...userStats,
          title: this.$t('users.viewSessions'),
          action: "viewSessions",
          filter: [{ key: "isActive", value: true }],
        }),
        dashboardRowAction("delete", { ...userStats, title: this.$t('users.deleteUser'), action: "deleteUser" }),
      ];
    },
  },

  mounted() {
    this.$socket.emit("userMonitorSubscribe", {}, (response) => {
        this.$store.commit("admin/SOCKET_monitorStatsUpdate", response);
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
    formatUserData(user) {
      const formatDate = (date) => (date ? formatLocalizedDate(date) : "-");

      return {
        ...user,
        lastLoginAt: formatDate(user.lastLoginAt),
      };
    },
    chooseAction(data) {
      switch (data.action) {
        case "editUser":
          this.openDetailsModal(data.params.id);
          break;
        case "viewRights":
          this.openRightsModal(data.params.id);
          break;
        case "resetPassword":
          this.openPasswordModal(data.params.id);
          break;
        case "viewSessions":
          this.openSessionDetailsModal(data.params);
          break;
        case "deleteUser":
          this.deleteUser(data.params);
          break;
      }
    },
    deleteUser(user) {
      this.openConfirmModal(this.$t('users.messages.deleteTitle'), this.$t('users.messages.deleteConfirm'), null, (val) => {
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
                    title: this.$t('users.messages.userDeleted'),
                    message: this.$t('users.messages.userDeletedMessage'),
                    variant: "success",
                  });
                } else {
                  this.eventBus.emit("toast", {
                    title: this.$t('errors.users.userNotDeleted'),
                    message: resolveApiMessage(result),
                    variant: "danger",
                  });
                }
              }
          );
        }
      });
    },
    openSessionDetailsModal(params = null) {
      const userId = params ? params.id : null;
      this.modals.activeSessions = true;
      this.$nextTick(() => this.$refs.activeSessionsModal?.open(userId));
    },
  },
};
</script>
