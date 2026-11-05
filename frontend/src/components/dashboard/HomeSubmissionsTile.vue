<template>
  <router-link class="card home-tile" to="/dashboard/submissions">
    <span>{{ $t('sidebar.nav.submissions') }}</span>
    <b>{{ assignments.length }}</b>
    <HomeActivityGraph
      :dates="activity"
      :description="$t('dashboard.home.activitySubmissions')"
    />
  </router-link>
</template>

<script>
import HomeActivityGraph from "@/components/dashboard/HomeActivityGraph.vue";
import { isListedAssignment } from "@/assets/utils";

/**
 * Home submissions count. Mounted only while the user can see the tile
 * so assignment rows are not subscribed for everyone on Home.
 */
export default {
  name: "HomeSubmissionsTile",
  components: { HomeActivityGraph },
  subscribeTable: ["assignment"],
  computed: {
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    assignments() {
      return this.$store.getters["table/assignment/getFiltered"](
        (assignment) => isListedAssignment(assignment, this.userId)
      );
    },
    activity() {
      return this.assignments.map((assignment) => assignment.createdAt);
    },
  },
};
</script>
