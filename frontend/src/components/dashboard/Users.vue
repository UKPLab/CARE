<template>
  <Card :title="$t('users.title')">
    <template #headerElements>
      <div class="d-flex flex-wrap gap-2">
        <BasicButton
            class="btn btn-secondary btn-sm"
            :title="$t('users.downloadUsers')"
            :text="$t('users.downloadUsers')"
            icon="download"
            @click="downloadUsers"
        />
        <BasicButton
            class="btn btn-secondary btn-sm"
            :title="$t('users.assignRoles')"
            :text="$t('users.assignRoles')"
            icon="person-bounding-box"
            @click="$refs.assignRolesModal.open()"
        />
        <BasicButton
            class="btn btn-secondary btn-sm"
            :title="$t('users.uploadPassword')"
            :text="$t('users.uploadPassword')"
            icon="key"
            @click="$refs.uploadModal.open()"
        />
        <BasicButton
            class="btn btn-secondary btn-sm"
            :title="$t('users.importCsv')"
            :text="$t('users.importCsv')"
            icon="filetype-csv"
            @click="$refs.importModal.open('csv')"
        />
        <BasicButton
            class="btn btn-secondary btn-sm"
            :title="$t('users.importViaMoodle')"
            :text="$t('users.importViaMoodle')"
            icon="box-arrow-in-down"
            @click="$refs.importModal.open('moodle')"
        />
        <BasicButton
            class="btn btn-primary btn-sm"
            :title="$t('users.addUser')"
            :text="$t('users.addUser')"
            icon="person-plus"
            @click="$refs.userAddModal.open()"
        />
      </div>
    </template>
    <template #body>
      <BasicTable
          :columns="columns"
          :data="users"
          :options="options"
          :buttons="buttons"
          :max-table-height="'65vh'"
          @action="chooseAction"
      />
    </template>
  </Card>
  <DetailsModal
      ref="detailsModal"
      @update-user="fetchUsers"
  />
  <RightsModal ref="rightsModal" />
  <AssignRolesModal
    ref="assignRolesModal"
    @update-user="fetchUsers"
  />
  <PasswordModal ref="passwordModal" />
  <ImportModal
      ref="importModal"
      @update-user="fetchUsers"
  />
  <UploadModal ref="uploadModal"/>
  <UserAddModal
      ref="userAddModal"
      @update-user="fetchUsers"
  />
  <ConfirmModal ref="confirmModal"/>
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import Card from "@/basic/dashboard/card/Card.vue";
import BasicButton from "@/basic/Button.vue";
import DetailsModal from "./users/DetailsModal.vue";
import RightsModal from "./users/RightsModal.vue";
import AssignRolesModal from "./users/AssignRolesModal.vue";
import ImportModal from "./users/ImportModal.vue";
import UploadModal from "./users/UploadModal.vue";
import UserAddModal from "./users/UserCreateModal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import PasswordModal from "@/basic/modal/PasswordModal.vue";
import {downloadObjectsAs, formatLocalizedDate, resolveApiMessage} from "@/assets/utils";

/**
 * Display user list by users' role
 *
 * @author: Linyin Huang
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
    AssignRolesModal,
    BasicButton,
    ImportModal,
    UploadModal,
    UserAddModal,
    ConfirmModal,
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
      // Possible values for role here are all the roles in the DB.
      role: "all",
    };
  },
  computed: {
    columns() {
      return [
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
    users() {
      return this.$store.getters["admin/getUsersByRole"].map((user) => {
        return this.formatUserData(user);
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
          title: this.$t('users.editUser'),
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
          title: this.$t('users.viewRights'),
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
          title: this.$t('users.resetPassword'),
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
          title: this.$t('users.deleteUser'),
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
  mounted() {
    this.fetchUsers();
  },
  methods: {
    fetchUsers() {
      this.$socket.emit("userGetByRole", {role: this.role}, (response) => {
        if (!response.success) {
          this.eventBus.emit("toast", {
            title: this.$t('errors.users.errorFetchingUsers'),
            // Use resolveApiMessage to handle both new (key/params) and legacy (message) error formats
            message: resolveApiMessage(response),
            variant: "danger",
          });
        }
      });
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
        case "deleteUser":
          this.deleteUser(data.params);
          break;
      }
    },
    openUserDetailsModal(user) {
      this.$refs.detailsModal.open(user.id);
    },
    openViewRightsModal(user) {
      this.$refs.rightsModal.open(user.id);
    },
    openResetPasswordModal(user) {
      this.$refs.passwordModal.open(user.id);
    },
    deleteUser(user) {
      this.$refs.confirmModal.open(this.$t('users.messages.deleteTitle'), this.$t('users.messages.deleteConfirm'), null, (val) => {
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
                  this.fetchUsers();
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
    downloadUsers() {
      const filename = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '_users';
      downloadObjectsAs(this.usersExport, filename, "csv");
    },
  },
};
</script>

<style scoped></style>
