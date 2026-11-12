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
 * The viewer's open sessions, soonest deadline first.
 */
export default {
  name: "HomeSessions",
  mixins: [homeShared],
  props: {
    /** Viewer's sessions that have not ended. */
    openSessions: { type: Array, required: true },
    /** Current time, so deadline chips stay current. */
    now: { type: Number, required: true },
  },
  computed: {
    sessionItems() {
      // Most urgent first; sessions without a deadline keep their recency order at the end.
      return this.openSessions
        .map((session) => {
          const deadline = this.sessionDeadline(session);
          return {
            ...this.sessionLink(session),
            due: this.dueBadge(deadline),
            progress: this.sessionProgress(session),
            deadlineAt: deadline ? deadline.at : Infinity,
          };
        })
        .sort((a, b) => a.deadlineAt - b.deadlineAt)
        .slice(0, SESSIONS_LIMIT);
    },
  },
  methods: {
    /**
     * The earliest of the session's time limit (start + study.timeLimit
     * minutes) and the study's end date, or null if neither applies.
     * @param {object} session
     * @returns {{ at: number, kind: string }|null}
     */
    sessionDeadline(session) {
      const study = this.$store.getters["table/study/get"](session.studyId);
      if (!study) return null;
      const candidates = [];
      if (study.timeLimit > 0 && session.start) {
        const at = new Date(session.start).getTime() + study.timeLimit * 60 * 1000;
        if (!Number.isNaN(at)) candidates.push({ at, kind: "timeLimit" });
      }
      if (study.end) {
        const at = new Date(study.end).getTime();
        if (!Number.isNaN(at)) candidates.push({ at, kind: "study" });
      }
      if (candidates.length === 0) return null;
      return candidates.reduce((min, c) => (c.at < min.at ? c : min));
    },
    /**
     * Furthest step reached (studyStepIdMax, the step currently in work)
     * out of the study's steps, as in SessionOverview. A new session starts
     * on step 1. Null when the study has a single step or none loaded.
     * @param {object} session
     * @returns {{ label: string, percent: number }|null}
     */
    sessionProgress(session) {
      const total = this.$store.getters["table/study_step/getFiltered"](
        (step) => step.studyId === session.studyId
      ).length || 0;
      if (total < 2) return null;
      const current = this.$store.getters["table/study_step/get"](session.studyStepIdMax)?.stepNumber;
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
