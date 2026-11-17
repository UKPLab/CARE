<template>
  <HomeGuest
    v-if="isGuestHome"
    :can-see-studies="canSeeStudies"
    :studies="guestStudies"
    :showcase-document="summary?.showcaseDocument || null"
    :now="now"
  />

  <div v-else class="home home--with-footer">
    <HomeCountTiles
      :documents="documents"
      :sessions="sessions"
      :studies="studies"
      :submissions="submissions"
      :can-see-studies="canSeeStudies"
      :can-see-submissions="canSeeSubmissions"
      :now="now"
    />

    <div class="row g-3">
      <div class="col-lg-6">
        <HomeContinue
          :documents="documents"
          :sessions="sessions"
          :can-see-studies="canSeeStudies"
          :now="now"
        />
      </div>
      <div class="col-lg-6 d-flex flex-column gap-3 home-stack">
        <HomeDeadlines
          v-if="canSeeStudies"
          :studies="studies"
          :now="now"
        />
        <HomeSessions
          :sessions="sessions"
          :now="now"
        />
      </div>
    </div>

    <AppFooter class="home-footer-slot" />
  </div>
</template>

<script>
import { resolveApiMessage } from "@/assets/utils";
import HomeGuest from "./home/HomeGuest.vue";
import HomeCountTiles from "./home/HomeCountTiles.vue";
import HomeContinue from "./home/HomeContinue.vue";
import HomeSessions from "./home/HomeSessions.vue";
import HomeDeadlines from "./home/HomeDeadlines.vue";
import AppFooter from "@/basic/navigation/AppFooter.vue";

/** Tables whose row changes can move a Home number. assignment/submission only feed the submissions tile. */
const WATCHED_TABLES = ["document", "study", "study_session"];
const SUBMISSION_TABLES = ["assignment", "submission"];
/** Several rows usually change in one save (a session and its study); refetch once for all of them. */
const REFETCH_DEBOUNCE_MS = 400;

const EMPTY_DOCUMENTS = Object.freeze({ total: 0, recent: [], createdDates: [] });
const EMPTY_SESSIONS = Object.freeze({
  openTotal: 0, oldestOpenAt: null, upcoming: [], recentByStudy: [], startedDates: [], finishedDates: [],
});
const EMPTY_STUDIES = Object.freeze({
  openTotal: 0, closingSoon: 0, withoutDeadline: 0, upcoming: [], createdDates: [], closedDates: [],
});
const EMPTY_SUBMISSIONS = Object.freeze({ assignmentsTotal: 0, createdDates: [], submittedDates: [] });

/**
 * Dashboard home. Resume links come from the viewer's own documents
 * and sessions, plus the studies they can open.
 *
 * Nothing is loaded into Vuex: the server computes counts, short lists and
 * activity dates (`homeSummaryGet`, backend/webserver/sockets/home.js) within
 * the viewer's read rights. Home holds the watched tables in query mode, so a
 * row change sends a Delta/Stale event and the summary is fetched again.
 *
 * @author Mohammad Sherif
 */
export default {
  name: "DashboardHome",
  components: { HomeGuest, HomeCountTiles, HomeContinue, HomeSessions, HomeDeadlines, AppFooter },
  data() {
    return {
      // Ticks once a minute so countdowns follow passing deadlines.
      now: Date.now(),
      nowTimer: null,
      summary: null,
      // Bumped per request, so an older answer arriving late does not replace a newer one.
      requestId: 0,
      refetchTimer: null,
      heldTables: [],
    };
  },
  computed: {
    isGuestHome() {
      return this.$store.getters["auth/isGuestHome"];
    },
    projectId() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    },
    canSeeStudies() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.view");
    },
    canSeeSubmissions() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.submissions.view");
    },
    documents() {
      return this.summary?.documents || EMPTY_DOCUMENTS;
    },
    sessions() {
      return this.summary?.sessions || EMPTY_SESSIONS;
    },
    studies() {
      return this.summary?.studies || EMPTY_STUDIES;
    },
    submissions() {
      return this.summary?.submissions || EMPTY_SUBMISSIONS;
    },
    guestStudies() {
      return this.summary?.studies?.open || [];
    },
    watchedTables() {
      return this.canSeeSubmissions ? [...WATCHED_TABLES, ...SUBMISSION_TABLES] : WATCHED_TABLES;
    },
  },
  watch: {
    projectId() {
      this.fetchSummary();
    },
    // Rights or the guest flag changed (roles updated while Home is open).
    canSeeStudies() {
      this.fetchSummary();
    },
    canSeeSubmissions() {
      this.holdTables();
      this.fetchSummary();
    },
    isGuestHome() {
      this.fetchSummary();
    },
  },
  mounted() {
    this.nowTimer = setInterval(() => {
      this.now = Date.now();
      // Open / upcoming / closing-soon studies change when a study end passes. The server
      // names the next such moment, so Home does not have to poll every minute.
      const nextChangeAt = this.summary?.nextChangeAt;
      if (nextChangeAt != null && this.now >= nextChangeAt) {
        this.fetchSummary();
      }
    }, 60 * 1000);
    this.holdTables();
    this.$socket.on("connect", this.onConnect);
    this.fetchSummary();
  },
  beforeUnmount() {
    clearInterval(this.nowTimer);
    clearTimeout(this.refetchTimer);
    this.$socket.off("connect", this.onConnect);
    this.releaseTables();
  },
  methods: {
    // (Re)connect: a new server socket has none of the old holds, and changes may have been missed.
    onConnect() {
      this.heldTables.forEach((table) => this.$socket.emit("queryTableAcquire", { table }));
      this.fetchSummary();
    },
    fetchSummary() {
      if (!this.$socket.connected) {
        // onConnect fetches.
        return;
      }
      const requestId = ++this.requestId;
      this.$socket.emit("homeSummaryGet", { projectId: this.projectId }, (response) => {
        if (requestId !== this.requestId) {
          return;
        }
        if (!response?.success) {
          this.eventBus.emit("toast", {
            message: resolveApiMessage(response),
            variant: "danger",
          });
          return;
        }
        this.summary = response.data;
        this.now = Date.now();
      });
    },
    scheduleFetch() {
      clearTimeout(this.refetchTimer);
      this.refetchTimer = setTimeout(() => this.fetchSummary(), REFETCH_DEBOUNCE_MS);
    },
    /**
     * Query mode (as BackendTable): the server then sends {table}Delta / {table}Stale for rows
     * this viewer may read. Home only needs to know that something changed.
     */
    holdTables() {
      const wanted = this.watchedTables;
      this.heldTables
        .filter((table) => !wanted.includes(table))
        .forEach((table) => this.releaseTable(table));
      wanted
        .filter((table) => !this.heldTables.includes(table))
        .forEach((table) => {
          // vue-3-socket.io routes custom events through its own emitter, $socket.on would not fire.
          this.sockets.subscribe(table + "Delta", this.scheduleFetch);
          this.sockets.subscribe(table + "Stale", this.scheduleFetch);
          if (this.$socket.connected) {
            // Otherwise onConnect acquires it.
            this.$socket.emit("queryTableAcquire", { table });
          }
          this.heldTables.push(table);
        });
    },
    releaseTable(table) {
      this.sockets.unsubscribe(table + "Delta");
      this.sockets.unsubscribe(table + "Stale");
      if (this.$socket.connected) {
        this.$socket.emit("queryTableRelease", { table });
      }
      this.heldTables = this.heldTables.filter((held) => held !== table);
    },
    releaseTables() {
      [...this.heldTables].forEach((table) => this.releaseTable(table));
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
