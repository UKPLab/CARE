<template>
  <Card title="Users">
    <template #headerElements>
      <BasicButton
        class="btn-secondary btn-sm me-1"
        title="Import via Moodle"
        @click="$refs.importModal.open('moodle')"
      />
      <BasicButton
        class="btn btn-primary btn-sm"
        title="Import via CSV"
        @click="$refs.importModal.open('csv')"
      />
    </template>
    <template #body>
      <BasicTable
        :columns="columns"
        :data="users"
        :options="options"
        @action="chooseAction"
      />
    </template>
  </Card>
  <DetailsModal
    ref="detailsModal"
    @update-user="fetchUsers"
  />
  <RightsModal ref="rightsModal" />
  <PasswordModal ref="passwordModal" />
  <ImportModal ref="importModal" />
</template>

<script>
import BasicTable from "@/basic/table/Table.vue";
import Card from "@/basic/Card.vue";
import BasicButton from "@/basic/Button.vue";
import DetailsModal from "./users/DetailsModal.vue";
import PasswordModal from "./users/PasswordModal.vue";
import RightsModal from "./users/RightsModal.vue";
import ImportModal from "./users/ImportModal.vue";

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
    ImportModal
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
      },
      columns: [
        { name: "ID", key: "id", sortable: true },
        { name: "First Name", key: "firstName" },
        { name: "Last Name", key: "lastName" },
        { name: "User", key: "userName" },
        { name: "Email", key: "email" },
        { name: "Accept Terms", key: "acceptTerms", sortable: true },
        { name: "Accept Stats", key: "acceptStats", sortable: true },
        { name: "Last Login", key: "lastLoginAt", sortable: true },
        { name: "Manage", key: "manage", type: "button-group" },
      ],
      // Possible values for role are "all", "student", "mentor", "teacher"
      role: "all",
    };
  },
  computed: {
    users() {
      return this.$store.getters["admin/getUsersByRole"].map((user) => {
        return this.formatUserData(user);
      });
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
      user.manage = [
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
  },
};
</script>

<style scoped></style>
