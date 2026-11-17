<template>
  <router-link class="card home-tile" to="/dashboard/submissions">
    <span>{{ $t('sidebar.nav.submissions') }}</span>
    <b>{{ submissions.assignmentsTotal }}</b>
    <HomeActivityGraph :series="activity" />
  </router-link>
</template>

<script>
import HomeActivityGraph from "./HomeActivityGraph.vue";

/**
 * Home submissions count. The server only computes it for viewers who see
 * the tile (homeSummaryGet, right frontend.dashboard.submissions.view).
 */
export default {
  name: "HomeSubmissionsTile",
  components: { HomeActivityGraph },
  props: {
    /** Listed assignments (isListedAssignment rule): `{ assignmentsTotal, createdDates, submittedDates }`. */
    submissions: { type: Object, required: true },
  },
  computed: {
    activity() {
      return [
        {
          key: "created",
          label: this.$t("dashboard.home.activitySubmissions"),
          dates: this.submissions.createdDates,
        },
        {
          // Uploads to the listed assignments: the user's own, and for an
          // assignment owner the ones handed in by others.
          key: "submitted",
          label: this.$t("dashboard.home.activitySubmitted"),
          dates: this.submissions.submittedDates,
        },
      ];
    },
  },
};
</script>
