<template>
  <section class="card home-panel">
    <header class="home-panel-head">
      <h2>{{ $t('dashboard.home.yourSessions') }}</h2>
      <router-link
        class="home-panel-link"
        to="/dashboard/my_sessions"
      >
        {{ $t('dashboard.home.viewAll') }}
      </router-link>
    </header>
    <p v-if="sessionItems.length === 0" class="home-empty">
      {{ $t('dashboard.home.noOpenSessions') }}
    </p>
    <router-link
      v-for="item in sessionItems"
      :key="item.key"
      class="home-session"
      :to="item.to"
    >
      <span class="home-session-main">
        <b>{{ item.title }}</b>
        <small>
          {{ item.detail }}<template v-if="item.progress"> · {{ item.progress.label }}</template>
        </small>
        <span
          v-if="item.progress"
          class="home-progress"
        >
          <span :style="{ width: item.progress.percent + '%' }" />
        </span>
      </span>
      <span
        class="home-due"
        :class="'home-due--' + item.due.tone"
        :title="item.due.title"
      >
        {{ item.due.label }}
      </span>
    </router-link>
  </section>
</template>

<script>
import { homeShared } from "./homeShared";

/**
 * Rows in this panel. Together with HomeDeadlines (also 3) the right column
 * stays about as tall as the 6-row Continue panel on the left, so neither
 * side is stretched into blank space. "View all" leads to the full list.
 */
const SESSIONS_LIMIT = 3;

/**
 * The viewer's open sessions, soonest deadline first. The server picks and
 * orders them and names each deadline (homeSummaryGet, see Home.vue).
 */
export default {
  name: "HomeSessions",
  mixins: [homeShared],
  props: {
    /**
     * Viewer's sessions: `upcoming` holds the open ones, most urgent first
     * (earliest of start + study.timeLimit and study.end), sessions without a
     * deadline in recency order at the end, at most SESSIONS_LIMIT
     * (also the limit in backend/webserver/sockets/home.js).
     */
    sessions: { type: Object, required: true },
    /** Current time, so deadline chips stay current. */
    now: { type: Number, required: true },
  },
  computed: {
    sessionItems() {
      return this.sessions.upcoming
        .slice(0, SESSIONS_LIMIT)
        .map((session) => ({
          ...this.sessionLink(session),
          due: this.dueBadge(session.deadline),
          progress: this.sessionProgress(session),
        }));
    },
  },
  methods: {
    /**
     * Furthest step reached (studyStepIdMax, the step currently in work)
     * out of the study's steps, as in SessionOverview. A new session starts
     * on step 1. Null when the study has a single step or none.
     * @param {{ stepsTotal: number, stepCurrent: number|null }} session
     * @returns {{ label: string, percent: number }|null}
     */
    sessionProgress(session) {
      const total = session.stepsTotal || 0;
      if (total < 2) return null;
      const current = session.stepCurrent;
      if (!current) return null;
      return {
        label: this.$t("dashboard.home.stepOf", { current, total }),
        // studyStepIdMax is the step the user is on, not a finished one,
        // so the bar counts only the steps before it.
        percent: Math.min(100, Math.max(0, Math.round(((current - 1) / total) * 100))),
      };
    },
  },
};
</script>


<style scoped>
/* Thin bar: steps reached in a session. */
.home-progress {
  display: block;
  width: 100%;
  max-width: 160px;
  height: 3px;
  margin-top: 5px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--bs-border-color-translucent);
}

.home-progress > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--care-primary);
}
</style>
