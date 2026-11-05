<template>
  <router-link class="card home-tile" to="/dashboard/submissions">
    <span>{{ $t('sidebar.nav.submissions') }}</span>
    <b>{{ assignments.length }}</b>
    <HomeActivityGraph :series="activity" />
  </router-link>
</template>

<script>
import HomeActivityGraph from "@/components/dashboard/HomeActivityGraph.vue";
import { isListedAssignment } from "@/assets/utils";

/**
 * Home submissions count. Mounted only while the user can see the tile
 * so assignment and submission rows are not subscribed for everyone on Home.
 */
export default {
  name: "HomeSubmissionsTile",
  components: { HomeActivityGraph },
  subscribeTable: ["assignment", "submission"],
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
      const assignmentIds = new Set(this.assignments.map((assignment) => assignment.id));
      const submissions = this.$store.getters["table/submission/getFiltered"](
        (submission) => assignmentIds.has(submission.assignmentId) && !submission.deleted
      ) || [];
      return [
        {
          key: "created",
          label: this.$t("dashboard.home.activitySubmissions"),
          dates: this.assignments.map((assignment) => assignment.createdAt),
        },
        {
          // Uploads to the listed assignments: the user's own, and for an
          // assignment owner the ones handed in by others.
          key: "submitted",
          label: this.$t("dashboard.home.activitySubmitted"),
          dates: submissions.map((submission) => submission.createdAt),
        },
      ];
    },
  },
};
</script>
