<template>
  <div class="row g-3 mb-3">
    <div class="col-sm-6 col-xl-3 home-tile-wrap">
      <router-link class="card home-tile" to="/dashboard/documents">
        <span>{{ $t('sidebar.nav.documents') }}</span>
        <b>{{ documents.total }}</b>
        <span>{{ $t('dashboard.home.addedThisWeek', { count: documentsAddedThisWeek }) }}</span>
        <HomeActivityGraph :series="documentActivity" />
      </router-link>
    </div>
    <div class="col-sm-6 col-xl-3 home-tile-wrap">
      <router-link class="card home-tile" to="/dashboard/my_sessions">
        <span>{{ $t('sidebar.nav.my_sessions') }}</span>
        <b>{{ sessions.openTotal }}</b>
        <span>{{ oldestSessionLabel }}</span>
        <HomeActivityGraph :series="sessionActivity" />
      </router-link>
    </div>
    <div v-if="canSeeStudies" class="col-sm-6 col-xl-3 home-tile-wrap">
      <router-link class="card home-tile" to="/dashboard/studies">
        <span>{{ $t('dashboard.home.openStudies') }}</span>
        <b>{{ studies.openTotal }}</b>
        <span>{{ $t('dashboard.home.closingSoon', { count: studies.closingSoon }) }}</span>
        <HomeActivityGraph :series="studyActivity" />
      </router-link>
    </div>
    <div v-if="canSeeSubmissions" class="col-sm-6 col-xl-3 home-tile-wrap">
      <HomeSubmissionsTile :submissions="submissions" />
    </div>
  </div>
</template>

<script>
import HomeSubmissionsTile from "./HomeSubmissionsTile.vue";
import HomeActivityGraph from "./HomeActivityGraph.vue";
import { getTimeDiffString } from "@/assets/utils";
import { DAY_MS } from "@/components/dashboard/study/studyCardHelpers.js";

/**
 * The four count tiles at the top of Home. Counts and activity dates come
 * from the server (homeSummaryGet), see Home.vue.
 */
export default {
  name: "HomeCountTiles",
  components: { HomeSubmissionsTile, HomeActivityGraph },
  props: {
    /** Viewer's own listed documents: `{ total, createdDates }`. */
    documents: { type: Object, required: true },
    /** Viewer's sessions: `{ openTotal, oldestOpenAt, startedDates, finishedDates }`. */
    sessions: { type: Object, required: true },
    /** Studies of the current project: `{ openTotal, closingSoon, createdDates, closedDates }`. */
    studies: { type: Object, required: true },
    /** Submissions tile: `{ assignmentsTotal, createdDates, submittedDates }`. */
    submissions: { type: Object, required: true },
    /** The viewer may open the studies dashboard. */
    canSeeStudies: { type: Boolean, required: true },
    /** The viewer may open the submissions dashboard. */
    canSeeSubmissions: { type: Boolean, required: true },
    /** Home's per-minute clock, so the "this week" count and labels stay current. */
    now: { type: Number, required: true },
  },
  computed: {
    documentsAddedThisWeek() {
      const weekAgo = this.now - 7 * DAY_MS;
      return this.documents.createdDates.filter((time) => time >= weekAgo).length;
    },
    oldestSessionLabel() {
      if (this.sessions.openTotal === 0) {
        return this.$t("dashboard.home.noOpenSessions");
      }
      const when = getTimeDiffString(this.now, new Date(this.sessions.oldestOpenAt));
      return this.$t("dashboard.home.oldestStarted", { when });
    },
    // Activity graphs (HomeActivityGraph): one date per event, counted
    // per week. The first series is the filled line, the second the
    // violet "closed" line.
    documentActivity() {
      return [{
        key: "added",
        label: this.$t("dashboard.home.activityDocuments"),
        dates: this.documents.createdDates,
      }];
    },
    sessionActivity() {
      // All of the user's sessions, not only the open ones counted on the tile.
      return [
        {
          key: "started",
          label: this.$t("dashboard.home.activitySessions"),
          dates: this.sessions.startedDates,
        },
        {
          key: "finished",
          label: this.$t("dashboard.home.activitySessionsFinished"),
          dates: this.sessions.finishedDates,
        },
      ];
    },
    studyActivity() {
      return [
        {
          key: "created",
          label: this.$t("dashboard.home.activityStudies"),
          dates: this.studies.createdDates,
        },
        {
          key: "closed",
          label: this.$t("dashboard.home.activityStudiesClosed"),
          // Closed by hand, or ended by its deadline (studyState).
          dates: this.studies.closedDates,
        },
      ];
    },
  },
};
</script>
