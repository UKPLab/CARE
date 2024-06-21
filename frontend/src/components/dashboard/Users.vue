<template>
  <Card title="Users">
    <template #headerElements></template>
    <template #body>
      <BasicTable :columns="columns" :data="users" :options="options" @action="chooseAction" />
    </template>
  </Card>
  <DetailsModal ref="detailsModal" />
</template>

<script>
import BasicTable from "@/basic/table/Table.vue";
import Card from "@/basic/Card.vue";
import DetailsModal from "./users/DetailsModal.vue";

/**
 * Display user list by users' role
 *
 * @author: Linyin Huang
 */
export default {
  name: "Users",
  fetchData: ['user'],
  components: {
    Card,
    BasicTable,
    DetailsModal
  },
  props: {
    'admin': {
      type: Boolean,
      required: false,
      default: false
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
        { name: "Accept Status", key: "acceptStats", sortable: true },
        { name: "Last Login", key: "lastLoginAt", sortable: true },
        { name: "Deleted", key: "deleted" },
        { name: "Created At", key: "createdAt" },
        { name: "Updated At", key: "updatedAt" },
        { name: "Deleted At", key: "deletedAt" },
        { name: "Manage", key: "manage", type: "button-group" },
      ],
      // Possible values for role are "all", "student", "mentor", "teacher"
      role: "all"
    }
  },
  computed: {
    users() {
      return this.$store.getters["admin/getUsersByRole"].map(user => {
        return this.formatUserData(user);
      });
    },
  },
  mounted() {
    this.fetchUsers();
  },
  methods: {
    fetchUsers() {
      this.$socket.emit("requestUsersByRole", this.role);
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
            }
          },
        }
      ]

      const formatDate = date => (date ? new Date(date).toLocaleString() : "-");

      return {
        ...user,
        lastLoginAt: formatDate(user.lastLoginAt),
        createdAt: formatDate(user.createdAt),
        updatedAt: formatDate(user.updatedAt),
        deletedAt: formatDate(user.deletedAt),
      };
    },
    chooseAction(data) {
      switch (data.action) {
        case "editUser":
          this.openUserDetailsModal(data.params)
          break;
        default:
          break;
      }
    },
    openUserDetailsModal(user) {
      this.$refs.detailsModal.open(user.id)
    }
  }
}
</script>

<style scoped></style>