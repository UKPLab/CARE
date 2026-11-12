<template>
  <HomeGuest
    v-if="isGuestHome"
    :can-see-studies="canSeeStudies"
    :open-studies="openStudies"
    :now="now"
  />

  <div v-else class="home home--with-footer">
    <HomeCountTiles
      :documents="documents"
      :open-sessions="openSessions"
      :open-studies="openStudies"
      :project-studies="projectStudies"
      :can-see-studies="canSeeStudies"
      :can-see-submissions="canSeeSubmissions"
      :user-id="userId"
      :now="now"
    />

    <div class="row g-3">
      <div class="col-lg-6">
        <HomeContinue
          :documents="documents"
          :open-sessions="openSessions"
          :user-id="userId"
          :can-see-studies="canSeeStudies"
          :now="now"
        />
      </div>
      <div class="col-lg-6 d-flex flex-column gap-3 home-stack">
        <HomeDeadlines
          v-if="canSeeStudies"
          :open-studies="openStudies"
          :now="now"
        />
        <HomeSessions
          :open-sessions="openSessions"
          :now="now"
        />
      </div>
    </div>

    <AppFooter class="home-footer-slot" />
  </div>
</template>

<script>
import { isOwnListedDocument } from "@/assets/utils";
import { isStudyOpen } from "./study/studyCardHelpers.js";
import HomeGuest from "./home/HomeGuest.vue";
import HomeCountTiles from "./home/HomeCountTiles.vue";
import HomeContinue from "./home/HomeContinue.vue";
import HomeSessions from "./home/HomeSessions.vue";
import HomeDeadlines from "./home/HomeDeadlines.vue";
import AppFooter from "@/basic/navigation/AppFooter.vue";

/**
 * Dashboard home. Resume links come from the viewer's own documents
 * and sessions, plus the studies they can open.
 *
 * @author Mohammad Sherif
 */
export default {
  name: "DashboardHome",
  components: { HomeGuest, HomeCountTiles, HomeContinue, HomeSessions, HomeDeadlines, AppFooter },
  data() {
    return {
      // Ticks once a minute so countdowns and the open-studies list follow passing deadlines.
      now: Date.now(),
      nowTimer: null,
    };
  },
  created() {
    const userId = this.$store.getters["auth/getUserId"];
    // The guest showcase document is not owned by the guest account, so the
    // guest still needs every document the server will hand them.
    const documents = this.$store.getters["auth/isGuestHome"]
      ? "document"
      : { table: "document", filter: [{ key: "userId", value: userId }] };
    // Set before the subscribe mixin mounts, so it subscribes once and
    // drops the subscription when Home is left.
    this.$options.subscribeTable = [
      documents,
      "study",
      { table: "study_session", filter: [{ key: "userId", value: userId }] },
    ];
  },
  mounted() {
    this.nowTimer = setInterval(() => {
      this.now = Date.now();
    }, 60 * 1000);
  },
  beforeUnmount() {
    clearInterval(this.nowTimer);
  },
  computed: {
    isGuestHome() {
      return this.$store.getters["auth/isGuestHome"];
    },
    projectId() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    documents() {
      return this.$store.getters["table/document/getFiltered"](
        (doc) => isOwnListedDocument(doc, this.userId, this.projectId)
      );
    },
    projectStudies() {
      return this.$store.getters["table/study/getFiltered"](
        (study) => study.projectId === this.projectId && study.template !== true
      );
    },
    openStudies() {
      return this.projectStudies.filter((study) => isStudyOpen(study, this.now));
    },
    openSessions() {
      return this.$store.getters["table/study_session/getByUser"](this.userId)
        .filter((session) => session.end == null)
        .sort((a, b) => new Date(b.start || b.updatedAt || 0) - new Date(a.start || a.updatedAt || 0));
    },
    canSeeStudies() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.view");
    },
    canSeeSubmissions() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.submissions.view");
    },
  },
};
</script>

<style scoped>
.home .row > [class*="col"] {
  min-width: 0;
}

/* At least as tall as the dashboard scroll area (#viewerContainer), so the
   footer sits at the bottom of the page when the panels are short and after
   them when the page scrolls. */
.home--with-footer {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.home-footer-slot {
  margin-top: auto;
  padding-top: 24px;
}

/* Stacked panels keep their own height. The last one fills the rest of the column. */
.home-stack > :deep(.home-panel) {
  height: auto;
}

.home-stack > :deep(.home-panel:last-child) {
  flex: 1 1 auto;
}
</style>
