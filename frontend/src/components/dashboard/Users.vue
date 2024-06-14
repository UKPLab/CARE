<template>
  <Card title="Users">
    <template #headerElements></template>
    <template #body>
      <BasicTable :columns="columns" :data="users" :options="options" />
    </template>
  </Card>

</template>

<script>
import BasicTable from "@/basic/table/Table.vue";
import Card from "@/basic/Card.vue";

/**
 * Display user list by users' role
 *
 * @author: Linyin Huang
 */
export default {
  name: "Users",
  components: { BasicTable, Card },
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
        { name: "First Name", key: "firstName", sortable: false },
        { name: "Last Name", key: "lastName", sortable: false },
        { name: "User", key: "userName", sortable: true },
        { name: "Email", key: "email", sortable: true },
        { name: "Accept Terms", key: "acceptTerms", sortable: true },
        { name: "Accept Status", key: "acceptStats", sortable: true },
        { name: "Last Login", key: "lastLoginAt", sortable: true },
        { name: "Deleted", key: "deleted", sortable: true },
        { name: "Created At", key: "createdAt", sortable: false },
        { name: "Updated At", key: "updatedAt", sortable: false },
        { name: "Deleted At", key: "deletedAt", sortable: false },
      ],
      role: "all"
    }
  },
  computed: {
    users() {
      return this.$store.getters["admin/getUsersByRole"].map(user => {
        let newUser = { ...user };
        newUser.lastLoginAt = user.lastLoginAt ? (new Date(user.lastLoginAt)).toLocaleDateString() : "-";
        newUser.createdAt = user.createdAt ? (new Date(user.createdAt)).toLocaleDateString() : "-";
        newUser.updatedAt = user.updatedAt ? (new Date(user.updatedAt)).toLocaleDateString() : "-";
        newUser.deletedAt = user.deletedAt ? (new Date(user.deletedAt)).toLocaleDateString() : "-";
        return newUser;
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
  }
}
</script>

<style scoped></style>