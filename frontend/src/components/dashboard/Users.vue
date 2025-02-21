<template>
  <Card title="Users">
    <template #headerElements>
      <BasicButton
        class="btn btn-secondary btn-sm me-1"
        title="Download Users"
        icon="download"
        @click="downloadUsers"
      />
      <BasicButton
        class="btn btn-secondary btn-sm me-1"
        title="Upload Password"
        @click="$refs.uploadModal.open()"
      />
      <BasicButton
        class="btn btn-secondary btn-sm me-1"
        title="Import via CSV"
        @click="$refs.importModal.open('csv')"
      />
      <BasicButton
        class="btn btn-secondary btn-sm me-1"
        title="Import via Moodle"
        @click="$refs.importModal.open('moodle')"
      />
      <BasicButton
        class="btn btn-primary btn-sm"
        title="Add User"
        @click="$refs.userAddModal.open()"
      />
    </template>
    <template #body>
      <BasicTable
        :columns="columns"
        :data="users"
        :options="options"
        :buttons="buttons"
        @action="chooseAction"
      />
    </template>
  </Card>
  <DetailsModal
    ref="detailsModal"
    @update-user="fetchUsers"
  />
  <RightsModal ref="rightsModal"/>
  <PasswordModal ref="passwordModal"/>
  <ImportModal
    ref="importModal"
    @update-user="fetchUsers"
  />
  <UploadModal ref="uploadModal"/>
  <UserAddModal
    ref="userAddModal"
    @update-user="fetchUsers"
  />
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import Card from "@/basic/Card.vue";
import BasicButton from "@/basic/Button.vue";
import DetailsModal from "./users/DetailsModal.vue";
import PasswordModal from "./users/PasswordModal.vue";
import RightsModal from "./users/RightsModal.vue";
import ImportModal from "./users/ImportModal.vue";
import UploadModal from "./users/UploadModal.vue";
import UserAddModal from "./users/UserCreateModal.vue";
import {downloadObjectsAs} from "@/assets/utils";

/**
 * Display user list by users' role
 *
 * @author: Linyin Huang
 */
export default {
  name: "DashboardUsers",
  components: {
    Card,
    BasicTable,
    DetailsModal,
    PasswordModal,
    RightsModal,
    BasicButton,
    ImportModal,
    UploadModal,
    UserAddModal,
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
        sort: {
          column: "id",
          order: "ASC",
        }
      },
      columns: [
        {name: "ID", key: "id", sortable: true},
        {name: "First Name", key: "firstName"},
        {name: "Last Name", key: "lastName"},
        {name: "User", key: "userName"},
        {name: "Email", key: "email"},
        {name: "Accept Terms", key: "acceptTerms", sortable: true},
        {name: "Accept Stats", key: "acceptStats", sortable: true},
        {name: "Last Login", key: "lastLoginAt", sortable: true},
      ],
      // Possible values for role here are all the roles in the DB.
      role: "all",
    };
  },
  computed: {
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
          icon: "person-lock",
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
      this.$socket.emit("userGetByRole", this.role);
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
          this.openEditReviewsModal(data.params)
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
    downloadUsers() {
      const filename = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '_users';
      downloadObjectsAs(this.usersExport, filename, "csv");
    },
  },
};
</script>

<style scoped></style>
