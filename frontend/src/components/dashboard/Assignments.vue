<template>
  <AdminAssignmentsView v-if="isAdmin || hasAdminViewRight" />
  <UserAssignmentsView v-else />
</template>

<script>
import AdminAssignmentsView from "@/components/dashboard/assignments/AdminAssignmentsView.vue";
import UserAssignmentsView from "@/components/dashboard/assignments/UserAssignmentsView.vue";

export default {
  name: "DashboardAssignments",
  components: {
    AdminAssignmentsView,
    UserAssignmentsView,
  },
  computed: {
    isAdmin() {
      return this.$store.getters["auth/isAdmin"];
    },
    hasAdminViewRight(){
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.assignments.admin.view")
    }
  },
};
</script>
