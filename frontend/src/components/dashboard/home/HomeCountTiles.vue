<template>
  <div class="row g-3 mb-3">
    <div class="col-sm-6 col-xl-3 home-tile-wrap">
      <router-link class="card home-tile" to="/dashboard/documents">
        <span>{{ $t('sidebar.nav.documents') }}</span>
        <b>{{ documents.length }}</b>
        <span>{{ $t('dashboard.home.addedThisWeek', { count: documentsAddedThisWeek }) }}</span>
        <HomeActivityGraph :series="documentActivity" />
      </router-link>
    </div>
    <div class="col-sm-6 col-xl-3 home-tile-wrap">
      <router-link class="card home-tile" to="/dashboard/my_sessions">
        <span>{{ $t('sidebar.nav.my_sessions') }}</span>
        <b>{{ openSessions.length }}</b>
        <span>{{ oldestSessionLabel }}</span>
        <HomeActivityGraph :series="sessionActivity" />
      </router-link>
    </div>
    <div v-if="canSeeStudies" class="col-sm-6 col-xl-3 home-tile-wrap">
      <router-link class="card home-tile" to="/dashboard/studies">
        <span>{{ $t('dashboard.home.openStudies') }}</span>
        <b>{{ openStudies.length }}</b>
        <span>{{ $t('dashboard.home.closingSoon', { count: studiesClosingSoon }) }}</span>
        <HomeActivityGraph :series="studyActivity" />
      </router-link>
    </div>
    <div v-if="canSeeSubmissions" class="col-sm-6 col-xl-3 home-tile-wrap">
      <HomeSubmissionsTile />
    </div>
  </div>
</template>

<script>
import HomeSubmissionsTile from "./HomeSubmissionsTile.vue";
import HomeActivityGraph from "./HomeActivityGraph.vue";
import { getTimeDiffString } from "@/assets/utils";
import { CLOSING_SOON_MS, DAY_MS, studyState } from "@/components/dashboard/study/studyCardHelpers.js";

/**
 * The four count tiles at the top of Home.
 */
export default {
  name: "HomeCountTiles",
  components: { HomeSubmissionsTile, HomeActivityGraph },
  props: {
    /** Viewer's own listed documents. */
    documents: { type: Array, required: true },
    /** Viewer's sessions that have not ended. */
    openSessions: { type: Array, required: true },
    /** Studies still open in the current project. */
    openStudies: { type: Array, required: true },
    /** Every non-template study in the current project. */
    projectStudies: { type: Array, required: true },
    /** The viewer may open the studies dashboard. */
    canSeeStudies: { type: Boolean, required: true },
    /** The viewer may open the submissions dashboard. */
    canSeeSubmissions: { type: Boolean, required: true },
    /** Signed-in user, used to read that user's sessions. */
    userId: { type: Number, required: true },
    /** Home's per-minute clock, so the counts follow passing deadlines. */
    now: { type: Number, required: true },
  },
  computed: {
    documentsAddedThisWeek() {
      const weekAgo = this.now - 7 * DAY_MS;
      return this.documents.filter((doc) => new Date(doc.createdAt).getTime() >= weekAgo).length;
    },
    oldestSessionLabel() {
      if (this.openSessions.length === 0) {
        return this.$t("dashboard.home.noOpenSessions");
      }
      const oldest = [...this.openSessions].sort(
        (a, b) => new Date(a.start || a.createdAt || 0) - new Date(b.start || b.createdAt || 0)
      )[0];
      const when = getTimeDiffString(this.now, new Date(oldest.start || oldest.createdAt));
      return this.$t("dashboard.home.oldestStarted", { when });
    },
    studiesClosingSoon() {
      const limit = this.now + CLOSING_SOON_MS;
      return this.openStudies.filter((study) => {
        if (!study.end) return false;
        const end = new Date(study.end).getTime();
        return !Number.isNaN(end) && end >= this.now && end <= limit;
      }).length;
    },
    // Activity graphs (HomeActivityGraph): one date per event, counted
    // per week. The first series is the filled line, the second the
    // violet "closed" line.
    documentActivity() {
      return [{
        key: "added",
        label: this.$t("dashboard.home.activityDocuments"),
        dates: this.documents.map((doc) => doc.createdAt),
      }];
    },
    sessionActivity() {
      // All of the user's sessions, not only the open ones counted on the tile.
      const sessions = this.$store.getters["table/study_session/getByUser"](this.userId);
      return [
        {
          key: "started",
          label: this.$t("dashboard.home.activitySessions"),
          dates: sessions.map((session) => session.start || session.createdAt),
        },
        {
          key: "finished",
          label: this.$t("dashboard.home.activitySessionsFinished"),
          dates: sessions.map((session) => session.end),
        },
      ];
    },
    studyActivity() {
      return [
        {
          key: "created",
          label: this.$t("dashboard.home.activityStudies"),
          dates: this.projectStudies.map((study) => study.createdAt),
        },
        {
          key: "closed",
          label: this.$t("dashboard.home.activityStudiesClosed"),
          // Closed by hand, or ended by its deadline (studyState).
          dates: this.projectStudies.map((study) => {
            const state = studyState(study, this.now);
            if (state === "closed") return study.closed;
            return state === "ended" ? study.end : null;
          }),
        },
      ];
    },
  },
};
</script>
