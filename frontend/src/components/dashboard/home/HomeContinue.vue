<template>
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
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";
import { formatLocalizedDate, getTimeDiffString } from "@/assets/utils";
import { homeShared } from "./homeShared";

const HOME_DOCUMENT_LIMIT = 8;

/**
 * Continue list and the 7-day activity strip.
 */
export default {
  name: "HomeContinue",
  components: { LoadIcon },
  mixins: [homeShared],
  props: {
    /** Viewer's own listed documents. */
    documents: { type: Array, required: true },
    /** Viewer's sessions that have not ended. */
    openSessions: { type: Array, required: true },
    /** Signed-in user, used to count that user's sessions in the week strip. */
    userId: { type: Number, required: true },
    /** Current time, so "edited" lines and the week strip stay current. */
    now: { type: Number, required: true },
  },
  computed: {
    continueItems() {
      const sessions = this.openSessions.map((session) => ({
        at: new Date(session.updatedAt || session.start || session.createdAt).getTime(),
        item: {
          ...this.sessionLink(session),
          kind: "session",
          icon: "clipboard2-pulse",
          kindLabel: this.$t("dashboard.home.kindSession"),
        },
      }));
      const documents = this.documents.map((doc) => {
        const kind = this.documentKind(doc);
        return {
          at: new Date(doc.updatedAt || doc.createdAt).getTime(),
          item: {
            key: `doc-${doc.id}`,
            title: doc.name,
            detail: this.$t("dashboard.home.edited", {
              when: this.timeAgo(doc.updatedAt || doc.createdAt),
            }),
            to: `/document/${doc.hash}`,
            kind: kind.kind,
            icon: kind.icon,
            kindLabel: kind.label,
          },
        };
      });
      return [...sessions, ...documents]
        .sort((a, b) => (b.at || 0) - (a.at || 0))
        .slice(0, HOME_DOCUMENT_LIMIT)
        .map((entry) => entry.item);
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
  },
  methods: {
    /**
     * @param {string|number|Date} value
     * @returns {string}
     */
    timeAgo(value) {
      return getTimeDiffString(this.now, new Date(value));
    },
  },
};
</script>

<style src="./homePanel.css"></style>

<style scoped>
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
</style>
