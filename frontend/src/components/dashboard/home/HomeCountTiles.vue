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
  },
  computed: {
    documentsAddedThisWeek() {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return this.documents.filter((doc) => new Date(doc.createdAt).getTime() >= weekAgo).length;
    },
    oldestSessionLabel() {
      if (this.openSessions.length === 0) {
        return this.$t("dashboard.home.noOpenSessions");
      }
      const oldest = [...this.openSessions].sort(
        (a, b) => new Date(a.start || a.createdAt || 0) - new Date(b.start || b.createdAt || 0)
      )[0];
      const when = getTimeDiffString(Date.now(), new Date(oldest.start || oldest.createdAt));
      return this.$t("dashboard.home.oldestStarted", { when });
    },
    studiesClosingSoon() {
      const now = Date.now();
      const limit = now + 7 * 24 * 60 * 60 * 1000;
      return this.openStudies.filter((study) => {
        if (!study.end) return false;
        const end = new Date(study.end).getTime();
        return !Number.isNaN(end) && end >= now && end <= limit;
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
      const now = Date.now();
      return [
        {
          key: "created",
          label: this.$t("dashboard.home.activityStudies"),
          dates: this.projectStudies.map((study) => study.createdAt),
        },
        {
          key: "closed",
          label: this.$t("dashboard.home.activityStudiesClosed"),
          // Closed by hand, or ended by its deadline. Same rule as
          // openStudies: a multipleSubmit study stays open after its end.
          dates: this.projectStudies.map((study) => {
            if (study.closed) return study.closed;
            if (!study.end || study.multipleSubmit) return null;
            const end = new Date(study.end).getTime();
            return end <= now ? study.end : null;
          }),
        },
      ];
    },
  },
};
</script>
