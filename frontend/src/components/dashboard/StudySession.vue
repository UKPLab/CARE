<template>
  <Card
    class="sessions-dashboard"
    :title="$t('studies.dashboard.title')"
  >
    <template #title>
      <span class="sessions-title">{{ $t('studies.dashboard.title') }}</span>
    </template>

    <template #body>
      <div class="sessions-page">
        <section
          v-for="section in sections"
          :key="section.key"
          class="sessions-section"
        >
          <header class="sessions-section-head">
            <h2 class="sessions-section-title">
              {{ section.title }}
            </h2>
          </header>

          <!-- Studies come page by page from the server (queryTable, scope mySessions); nothing
               is loaded into Vuex. -->
          <BackendTable
            :ref="'studies-' + section.key"
            table="study"
            :columns="studyColumns"
            :query-filter="studyQueryFilter"
            :query-scope="section.scope"
            :query-scope-matcher="(row) => scopeMatcher(row, section.closed)"
            :query-filter-schema="studyFilterSchema"
            :query-search-columns="studySearchColumns"
            :enrich-row="(row) => enrichStudyRow(row)"
            :options="section.options"
            card-mode
          >
            <template #cards="cards">
          <div
            v-if="cards.rows.length === 0"
            class="sessions-empty"
          >
            <span
              class="sessions-empty-icon"
              aria-hidden="true"
            >
              <LoadIcon
                :icon-name="cards.searching ? 'search' : section.emptyIcon"
                :size="22"
              />
            </span>
            <p v-if="cards.loading">{{ $t('common.loadingFromServer') }}</p>
            <p v-else-if="cards.searching">{{ $t('common.noMatches') }}</p>
            <p v-else>{{ section.emptyText }}</p>
          </div>

          <div
            v-else
            :ref="(el) => setGridRef(section.key, el)"
            class="sessions-grid"
            :class="{ 'is-refreshing': cards.loadingVisible }"
          >
            <template
              v-for="(study, index) in cards.rows"
              :key="study.id"
            >
            <article
              class="session-study"
              :class="[
                'session-study--' + study.stateSlug,
                { 'is-open': isOpen(study.id) },
              ]"
              :style="{ '--i': index }"
            >
              <header class="session-study-head">
                <span
                  class="study-state"
                  :class="'study-state--' + study.stateSlug"
                >
                  <LoadIcon
                    v-if="study.stateSlug === 'closed'"
                    icon-name="lock-fill"
                    :size="10"
                  />
                  <span
                    v-else
                    class="study-state-dot"
                  />
                  {{ study.stateLabel }}
                </span>
                <span class="session-study-id">#{{ study.id }}</span>
              </header>

              <button
                type="button"
                class="session-study-title"
                :title="study.displayName"
                :aria-expanded="isOpen(study.id) ? 'true' : 'false'"
                :aria-controls="'sessions-of-' + study.id"
                @click="toggle(study.id)"
              >
                {{ study.displayName }}
              </button>

              <div class="session-study-meta">
                <span
                  v-if="study.author"
                  class="session-study-meta-item"
                >
                  <LoadIcon
                    icon-name="person"
                    :size="12"
                  />
                  {{ study.author }}
                </span>
                <span
                  v-if="study.createdAt"
                  class="session-study-meta-item"
                  :title="$t('studies.columns.created')"
                >
                  <LoadIcon
                    icon-name="calendar3"
                    :size="12"
                  />
                  {{ formatDate(study.createdAt) }}
                </span>
              </div>

              <!-- The viewer's own sessions in this study (study inject mySessions / mySessionsFinished) -->
              <div class="session-study-progress">
                <div class="session-study-progress-head">
                  <span class="session-study-progress-label">{{ $t('studies.columns.sessions') }}</span>
                  <span class="session-study-progress-count">
                    <strong>{{ study.mySessionCount }}</strong>
                    <span class="session-study-progress-sub">
                      {{ $t('studies.dashboard.finishedCount', { count: study.myFinishedCount }) }}
                    </span>
                  </span>
                </div>
                <div class="session-study-bar">
                  <span
                    class="session-study-bar-fill"
                    :style="{ width: study.myFinishedPercent + '%' }"
                  />
                </div>
              </div>

              <div
                v-if="timeline(study)"
                class="session-study-timeline"
                :class="'session-study-timeline--' + timeline(study).tone"
                :title="timeline(study).exact"
              >
                <LoadIcon
                  :icon-name="timeline(study).icon"
                  :size="13"
                />
                <span class="session-study-timeline-label">{{ timeline(study).label }}</span>
                <span
                  v-if="timeline(study).relative"
                  class="session-study-timeline-relative"
                >{{ timeline(study).relative }}</span>
              </div>

              <footer class="session-study-foot">
                <button
                  type="button"
                  class="session-study-toggle"
                  :aria-expanded="isOpen(study.id) ? 'true' : 'false'"
                  :aria-controls="'sessions-of-' + study.id"
                  @click="toggle(study.id)"
                >
                  <LoadIcon
                    icon-name="person-video2"
                    :size="14"
                  />
                  {{ isOpen(study.id) ? $t('studies.dashboard.hideSessions') : $t('studies.dashboard.showSessions') }}
                  <LoadIcon
                    class="session-study-chevron"
                    icon-name="chevron-down"
                    :size="13"
                  />
                </button>
              </footer>

            </article>

            <!-- Sessions panel: its own full-width grid row right after the row of the open
                 card, so the card itself stays where it is. -->
            <div
              v-if="openStudyId !== null && index === panelAfterIndex(section.key, cards.rows)"
              :id="'sessions-of-' + openStudyId"
              :key="'panel-' + openStudyId"
              class="session-panel"
              :class="'session-panel--' + openStudy(cards.rows).stateSlug"
              :style="{ '--notch-left': notchLeft(section.key, cards.rows) }"
              role="region"
              :aria-label="openStudy(cards.rows).displayName"
            >
              <header class="session-panel-head">
                <span class="session-panel-title">{{ openStudy(cards.rows).displayName }}</span>
                <button
                  type="button"
                  class="session-panel-close"
                  :title="$t('studies.dashboard.hideSessions')"
                  :aria-label="$t('studies.dashboard.hideSessions')"
                  @click="toggle(openStudyId)"
                >
                  <LoadIcon
                    icon-name="x-lg"
                    :size="13"
                  />
                </button>
              </header>
              <StudySessionCards
                :key="openStudyId"
                :study="openStudy(cards.rows)"
                :show-closed="section.closed"
                @action="onSessionAction"
              />
            </div>
            </template>
          </div>
            </template>
          </BackendTable>
        </section>
      </div>
    </template>
  </Card>

  <ConfirmModal ref="deleteConf" />
  <AssignUserModal ref="assignUserModal" />

  <Timer
    autostart
    @time-step="trigger++"
  />
</template>

<script>
// Self-hosted (bundled by Vite, no third-party font CDN), SIL Open Font License 1.1.
import "@fontsource-variable/inter/opsz.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
import Card from "@/basic/dashboard/card/Card.vue";
import BackendTable from "@/basic/BackendTable.vue";
import LoadIcon from "@/basic/Icon.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import Timer from "@/basic/Timer.vue";
import AssignUserModal from "@/components/dashboard/study/AssignUserStudySessionModal.vue";
import StudySessionCards from "@/components/dashboard/study/StudySessionCards.vue";
import { confirmSoftDelete } from "@/basic/dashboard/actions.js";
import { NUMERIC_OPERATORS } from "@/basic/table/searchTokens.js";
import { formatLocalizedDate, formatLocalizedDateTime, getTimeDiffString } from "@/assets/utils";

/** Under this much time left, the due date turns amber. */
const SOON_MS = 3 * 24 * 60 * 60 * 1000;

/** One BackendTable per section; each needs its own options (pagination.total is written back). */
function sectionOptions() {
  return {
    pagination: {
      serverSide: true,
      itemsPerPage: 9,
      itemsPerPageList: [9, 18, 36],
      total: 0,
    },
    search: true,
    sort: { column: "createdAt", order: "DESC" },
  };
}

/**
 * "My Sessions" dashboard: the studies the current user has sessions in, as cards in the style
 * of the Studies dashboard. Opening a study shows the user's sessions as cards.
 *
 * Both lists and the sessions inside them come from BackendTable (server-side queryTable with
 * live Delta updates). The study list uses the `mySessions` scope of the study model; nothing is
 * dumped into Vuex.
 *
 * @author: Nils Dycke, Dennis Zyska
 */
export default {
  name: "DashboardStudySession",
  components: { Card, BackendTable, LoadIcon, ConfirmModal, AssignUserModal, StudySessionCards, Timer },
  props: {},
  data() {
    return {
      trigger: 0,
      // One sessions panel at a time, across both sections.
      openStudyId: null,
      // Grid columns per section, measured so the panel can follow the open card's row.
      gridColumns: {},
      activeOptions: sectionOptions(),
      closedOptions: sectionOptions(),
    };
  },
  computed: {
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    canReadPrivateInformation() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.view.userPrivateInfo");
    },
    projectId() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    },
    /** Same base filter as the Studies dashboard: current project, no templates. */
    studyQueryFilter() {
      return [
        { key: "projectId", value: this.projectId },
        { key: "template", value: false },
      ];
    },
    /** BackendTable needs columns even in card mode (its hidden table stays mounted). */
    studyColumns() {
      return [
        { name: this.$t("common.id"), key: "id" },
        { name: this.$t("common.name"), key: "name" },
        { name: this.$t("studies.columns.created"), key: "createdAt", type: "datetime" },
      ];
    },
    studyFilterSchema() {
      return {
        id: { label: this.$t("common.id"), type: "numeric", operators: NUMERIC_OPERATORS },
        createdAt: { label: this.$t("studies.columns.created"), type: "date" },
      };
    },
    /** Free text only on what the cards show. */
    studySearchColumns() {
      const columns = ["id", "name"];
      if (this.canReadPrivateInformation) {
        columns.push("firstName", "lastName");
      }
      return columns;
    },
    sections() {
      return [
        {
          key: "active",
          closed: false,
          title: this.$t("studies.dashboard.activeSessions.title"),
          emptyText: this.$t("studies.dashboard.activeSessions.noSessions"),
          emptyIcon: "play-circle",
          scope: { mySessions: { state: "active" } },
          options: this.activeOptions,
        },
        {
          key: "closed",
          closed: true,
          title: this.$t("studies.dashboard.closedSessions.title"),
          emptyText: this.$t("studies.dashboard.closedSessions.noSessions"),
          emptyIcon: "archive",
          scope: { mySessions: { state: "closed" } },
          options: this.closedOptions,
        },
      ];
    },
  },
  beforeUnmount() {
    Object.values(this.gridObservers || {}).forEach((observer) => observer.disconnect());
    this.gridObservers = {};
  },
  methods: {
    /**
     * Client mirror of the `mySessions` scope for live rows. Whether the viewer has a session in
     * a study cannot be read from the study row, so only the active / closed split is checked:
     * a row of the other section is rejected, anything else stays "unknown" (BackendTable then
     * keeps only rows it already loaded). The server applies the full scope on every fetch.
     * @param {Object} row raw study row from a Delta
     * @param {boolean} closedSection
     * @returns {boolean|undefined}
     */
    scopeMatcher(row, closedSection) {
      if (!row || !("closed" in row) || !("end" in row) || !("multipleSubmit" in row)) {
        return undefined;
      }
      return this.isStudyAvailable(row) === closedSection ? false : undefined;
    },
    /** Adds what a card shows (name, author, state) to a study row. */
    enrichStudyRow(row) {
      const study = { ...row };
      study.displayName = study.name || this.$t("studies.dashboard.noName");
      // firstName / lastName come from the study model's user inject (userPrivateInfo only).
      study.author = this.canReadPrivateInformation && study.firstName && study.lastName
        ? `${study.firstName} ${study.lastName}`
        : "";
      // Counted server-side for the viewer only (study injects mySessions / mySessionsFinished).
      study.mySessionCount = Number(study.mySessions) || 0;
      study.myFinishedCount = Number(study.mySessionsFinished) || 0;
      study.myFinishedPercent = study.mySessionCount
        ? Math.round((study.myFinishedCount / study.mySessionCount) * 100)
        : 0;
      if (study.closed !== null && study.closed !== undefined) {
        study.stateSlug = "closed";
        study.stateLabel = this.$t("studies.status.closed");
      } else if (!this.isStudyAvailable(study)) {
        study.stateSlug = "ended";
        study.stateLabel = this.$t("studies.status.ended");
      } else {
        study.stateSlug = "running";
        study.stateLabel = this.$t("studies.status.running");
      }
      return study;
    },
    isStudyAvailable(study) {
      if (!study) {
        return false;
      }
      if (study.closed !== null) {
        return false;
      }
      if (!study.multipleSubmit && study.end) {
        const endDate = new Date(study.end);
        if (!isNaN(endDate.getTime()) && endDate < new Date()) {
          return false;
        }
      }
      return true;
    },
    isOpen(id) {
      return this.openStudyId === id;
    },
    /** Opening one study closes the panel of any other. */
    toggle(id) {
      this.openStudyId = this.openStudyId === id ? null : id;
    },
    openStudy(rows) {
      return rows.find((row) => row.id === this.openStudyId) || null;
    },
    /** Track the column count of a section grid (it changes with the window width). */
    setGridRef(key, el) {
      this.gridObservers = this.gridObservers || {};
      if (!el) {
        this.gridObservers[key]?.disconnect();
        delete this.gridObservers[key];
        return;
      }
      if (this.gridObservers[key]?.el === el) return;
      this.gridObservers[key]?.disconnect();
      const measure = () => {
        const tracks = getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length;
        const columns = Math.max(1, tracks);
        if (this.gridColumns[key] !== columns) {
          this.gridColumns = { ...this.gridColumns, [key]: columns };
        }
      };
      const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
      observer?.observe(el);
      this.gridObservers[key] = { el, disconnect: () => observer?.disconnect() };
      measure();
    },
    /**
     * Index of the last card in the open card's row; the panel is rendered right after it.
     * @returns {number} -1 when the open study is not in these rows
     */
    panelAfterIndex(key, rows) {
      const index = rows.findIndex((row) => row.id === this.openStudyId);
      if (index < 0) return -1;
      const columns = this.gridColumns[key] || 1;
      return Math.min(rows.length - 1, Math.floor(index / columns) * columns + columns - 1);
    },
    /** Horizontal position of the panel's notch: the centre of the open card's column. */
    notchLeft(key, rows) {
      const index = rows.findIndex((row) => row.id === this.openStudyId);
      const columns = this.gridColumns[key] || 1;
      const column = index < 0 ? 0 : index % columns;
      return `${((column + 0.5) / columns) * 100}%`;
    },
    formatDate(value) {
      return formatLocalizedDate(value, { day: "2-digit", month: "short", year: "numeric" });
    },
    /**
     * The date line of a card: when the study closes, with the time left that ticks along
     * with the page timer.
     * @returns {{icon: string, tone: string, label: string, relative: string, exact: string}|null}
     */
    timeline(study) {
      this.trigger; // leave here to re-evaluate every timer step
      const now = Date.now();
      const end = study.end ? new Date(study.end).getTime() : null;
      const date = (time) => this.formatDate(time);

      if (study.stateSlug === "closed") {
        const closedAt = study.closed ? new Date(study.closed).getTime() : null;
        if (!closedAt) return null;
        return {
          icon: "lock",
          tone: "muted",
          label: this.$t("studies.dashboard.closedOn", { date: date(closedAt) }),
          relative: "",
          exact: formatLocalizedDateTime(closedAt),
        };
      }
      if (study.stateSlug === "ended" && end) {
        return {
          icon: "calendar-check",
          tone: "muted",
          label: this.$t("studies.cards.endedOn", { date: date(end) }),
          relative: "",
          exact: formatLocalizedDateTime(end),
        };
      }
      if (!end) {
        return {
          icon: "infinity",
          tone: "muted",
          label: this.$t("studies.dashboard.noDueDate"),
          relative: "",
          exact: "",
        };
      }
      if (end > now) {
        const soon = end - now <= SOON_MS;
        return {
          icon: soon ? "alarm" : "stopwatch",
          tone: soon ? "soon" : "running",
          label: this.$t("studies.cards.closesOn", { date: date(end) }),
          relative: this.$t("studies.dashboard.dueIn", { time: getTimeDiffString(now, end) }),
          exact: formatLocalizedDateTime(end),
        };
      }
      // Past the end but still running: multiple submissions keep the study open.
      return {
        icon: "calendar-check",
        tone: "muted",
        label: this.$t("studies.cards.noNewSessionsSince", { date: date(end) }),
        relative: "",
        exact: formatLocalizedDateTime(end),
      };
    },
    onSessionAction({ type, session }) {
      switch (type) {
        case "resume":
        case "start":
          this.$router.push("/session/" + session.hash);
          break;
        case "inspect":
          this.$router.push("/review/" + session.hash);
          break;
        case "copy":
          this.$refs.assignUserModal.open(session);
          break;
        case "delete":
          this.confirmDelete(session);
          break;
      }
    },
    confirmDelete(session) {
      confirmSoftDelete(
        {
          confirmRef: this.$refs.deleteConf,
          socket: this.$socket,
          eventBus: this.eventBus,
        },
        {
          table: "study_session",
          id: session.id,
          title: this.$t("dashboard.study.deleteSession"),
          message: this.$t("dashboard.study.deleteSessionNote"),
          failTitle: this.$t("dashboard.study.studySessionNotDeleted"),
          onSuccess: () => {
            this.eventBus.emit("toast", {
              title: this.$t("dashboard.study.studySessionDeleted"),
              message: this.$t("dashboard.study.studySessionHasBeenDeleted"),
              variant: "success",
            });
          },
        }
      );
    },
  },
};
</script>

<style scoped>
/* ======================================================================
   "My Sessions": same shell and card language as the Studies dashboard
   (page wash, state pills, accent edge, Inter / JetBrains Mono).
   ====================================================================== */

.sessions-dashboard {
  --sd-radius: 16px;
  --sd-border: rgba(15, 23, 42, 0.08);
  --sd-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px -12px rgba(15, 23, 42, 0.12);
  --sd-bg:
    radial-gradient(1100px 360px at 0% -8%, rgba(var(--bs-primary-rgb), 0.075), transparent 62%),
    radial-gradient(900px 420px at 100% -16%, rgba(var(--care-violet-rgb), 0.075), transparent 60%),
    linear-gradient(180deg, #f7f8fc 0%, #f2f4f9 100%);

  font-family: "Inter Variable", "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system,
    "Helvetica Neue", Roboto, sans-serif;
  font-optical-sizing: auto;
  font-feature-settings: "cv01", "cv11", "ss03";
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  border: 1px solid var(--sd-border);
  border-radius: var(--sd-radius);
  background: var(--sd-bg);
  box-shadow: var(--sd-shadow);
}

[data-bs-theme="dark"] .sessions-dashboard {
  --sd-border: rgba(255, 255, 255, 0.08);
  --sd-shadow: 0 1px 0 rgba(255, 255, 255, 0.03) inset, 0 12px 32px -16px rgba(0, 0, 0, 0.7);
  --sd-bg:
    radial-gradient(1100px 360px at 0% -8%, color-mix(in srgb, var(--care-accent) 8%, transparent), transparent 62%),
    radial-gradient(900px 420px at 100% -16%, rgba(var(--care-violet-rgb), 0.09), transparent 60%),
    color-mix(in srgb, var(--bs-body-bg) 90%, #000000 10%);
}

.sessions-dashboard :deep(.card-header) {
  padding: 1.15rem 1.35rem 0.4rem;
  background: transparent;
  border-bottom: 0;
}

.sessions-dashboard :deep(.card-header .card-title) {
  margin: 0;
}

.sessions-dashboard :deep(.card-body) {
  padding: 0.85rem 1.35rem 1.35rem;
  background: transparent;
}

.sessions-title {
  font-size: 1.35rem;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--bs-emphasis-color);
}

/* ---------- Page + tokens shared by the cards ---------- */

.sessions-page {
  --sc-radius: 14px;
  --sc-surface: var(--bs-body-bg);
  --sc-surface-raised: var(--bs-tertiary-bg);
  --sc-border: var(--bs-border-color-translucent);
  --sc-text: var(--bs-emphasis-color);
  --sc-muted: var(--bs-secondary-color);
  --sc-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06);
  --sc-shadow-hover: 0 10px 28px -12px rgba(15, 23, 42, 0.22), 0 4px 10px -4px rgba(15, 23, 42, 0.08);
  --sc-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --sc-font-mono: "JetBrains Mono Variable", var(--bs-font-monospace);

  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

[data-bs-theme="dark"] .sessions-page {
  --sc-surface: color-mix(in srgb, var(--bs-body-bg) 95%, #ffffff 5%);
  --sc-surface-raised: color-mix(in srgb, var(--bs-body-bg) 91%, #ffffff 9%);
  --sc-border: rgba(255, 255, 255, 0.08);
  --sc-shadow: 0 1px 0 rgba(255, 255, 255, 0.03) inset, 0 1px 2px rgba(0, 0, 0, 0.4);
  --sc-shadow-hover: 0 1px 0 rgba(255, 255, 255, 0.05) inset, 0 16px 36px -14px rgba(0, 0, 0, 0.7);
}

/* ---------- Sections ---------- */

.sessions-section-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.85rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid var(--sc-border);
}

.sessions-section-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 650;
  letter-spacing: -0.012em;
  color: var(--sc-text);
}

.sessions-count {
  min-width: 1.5rem;
  padding: 0.05rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: var(--sc-muted);
  background: rgba(var(--bs-secondary-rgb), 0.12);
  border: 1px solid var(--sc-border);
  border-radius: 999px;
}

.sessions-empty {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 1rem 1.15rem;
  color: var(--sc-muted);
  background: var(--sc-surface);
  border: 1px dashed var(--sc-border);
  border-radius: var(--sc-radius);
}

.sessions-empty p {
  margin: 0;
  font-size: 0.9rem;
}

.sessions-empty-icon {
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  width: 2.5rem;
  height: 2.5rem;
  color: var(--care-primary);
  background: color-mix(in srgb, var(--care-primary) 12%, transparent);
  border-radius: 12px;
}

/* A page request is visibly slow: dim the current cards until it answers */
.sessions-grid.is-refreshing {
  opacity: 0.55;
  filter: saturate(0.7);
  pointer-events: none;
}

.sessions-grid {
  transition: opacity 0.3s ease, filter 0.3s ease;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: 1rem;
  align-items: start;
}

/* ---------- Study card ---------- */

.session-study {
  --sc-accent: var(--bs-secondary);
  --sc-accent-rgb: var(--bs-secondary-rgb);

  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 0;
  padding: 0.85rem 1rem 0.75rem;
  overflow: hidden;
  isolation: isolate;
  background: var(--sc-surface);
  border: 1px solid var(--sc-border);
  border-radius: var(--sc-radius);
  box-shadow: var(--sc-shadow);
  animation: session-card-in 0.5s var(--sc-ease) both;
  animation-delay: calc(min(var(--i, 0), 12) * 35ms);
  transition: transform 0.35s var(--sc-ease), box-shadow 0.35s var(--sc-ease), border-color 0.35s var(--sc-ease);
}

.session-study::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 4.5rem;
  background: radial-gradient(120% 100% at 0% 0%, rgba(var(--sc-accent-rgb), 0.11), transparent 70%);
  pointer-events: none;
  z-index: -1;
  opacity: 0.8;
}

.session-study::after {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--sc-accent);
  opacity: 0.85;
}

.session-study:hover {
  transform: translateY(-3px);
  box-shadow: var(--sc-shadow-hover);
  border-color: rgba(var(--sc-accent-rgb), 0.35);
}

.session-study--running { --sc-accent: var(--bs-success); --sc-accent-rgb: var(--bs-success-rgb); }
.session-study--ended { --sc-accent: var(--bs-danger); --sc-accent-rgb: var(--bs-danger-rgb); }
.session-study--closed { --sc-accent: rgb(111, 92, 230); --sc-accent-rgb: 111, 92, 230; }

[data-bs-theme="dark"] .session-study--closed {
  --sc-accent: rgb(167, 151, 255);
  --sc-accent-rgb: 167, 151, 255;
}

/* Closed = sealed: violet wash with a faint hatch, like on the Studies dashboard */
.session-study--closed::before {
  background:
    repeating-linear-gradient(-45deg, rgba(var(--sc-accent-rgb), 0.07) 0 1px, transparent 1px 9px),
    radial-gradient(120% 100% at 0% 0%, rgba(var(--sc-accent-rgb), 0.16), transparent 70%);
  -webkit-mask-image: linear-gradient(180deg, #000 30%, transparent);
  mask-image: linear-gradient(180deg, #000 30%, transparent);
}

.session-study--closed::after {
  background: linear-gradient(180deg, rgb(var(--sc-accent-rgb)), rgba(var(--sc-accent-rgb), 0.25));
}

.session-study--ended .session-study-title {
  color: var(--sc-muted);
}

.session-study-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.study-state {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.6rem 0.2rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--sc-accent);
  background: rgba(var(--sc-accent-rgb), 0.12);
  border: 1px solid rgba(var(--sc-accent-rgb), 0.22);
  border-radius: 999px;
}

.study-state-dot {
  position: relative;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.study-state--running .study-state-dot::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: currentColor;
  animation: session-pulse 2.2s ease-out infinite;
}

.session-study-id {
  font-family: var(--sc-font-mono);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--sc-muted);
  opacity: 0.8;
}

.session-study-title {
  display: block;
  max-width: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-size: 1.02rem;
  font-weight: 650;
  line-height: 1.3;
  letter-spacing: -0.012em;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--sc-text);
  background: none;
  border: 0;
  cursor: pointer;
  transition: color 0.2s ease;
}

.session-study-title:hover {
  color: var(--care-primary);
}

.session-study-title:focus-visible,
.session-study-toggle:focus-visible {
  outline: 2px solid rgba(var(--bs-primary-rgb), 0.5);
  outline-offset: 3px;
  border-radius: 6px;
}

[data-bs-theme="dark"] .session-study-title:focus-visible,
[data-bs-theme="dark"] .session-study-toggle:focus-visible {
  outline-color: var(--care-accent);
}

.session-study-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.9rem;
  margin-top: -0.3rem;
  font-size: 0.78rem;
  color: var(--sc-muted);
}

.session-study-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
}

.session-study-progress {
  padding: 0.5rem 0.7rem 0.55rem;
  background: var(--sc-surface-raised);
  border: 1px solid var(--sc-border);
  border-radius: 10px;
}

.session-study-progress-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.3rem;
}

.session-study-progress-label {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--sc-muted);
}

.session-study-progress-count {
  font-variant-numeric: tabular-nums;
  color: var(--sc-text);
}

.session-study-progress-count strong {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.session-study-progress-sub {
  margin-left: 0.35rem;
  font-size: 0.78rem;
  color: var(--sc-muted);
}

.session-study-bar {
  position: relative;
  height: 5px;
  overflow: hidden;
  background: rgba(var(--bs-secondary-rgb), 0.15);
  border-radius: 999px;
}

.session-study-bar-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: linear-gradient(90deg, rgba(var(--sc-accent-rgb), 0.65), var(--sc-accent));
  border-radius: inherit;
  transition: width 0.8s var(--sc-ease);
}

.session-study-timeline {
  --tl-rgb: var(--bs-secondary-rgb);
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  padding: 0.3rem 0.55rem;
  font-size: 0.76rem;
  font-weight: 500;
  color: var(--sc-muted);
  background: rgba(var(--tl-rgb), 0.07);
  border: 1px solid rgba(var(--tl-rgb), 0.14);
  border-radius: 8px;
  cursor: default;
}

.session-study-timeline :deep(svg) {
  flex: 0 0 auto;
  color: rgb(var(--tl-rgb));
}

.session-study-timeline-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-study-timeline-relative {
  flex: 0 0 auto;
  margin-left: auto;
  padding-left: 0.4rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: rgb(var(--tl-rgb));
}

.session-study-timeline--running { --tl-rgb: var(--bs-success-rgb); color: var(--sc-text); }
.session-study-timeline--muted { --tl-rgb: var(--bs-secondary-rgb); }

/* Closing within three days: amber, with a slow breathing glow */
.session-study-timeline--soon {
  --tl-rgb: var(--bs-warning-rgb);
  color: var(--sc-text);
  animation: session-soon 2.8s ease-in-out infinite;
}

.session-study-foot {
  display: flex;
  align-items: center;
  margin-top: auto;
  padding-top: 0.65rem;
  border-top: 1px solid var(--sc-border);
}

.session-study-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.38rem 0.85rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--care-on-primary);
  background: var(--care-primary);
  border: 0;
  border-radius: 8px;
  box-shadow:
    0 1px 2px color-mix(in srgb, var(--care-primary) 30%, transparent),
    0 4px 12px -4px color-mix(in srgb, var(--care-primary) 50%, transparent);
  transition: transform 0.2s var(--sc-ease), box-shadow 0.2s ease, filter 0.2s ease, background-color 0.2s ease;
}

.session-study-toggle:hover {
  filter: brightness(1.08);
}

[data-bs-theme="dark"] .session-study-toggle:hover {
  filter: none;
  background: var(--care-accent-hover);
}

.session-study-toggle:active {
  transform: scale(0.97);
}

.session-study-chevron {
  transition: transform 0.3s var(--sc-ease);
}

.session-study.is-open .session-study-chevron {
  transform: rotate(180deg);
}

/* ---------- Sessions panel (own grid row under the open card's row) ---------- */

.session-panel {
  --sc-accent: var(--bs-success);
  --sc-accent-rgb: var(--bs-success-rgb);

  position: relative;
  grid-column: 1 / -1;
  padding: 0.85rem 1rem 0.5rem;
  background: var(--sc-surface);
  border: 1px solid rgba(var(--sc-accent-rgb), 0.3);
  border-radius: var(--sc-radius);
  box-shadow: var(--sc-shadow-hover);
  animation: session-panel-in 0.35s var(--sc-ease) both;
}

.session-panel--ended { --sc-accent: var(--bs-danger); --sc-accent-rgb: var(--bs-danger-rgb); }
.session-panel--closed { --sc-accent: rgb(111, 92, 230); --sc-accent-rgb: 111, 92, 230; }

[data-bs-theme="dark"] .session-panel--closed {
  --sc-accent: rgb(167, 151, 255);
  --sc-accent-rgb: 167, 151, 255;
}

/* Notch pointing up at the open card */
.session-panel::before {
  content: "";
  position: absolute;
  top: -7px;
  left: var(--notch-left, 50%);
  width: 12px;
  height: 12px;
  background: var(--sc-surface);
  border-top: 1px solid rgba(var(--sc-accent-rgb), 0.3);
  border-left: 1px solid rgba(var(--sc-accent-rgb), 0.3);
  transform: translateX(-50%) rotate(45deg);
  transition: left 0.3s var(--sc-ease);
}

.session-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.65rem;
}

.session-panel-title {
  min-width: 0;
  overflow: hidden;
  font-size: 0.9rem;
  font-weight: 650;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--sc-text);
}

.session-panel-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 1.8rem;
  height: 1.8rem;
  padding: 0;
  color: var(--sc-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
}

.session-panel-close:hover {
  color: var(--sc-text);
  background: rgba(var(--bs-secondary-rgb), 0.12);
  border-color: var(--sc-border);
}

.session-panel-close:focus-visible {
  outline: 2px solid rgba(var(--bs-primary-rgb), 0.5);
  outline-offset: 2px;
}

[data-bs-theme="dark"] .session-panel-close:focus-visible {
  outline-color: var(--care-accent);
}

/* The open card is marked, not moved */
.session-study.is-open {
  border-color: rgba(var(--sc-accent-rgb), 0.45);
  box-shadow: 0 0 0 1px rgba(var(--sc-accent-rgb), 0.25), var(--sc-shadow);
}

@keyframes session-panel-in {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: none; }
}

@keyframes session-card-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}

@keyframes session-pulse {
  0% { transform: scale(1); opacity: 0.55; }
  70%, 100% { transform: scale(2.6); opacity: 0; }
}

@keyframes session-soon {
  0%, 100% { box-shadow: 0 0 0 0 rgba(var(--bs-warning-rgb), 0); }
  50% { box-shadow: 0 0 0 3px rgba(var(--bs-warning-rgb), 0.18); }
}

@media (prefers-reduced-motion: reduce) {
  .session-study,
  .session-study:hover {
    animation: none;
    transform: none;
    transition: none;
  }

  .session-study-chevron,
  .session-study-bar-fill,
  .session-panel::before,
  .sessions-grid {
    transition: none;
  }

  .session-panel {
    animation: none;
  }

  .study-state--running .study-state-dot::after,
  .session-study-timeline--soon {
    animation: none;
  }
}
</style>
