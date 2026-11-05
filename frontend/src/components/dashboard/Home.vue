<template>
  <div class="home mb-3">
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

    <div class="row g-3 mb-3">
      <div class="col-lg-6">
        <section class="card home-panel home-panel--stack">
          <header class="home-panel-head">
            <h2>{{ $t('dashboard.home.continue') }}</h2>
          </header>
          <p v-if="continueItems.length === 0" class="home-empty">
            {{ $t('dashboard.home.nothingToResume') }}
          </p>
          <router-link
            v-for="item in continueItems"
            :key="item.key"
            class="home-session home-resume"
            :to="item.to"
          >
            <span
              class="home-kind-icon"
              :class="'home-kind-icon--' + item.kind"
            >
              <LoadIcon
                :icon-name="item.icon"
                :size="15"
              />
            </span>
            <span class="home-session-main">
              <b>{{ item.title }}</b>
              <small>{{ item.kindLabel }} · {{ item.detail }}</small>
            </span>
          </router-link>

          <!-- Last 7 days: one cell per day, shade by number of events. -->
          <footer class="home-week">
            <div class="home-week-head">
              <span>{{ $t('dashboard.home.lastSevenDays') }}</span>
              <span>{{ weekSummary }}</span>
            </div>
            <div class="home-week-days">
              <div
                v-for="day in weekDays"
                :key="day.key"
                class="home-week-day"
                :title="day.title"
              >
                <span
                  class="home-week-cell"
                  :class="{ 'home-week-cell--today': day.today }"
                  :style="{ '--level': day.level }"
                >
                  {{ day.count || '' }}
                </span>
                <small>{{ day.label }}</small>
              </div>
            </div>
          </footer>
        </section>
      </div>
      <div class="col-lg-6">
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
      </div>
    </div>

    <div class="row g-3">
      <div v-if="canSeeStudies" class="col-xl-4 order-xl-2">
        <section class="card home-panel">
          <header class="home-panel-head">
            <h2>{{ $t('dashboard.home.upcomingDeadlines') }}</h2>
            <router-link
              class="home-panel-link"
              to="/dashboard/studies"
            >
              {{ $t('dashboard.home.viewAll') }}
            </router-link>
          </header>
          <p v-if="deadlineItems.length === 0" class="home-empty">
            {{ $t('dashboard.home.noUpcomingDeadlines') }}
          </p>
          <router-link
            v-for="item in deadlineItems"
            :key="item.key"
            class="home-deadline"
            :to="item.to"
          >
            <span class="home-deadline-row">
              <b>{{ item.title }}</b>
              <span
                class="home-due"
                :class="'home-due--' + item.tone"
              >
                {{ item.label }}
              </span>
            </span>
            <small>{{ item.detail }}</small>
          </router-link>
          <p
            v-if="studiesWithoutDeadline > 0"
            class="home-empty home-panel-foot"
          >
            {{ $t('dashboard.home.withoutDeadline', { count: studiesWithoutDeadline }) }}
          </p>
        </section>
      </div>
      <div :class="canSeeStudies ? 'col-xl-8 order-xl-1' : 'col-12'">
        <section class="card home-panel">
          <header class="home-panel-head">
            <h2>{{ $t('dashboard.home.recentDocuments') }}</h2>
            <router-link
              class="home-panel-link"
              to="/dashboard/documents"
            >
              {{ $t('dashboard.home.viewAll') }}
            </router-link>
          </header>
          <p
            v-if="recentDocuments.length === 0"
            class="home-empty"
          >
            {{ $t('dashboard.home.noDocuments') }}
          </p>
          <table
            v-else
            class="home-docs"
          >
            <thead>
              <tr>
                <th>{{ $t('common.title') }}</th>
                <th>{{ $t('common.updatedAt') }}</th>
              </tr>
            </thead>
            <tbody>
              <!-- The whole row opens the document; the link stays for keyboard and middle-click. -->
              <tr
                v-for="doc in recentDocuments"
                :key="doc.id"
                @click="$router.push('/document/' + doc.hash)"
              >
                <td>
                  <span class="home-doc-name">
                    <span
                      class="home-kind-icon home-kind-icon--sm"
                      :class="'home-kind-icon--' + documentKind(doc).kind"
                      :title="documentKind(doc).label"
                    >
                      <LoadIcon
                        :icon-name="documentKind(doc).icon"
                        :size="13"
                      />
                    </span>
                    <router-link
                      :to="'/document/' + doc.hash"
                      @click.stop
                    >
                      {{ doc.name }}
                    </router-link>
                  </span>
                </td>
                <td :title="formatLocalizedDateTime(doc.updatedAt || doc.createdAt)">
                  {{ $t('dashboard.home.ago', { when: timeAgo(doc.updatedAt || doc.createdAt) }) }}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  </div>
</template>

<script>
import HomeSubmissionsTile from "@/components/dashboard/HomeSubmissionsTile.vue";
import HomeActivityGraph from "@/components/dashboard/HomeActivityGraph.vue";
import LoadIcon from "@/basic/Icon.vue";
import {
  formatLocalizedDate,
  formatLocalizedDateTime,
  getTimeDiffString,
  isOwnListedDocument,
} from "@/assets/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

const HOME_DOCUMENT_LIMIT = 8;

/**
 * Dashboard home. Counts, resume links, and a short recent-documents
 * list come from tables the dashboard already loads.
 *
 * @author Mohammad Sherif
 */
export default {
  name: "DashboardHome",
  components: { HomeSubmissionsTile, HomeActivityGraph, LoadIcon },
  subscribeTable: ["document", "study", "study_session", "study_step"],
  data() {
    return {
      // Ticks once a minute so deadline countdowns stay current.
      now: Date.now(),
      nowTimer: null,
    };
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
    documentsAddedThisWeek() {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return this.documents.filter((doc) => new Date(doc.createdAt).getTime() >= weekAgo).length;
    },
    projectStudies() {
      return this.$store.getters["table/study/getFiltered"](
        (study) => study.projectId === this.projectId && study.template !== true
      );
    },
    openStudies() {
      const now = Date.now();
      return this.projectStudies.filter((study) => {
        if (study.closed != null) return false;
        if (!study.end) return true;
        const end = new Date(study.end).getTime();
        return Number.isNaN(end) || end >= now || study.multipleSubmit;
      });
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
    openSessions() {
      return this.$store.getters["table/study_session/getByUser"](this.userId)
        .filter((session) => session.end == null)
        .sort((a, b) => new Date(b.start || b.updatedAt || 0) - new Date(a.start || a.updatedAt || 0));
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
    canSeeStudies() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.view");
    },
    canSeeSubmissions() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.submissions.view");
    },
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
        .slice(0, 6);
    },
    // Open studies with an end date still ahead, soonest first.
    upcomingStudies() {
      return this.openStudies
        .filter((study) => {
          const end = new Date(study.end).getTime();
          return study.end && !Number.isNaN(end) && end >= this.now;
        })
        .sort((a, b) => new Date(a.end) - new Date(b.end));
    },
    studiesWithoutDeadline() {
      return this.openStudies.filter((study) => !study.end).length;
    },
    deadlineItems() {
      return this.upcomingStudies.slice(0, 5).map((study) => {
        const end = new Date(study.end).getTime();
        return {
          key: `study-${study.id}`,
          title: study.name,
          label: this.$t("dashboard.home.closesIn", { when: getTimeDiffString(this.now, end) }),
          tone: this.dueTone(end - this.now),
          detail: this.$t("dashboard.home.endsOn", { date: formatLocalizedDateTime(study.end) }),
          // Same target as the "open study" action on the studies dashboard.
          to: `/study/${study.hash}`,
        };
      });
    },
    continueItems() {
      const sessions = this.openSessions.slice(0, 3).map((session) => ({
        ...this.sessionLink(session),
        kind: "session",
        icon: "clipboard2-pulse",
        kindLabel: this.$t("dashboard.home.kindSession"),
      }));
      const documents = this.recentDocuments.slice(0, 2).map((doc) => {
        const kind = this.documentKind(doc);
        return {
          key: `doc-${doc.id}`,
          title: doc.name,
          detail: this.$t("dashboard.home.edited", {
            when: this.timeAgo(doc.updatedAt || doc.createdAt),
          }),
          to: `/document/${doc.hash}`,
          kind: kind.kind,
          icon: kind.icon,
          kindLabel: kind.label,
        };
      });
      return [...sessions, ...documents];
    },
    /**
     * Last 7 days ending today. Counts the user's own events: documents
     * added, sessions started, sessions finished.
     */
    weekDays() {
      const sessions = this.$store.getters["table/study_session/getByUser"](this.userId);
      const dates = [
        ...this.documents.map((doc) => doc.createdAt),
        ...sessions.map((session) => session.start || session.createdAt),
        ...sessions.map((session) => session.end),
      ]
        .filter(Boolean)
        .map((value) => new Date(value).getTime())
        .filter((time) => !Number.isNaN(time));

      const today = new Date(this.now);
      today.setHours(0, 0, 0, 0);
      const days = [];
      for (let offset = 6; offset >= 0; offset--) {
        const dayStart = new Date(today);
        dayStart.setDate(today.getDate() - offset);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayStart.getDate() + 1);
        const count = dates.filter((t) => t >= dayStart.getTime() && t < dayEnd.getTime()).length;
        days.push({
          key: dayStart.getTime(),
          count,
          today: offset === 0,
          label: formatLocalizedDate(dayStart, { weekday: "short" }),
          title: this.$t("dashboard.home.dayEvents", {
            date: formatLocalizedDate(dayStart, { weekday: "long", day: "numeric", month: "short" }),
            count,
          }),
        });
      }
      const max = Math.max(1, ...days.map((day) => day.count));
      // 0 for an empty day, otherwise 0.25..1 relative to the busiest day.
      return days.map((day) => ({
        ...day,
        level: day.count === 0 ? 0 : 0.25 + 0.75 * (day.count / max),
      }));
    },
    weekSummary() {
      const total = this.weekDays.reduce((sum, day) => sum + day.count, 0);
      return this.$t("dashboard.home.weekEvents", { count: total });
    },
    recentDocuments() {
      return [...this.documents]
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
        .slice(0, HOME_DOCUMENT_LIMIT);
    },
  },
  methods: {
    formatLocalizedDateTime,
    sessionLink(session) {
      const study = this.$store.getters["table/study/get"](session.studyId);
      const when = getTimeDiffString(Date.now(), new Date(session.start || session.createdAt));
      return {
        key: `session-${session.id}`,
        title: study?.name || this.$t("sidebar.nav.my_sessions"),
        detail: this.$t("dashboard.home.started", { when }),
        to: `/session/${session.hash}`,
      };
    },
    timeAgo(value) {
      return getTimeDiffString(this.now, new Date(value));
    },
    /**
     * Icon and label per document type: 0 PDF (annotator),
     * 1 text (editor), 2 configuration (editor with configurator).
     */
    documentKind(doc) {
      if (doc.type === 1) {
        return { kind: "text", icon: "file-earmark-text", label: this.$t("dashboard.home.kindText") };
      }
      if (doc.type === 2) {
        return { kind: "text", icon: "file-earmark-code", label: this.$t("dashboard.home.kindConfig") };
      }
      return { kind: "pdf", icon: "file-earmark-pdf", label: this.$t("dashboard.home.kindPdf") };
    },
    /**
     * The earliest of the session's time limit (start + study.timeLimit
     * minutes) and the study's end date, or null if neither applies.
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
    dueTone(remainingMs) {
      if (remainingMs < 0) return "overdue";
      if (remainingMs < 24 * 60 * 60 * 1000) return "urgent";
      if (remainingMs < 3 * 24 * 60 * 60 * 1000) return "soon";
      return "later";
    },
    dueBadge(deadline) {
      if (!deadline) {
        return { tone: "none", label: this.$t("dashboard.home.noDeadline"), title: "" };
      }
      const remaining = deadline.at - this.now;
      const when = getTimeDiffString(this.now, deadline.at);
      const date = formatLocalizedDateTime(new Date(deadline.at));
      return {
        tone: this.dueTone(remaining),
        label: remaining < 0
          ? this.$t("dashboard.home.overdue", { when })
          : this.$t("dashboard.home.dueIn", { when }),
        title: deadline.kind === "timeLimit"
          ? this.$t("dashboard.home.deadlineTimeLimit", { date })
          : this.$t("dashboard.home.deadlineStudy", { date }),
      };
    },
    /**
     * Furthest step reached (studyStepIdMax, the step currently in work)
     * out of the study's steps, as in SessionOverview. A new session starts
     * on step 1. Null when the study has a single step or none loaded.
     */
    sessionProgress(session) {
      const total = this.$store.getters["table/study_step/getFiltered"](
        (step) => step.studyId === session.studyId
      ).length || session.numberSteps || 0;
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
/* Row hover, same wash as the dashboard tables (basic/table/table.css). */
.home {
  --home-hover: color-mix(in srgb, var(--care-primary) 5%, transparent);
}

[data-bs-theme="dark"] .home {
  --home-hover: color-mix(in srgb, var(--care-accent) 10%, transparent);
}

.home .row > [class*="col"] {
  min-width: 0;
}

.home-panel {
  min-width: 0;
  height: 100%;
  padding: 14px 16px;
  overflow: hidden;
  background: var(--bs-body-bg);
}

/* A hairline under the heading separates it from the list below. */
.home-panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: .75rem;
  margin: 0 -16px 10px;
  padding: 0 16px 10px;
  border-bottom: 1px solid var(--bs-border-color-translucent);
}

.home-panel h2 {
  margin: 0;
  font-size: .95rem;
  font-weight: 650;
  letter-spacing: -.01em;
  color: var(--bs-emphasis-color);
}

.home-panel-link {
  flex: 0 0 auto;
  font-size: .85rem;
  font-weight: 600;
  text-decoration: none;
}

/* Bleeds 8px past the panel padding so the row hover has room on both sides. */
.home-docs {
  width: calc(100% + 16px);
  margin: 0 -8px;
  border-collapse: separate;
  border-spacing: 0;
}

.home-docs th,
.home-docs td {
  padding: .45rem 0;
  border-bottom: 1px solid var(--bs-border-color-translucent);
  font-size: .9rem;
  vertical-align: top;
}

.home-docs th {
  padding-top: 0;
  color: var(--bs-secondary-color);
  font-size: .75rem;
  font-weight: 650;
  letter-spacing: .02em;
  text-transform: uppercase;
}

.home-docs th:not(:first-child),
.home-docs td:not(:first-child) {
  padding-left: 1rem;
  color: var(--bs-secondary-color);
  white-space: nowrap;
  width: 1%;
}

.home-docs tr:last-child td {
  border-bottom: 0;
}

/* Body rows are clickable as a whole; the hover wash runs edge to edge. */
.home-docs tbody td {
  vertical-align: middle;
  cursor: pointer;
  transition: background-color .12s ease;
}

.home-docs tbody td:first-child {
  padding-left: 8px;
}

.home-docs tbody td:last-child {
  padding-right: 8px;
}

.home-docs th:first-child {
  padding-left: 8px;
}

.home-docs th:last-child {
  padding-right: 8px;
}

.home-docs tbody tr:hover > td {
  background: var(--home-hover);
}

.home-docs tbody tr:hover > td:first-child {
  border-top-left-radius: 6px;
  border-bottom-left-radius: 6px;
}

.home-docs tbody tr:hover > td:last-child {
  border-top-right-radius: 6px;
  border-bottom-right-radius: 6px;
}

.home-docs tbody tr:hover a {
  color: var(--care-primary);
}

.home-doc-name {
  display: flex;
  align-items: center;
  gap: .6rem;
  min-width: 0;
}

.home-docs a {
  overflow: hidden;
  color: inherit;
  font-weight: 600;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-session b {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-session small,
.home-empty {
  color: var(--bs-secondary-color);
}

.home-empty {
  margin: 0;
  font-size: .9rem;
}

.home-session {
  display: flex;
  align-items: center;
  gap: .75rem;
  min-width: 0;
  margin: 0 -8px;
  padding: 8px;
  border-radius: 8px;
  color: inherit;
  text-decoration: none;
  transition: background-color .12s ease;
}

.home-session:hover {
  background: var(--home-hover);
}

.home-session:hover b {
  color: var(--care-primary);
}

/* Soft type marker: tinted square with the same icons as the sidebar. */
.home-kind-icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  color: var(--care-primary);
  background: color-mix(in srgb, var(--care-primary) 10%, transparent);
}

.home-kind-icon--sm {
  width: 24px;
  height: 24px;
  border-radius: 6px;
}

.home-kind-icon--pdf,
.home-kind-icon--text {
  color: var(--bs-secondary-color);
  background: var(--bs-secondary-bg);
}

[data-bs-theme="dark"] .home-kind-icon--session {
  color: var(--care-accent);
  background: color-mix(in srgb, var(--care-accent) 14%, transparent);
}

/* Continue panel: list on top, the week strip pinned to the bottom. */
.home-panel--stack {
  display: flex;
  flex-direction: column;
}

.home-week {
  margin: auto -16px -14px;
  padding: 12px 16px 14px;
  border-top: 1px solid var(--bs-border-color-translucent);
}

.home-panel--stack > .home-session:last-of-type {
  margin-bottom: 12px;
}

.home-week-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  color: var(--bs-secondary-color);
  font-size: .75rem;
  font-weight: 650;
  letter-spacing: .02em;
  text-transform: uppercase;
}

.home-week-days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}

.home-week-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

/* --level 0..1 sets the tint, like a contribution heatmap. */
.home-week-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 26px;
  border-radius: 6px;
  font-size: .75rem;
  font-weight: 600;
  color: var(--bs-emphasis-color);
  background:
    color-mix(in srgb, var(--care-primary) calc(var(--level) * 55%), var(--bs-secondary-bg));
}

[data-bs-theme="dark"] .home-week-cell {
  background:
    color-mix(in srgb, var(--care-accent) calc(var(--level) * 45%), var(--bs-secondary-bg));
}

.home-week-cell--today {
  box-shadow: inset 0 0 0 1.5px var(--care-primary);
}

[data-bs-theme="dark"] .home-week-cell--today {
  box-shadow: inset 0 0 0 1.5px var(--care-accent);
}

.home-week-day small {
  color: var(--bs-secondary-color);
  font-size: .7rem;
}

.home-session-main {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

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

/* Deadline chip. Tone follows the time left: overdue/<24h, <3 days, later, none. */
.home-due {
  flex: 0 0 auto;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: .75rem;
  font-weight: 600;
  white-space: nowrap;
  color: var(--bs-secondary-color);
  background: var(--bs-secondary-bg);
}

.home-due--overdue,
.home-due--urgent {
  color: var(--bs-danger-text-emphasis);
  background: var(--bs-danger-bg-subtle);
}

.home-due--soon {
  color: var(--bs-warning-text-emphasis);
  background: var(--bs-warning-bg-subtle);
}

.home-due--none {
  font-weight: 500;
  background: transparent;
}

/* Each deadline opens its study; hover matches the other home lists. */
.home-deadline {
  display: block;
  margin: 0 -8px;
  padding: 8px;
  border-radius: 8px;
  color: inherit;
  text-decoration: none;
  transition: background-color .12s ease;
}

.home-deadline:hover {
  background: var(--home-hover);
}

.home-deadline:hover b {
  color: var(--care-primary);
}

.home-deadline-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
  min-width: 0;
}

.home-deadline b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: .9rem;
}

.home-deadline small {
  display: block;
  margin-top: 2px;
  color: var(--bs-secondary-color);
}

.home-panel-foot {
  margin-top: 10px;
  font-size: .8rem;
}
</style>
