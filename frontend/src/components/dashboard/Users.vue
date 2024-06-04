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
        { name: "User", key: "userName", sortable: true },
        { name: "ID", key: "id", sortable: true },
        // TODO: There is no sysrole value associated with a user, replace this value
        { name: "Role", key: "sysrole", sortable: true },
        { name: "Last Login", key: "lastLoginAt", sortable: true },
      ],
      role: "student"
    }
  },
  computed: {
    users() {
      return this.$store.getters["admin/getUsersByRole"].map(user => {
        let newUsers = { ...user };
        newUsers.lastLoginAt = user.lastLoginAt ? (new Date(user.lastLoginAt)).toLocaleDateString() : "-";
        return newUsers;
      });
    },
  },
  mounted() {
    this.loadUsers();
  },
  methods: {
    loadUsers() {
      this.$socket.emit("requestUsersByRole", this.role);
    },
  }
}
</script>

<style scoped></style>