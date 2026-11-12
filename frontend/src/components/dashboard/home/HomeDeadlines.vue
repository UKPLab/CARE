<template>
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
</template>

<script>
import { formatLocalizedDateTime, getTimeDiffString } from "@/assets/utils";
import { homeShared } from "./homeShared";

/** Rows in this panel; sized together with HomeSessions, see SESSIONS_LIMIT there. */
const DEADLINES_LIMIT = 3;

/**
 * Open studies with an end date still ahead, soonest first.
 */
export default {
  name: "HomeDeadlines",
  mixins: [homeShared],
  props: {
    /** Studies still open in the current project. */
    openStudies: { type: Array, required: true },
    /** Current time, so "closes in" stays current. */
    now: { type: Number, required: true },
  },
  computed: {
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
      return this.upcomingStudies.slice(0, DEADLINES_LIMIT).map((study) => {
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
  },
};
</script>


<style scoped>
/* Each deadline opens its study; hover matches the other home lists. */
.home-deadline {
  display: block;
  margin: 0 -8px;
  padding: 8px;
  border-radius: var(--care-radius-md);
  color: inherit;
  text-decoration: none;
  transition: background-color var(--care-dur-fast) var(--care-ease);
}

.home-deadline:hover {
  background: var(--care-row-hover);
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
