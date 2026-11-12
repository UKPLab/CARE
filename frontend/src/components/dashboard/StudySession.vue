<template>
  <Card
    class="dashboard-page"
    :title="$t('studies.dashboard.title')"
  >
    <template #body>
      <div
        ref="page"
        class="sessions-page"
      >
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
            class="status-card-grid"
            :class="{ 'is-refreshing': cards.loadingVisible }"
          >
            <template
              v-for="(study, index) in cards.rows"
              :key="study.id"
            >
            <StatusCard
              v-bind="study.cardStatus"
              :index="index"
              :item-id="study.id"
              :title="study.displayName"
              title-clickable
              :expanded="isOpen(study.id)"
              :controls="'sessions-of-' + study.id"
              :meta="metaItems(study)"
              :progress="progressOf(study)"
              :timeline="timeline(study)"
              @title-click="toggle(study.id)"
            >
              <template #footer>
                <BasicButton
                  class="status-card-primary"
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
                    class="status-card-chevron"
                    icon-name="chevron-down"
                    :size="13"
                  />
                </BasicButton>
              </template>
            </StatusCard>

            <!-- Sessions panel: its own full-width grid row right after the row of the open
                 card, so the card itself stays where it is. Not keyed by study: switching
                 within one row reuses the panel (the notch slides over); a panel that
                 appears in or leaves a row unfolds / collapses (animatePanel). -->
            <Transition
              :css="false"
              @enter="panelEnter"
              @enter-cancelled="panelPause"
              @leave="panelLeave"
              @after-leave="panelStop"
            >
            <div
              v-if="openStudyId !== null && index === panelAfterIndex(section.key, cards.rows)"
              :id="'sessions-of-' + openStudyId"
              class="session-panel"
              :class="'session-panel--' + openStudy(cards.rows).cardStatus.tone"
              :style="{ '--notch-left': notchLeft(section.key, cards.rows) }"
              role="region"
              :aria-label="openStudy(cards.rows).displayName"
            >
              <header class="session-panel-head">
                <span class="session-panel-title">{{ openStudy(cards.rows).displayName }}</span>
                <BasicButton
                  class="btn-icon btn-sm"
                  :title="$t('studies.dashboard.hideSessions')"
                  :aria-label="$t('studies.dashboard.hideSessions')"
                  @click="toggle(openStudyId)"
                >
                  <LoadIcon
                    icon-name="x-lg"
                    :size="13"
                  />
                </BasicButton>
              </header>
              <StudySessionCards
                :key="openStudyId"
                :study="openStudy(cards.rows)"
                :show-closed="section.closed"
                @action="onSessionAction"
              />
            </div>
            </Transition>
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
import Card from "@/basic/dashboard/card/Card.vue";
import BackendTable from "@/basic/BackendTable.vue";
import BasicButton from "@/basic/Button.vue";
import LoadIcon from "@/basic/Icon.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import Timer from "@/basic/Timer.vue";
import AssignUserModal from "@/components/dashboard/study/AssignUserStudySessionModal.vue";
import StudySessionCards from "@/components/dashboard/study/StudySessionCards.vue";
import StatusCard from "@/basic/dashboard/card/StatusCard.vue";
import { confirmSoftDelete } from "@/basic/dashboard/actions.js";
import { NUMERIC_OPERATORS } from "@/basic/table/searchTokens.js";
import {
  buildStudyTimeline,
  formatStudyCardDate,
  isStudyOpen,
  studyCardStatus,
  studyState,
  timeLeftFormatter,
} from "@/components/dashboard/study/studyCardHelpers.js";

/** Length of a full unfold (open) and fold (close) of the sessions panel (animatePanel). */
const PANEL_OPEN_MS = 300;
const PANEL_CLOSE_MS = 380;

/**
 * Inline styles animatePanel puts on a panel; cleared again by panelStop. `animation: none`
 * stays: clearing it would replay the CSS entry animation of .session-panel once unfolded.
 */
const PANEL_ANIM_STYLES = [
  "position", "top", "left", "width", "margin", "pointerEvents", "opacity", "clipPath",
];

/** Slow start and slow end: no visible kick when the panel starts or stops moving. */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

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
  components: { Card, BackendTable, BasicButton, LoadIcon, ConfirmModal, AssignUserModal, StudySessionCards, StatusCard, Timer },
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
  mounted() {
    // Set by toggle(): the clicked card that a collapsing panel must not move on screen.
    this.scrollAnchor = null;
    ["wheel", "touchmove", "keydown"].forEach((type) =>
      window.addEventListener(type, this.releaseScrollAnchor, { passive: true })
    );
  },
  beforeUnmount() {
    ["wheel", "touchmove", "keydown"].forEach((type) =>
      window.removeEventListener(type, this.releaseScrollAnchor)
    );
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
      return isStudyOpen(row) === closedSection ? false : undefined;
    },
    /**
     * Adds what a card shows (name, author, state) to a study row.
     * @param {Object} row raw study row
     * @returns {Object}
     */
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
      const state = studyState(study);
      study.stateSlug = state === "open" ? "running" : state;
      // StatusCard status props (tone, label, lock, pulse); the sessions panel uses the tone too.
      study.cardStatus = studyCardStatus(study.stateSlug, (...args) => this.$t(...args));
      return study;
    },
    metaItems(study) {
      const items = [];
      if (study.author) {
        items.push({ key: "author", icon: "person", text: study.author });
      }
      if (study.createdAt) {
        items.push({
          key: "created",
          icon: "calendar3",
          text: formatStudyCardDate(study.createdAt),
          title: this.$t("studies.columns.created"),
        });
      }
      return items;
    },
    /** The viewer's own sessions in this study (study injects mySessions / mySessionsFinished). */
    progressOf(study) {
      return {
        label: this.$t("studies.columns.sessions"),
        value: study.mySessionCount,
        suffix: this.$t("studies.dashboard.finishedCount", { count: study.myFinishedCount }),
        percent: study.myFinishedPercent,
      };
    },
    isOpen(id) {
      return this.openStudyId === id;
    },
    /**
     * Opening one study closes the panel of any other. When that panel sat above the clicked
     * card, removing it would pull the page up under the cursor; the scroll position is
     * corrected in the same frame so the clicked card stays where it was on screen.
     */
    toggle(id) {
      const card = this.cardElement(id);
      this.scrollAnchor = card
        ? { card, top: card.getBoundingClientRect().top, scroller: this.scrollParent(card) }
        : null;
      this.openStudyId = this.openStudyId === id ? null : id;
      // Vue patches the DOM (and starts panelLeave) before this callback and the browser
      // paints after it, so the first shift and its correction land in one frame.
      this.$nextTick(() => this.keepScrollAnchor());
    },
    /** Scroll by however far the clicked card has moved, so it stays put on screen. */
    keepScrollAnchor() {
      const anchor = this.scrollAnchor;
      if (!anchor || !anchor.card.isConnected) return;
      const shift = anchor.card.getBoundingClientRect().top - anchor.top;
      if (Math.abs(shift) < 0.5) return;
      anchor.scroller.scrollTo({ top: anchor.scroller.scrollTop + shift, behavior: "instant" });
    },
    /** The user scrolls on their own: stop holding the card in place. */
    releaseScrollAnchor() {
      this.scrollAnchor = null;
    },
    /** A panel appears in a row: unfold it (animatePanel). */
    panelEnter(el, done) {
      this.animatePanel(el, 1, done);
    },
    /** A panel leaves its row: fold it away (animatePanel). */
    panelLeave(el, done) {
      this.animatePanel(el, 0, done);
    },
    /** Closed while still unfolding: freeze it, panelLeave folds it back from there. */
    panelPause(el) {
      if (el._panelAnim) cancelAnimationFrame(el._panelAnim.raf);
    },
    /** Puts the panel back into the grid flow and drops every animation style. */
    panelStop(el) {
      const state = el._panelAnim;
      if (!state) return;
      cancelAnimationFrame(state.raf);
      state.prev.style.marginBottom = "";
      PANEL_ANIM_STYLES.forEach((prop) => { el.style[prop] = ""; });
      delete el._panelAnim;
    },
    /**
     * Unfolds (target 1) or folds (target 0) a sessions panel.
     *
     * A grid row keeps its gap while it exists, so growing or shrinking the panel itself would
     * jump by one gap when the row appears or goes. Instead, while animating, the panel sits out
     * of the grid flow (absolute, at its own place) and its row (height + gap) is stood in for by
     * a margin-bottom on the card right before it. That margin runs between 0 and the full row,
     * so the layout matches "no panel" at 0 and "panel in flow" at 1 exactly; the panel fades and
     * clips along with it. Driven per frame from JS so the scroll correction (keepScrollAnchor)
     * lands in the same frame as the layout change, never one behind.
     */
    animatePanel(el, target, done) {
      let state = el._panelAnim;
      if (state) {
        cancelAnimationFrame(state.raf);
      } else {
        const grid = el.parentElement;
        const prev = el.previousElementSibling;
        const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        if (!grid || !prev || reduced) {
          done();
          return;
        }
        // Stop the CSS entry animation first: its translateY would skew the measurement.
        el.style.animation = "none";
        const gridRect = grid.getBoundingClientRect();
        const rect = el.getBoundingClientRect();
        Object.assign(el.style, {
          position: "absolute",
          top: `${rect.top - gridRect.top - grid.clientTop}px`,
          left: `${rect.left - gridRect.left - grid.clientLeft}px`,
          width: `${rect.width}px`,
          margin: "0",
          animation: "none",
          pointerEvents: "none",
        });
        state = { prev, gap: parseFloat(getComputedStyle(grid).rowGap) || 0, p: 1 - target, raf: 0 };
        el._panelAnim = state;
        this.paintPanel(el, state);
      }

      const from = state.p;
      const duration = (target === 1 ? PANEL_OPEN_MS : PANEL_CLOSE_MS) * Math.abs(target - from);
      const start = performance.now();
      const step = (now) => {
        const t = duration > 0 ? Math.min(1, (now - start) / duration) : 1;
        state.p = from + (target - from) * easeInOutCubic(t);
        this.paintPanel(el, state);
        this.keepScrollAnchor();
        if (t < 1) {
          state.raf = requestAnimationFrame(step);
          return;
        }
        // Unfolded: back into the flow, which takes exactly the room the margin held.
        if (target === 1) this.panelStop(el);
        done();
        this.keepScrollAnchor();
      };
      state.raf = requestAnimationFrame(step);
    },
    /** One frame of animatePanel at progress state.p (0 = gone, 1 = fully open). */
    paintPanel(el, state) {
      // Read every frame: the sessions inside may still be loading and change the height.
      const row = el.offsetHeight + state.gap;
      state.prev.style.marginBottom = `${row * state.p}px`;
      el.style.opacity = String(state.p);
      // 20px of slack keeps the notch and shadow visible until the clip reaches them.
      el.style.clipPath = `inset(-20px -20px calc(${1 - state.p} * (100% + 20px)) -20px)`;
    },
    /** The study card with this id, found through its footer button. */
    cardElement(id) {
      return this.$refs.page
        ?.querySelector(`.status-card-primary[aria-controls="sessions-of-${id}"]`)
        ?.closest(".status-card") || null;
    },
    /** Nearest ancestor that scrolls vertically, else the document. */
    scrollParent(el) {
      for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
        const { overflowY } = getComputedStyle(node);
        if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
          return node;
        }
      }
      return document.scrollingElement || document.documentElement;
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
    /**
     * The date line of a card (rules in studyCardHelpers). The time left counts down with
     * the page timer.
     * @returns {{icon: string, tone: string, label: string, relative: string, exact: string}|null}
     */
    timeline(study) {
      this.trigger; // leave here to re-evaluate every timer step
      const t = (...args) => this.$t(...args);
      return buildStudyTimeline(study, study.stateSlug, { t, relative: timeLeftFormatter(t) });
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
   "My Sessions": only what this page adds.
   - Page shell: .dashboard-page in global.css.
   - Sections and empty state: "Sectioned card dashboards" in global.css.
   - Study cards, grid and footer buttons: StatusCard.vue.
   - Colours, shadows, radius: the --care-card-* tokens in global.css.
   ====================================================================== */

/* toggle() keeps the clicked card in place itself; the browser's own scroll
   anchoring must not correct the same shift a second time. */
.sessions-page {
  overflow-anchor: none;
}

/* Containing block for a collapsing panel (panelLeave lifts it out of the flow). */
.status-card-grid {
  position: relative;
}

/* ---------- Sessions panel (own grid row under the open card's row) ---------- */

.session-panel {
  --care-card-accent: var(--bs-success);

  position: relative;
  grid-column: 1 / -1;
  padding: 0.85rem 1rem 0.5rem;
  background: var(--care-card-surface);
  border: 1px solid color-mix(in srgb, var(--care-card-accent) 30%, transparent);
  border-radius: var(--care-radius-xl);
  box-shadow: var(--care-card-shadow-hover);
  animation: session-panel-in 0.35s var(--care-ease) both;
}

/* Same colour as the open card (study.cardStatus.tone). */
.session-panel--danger { --care-card-accent: var(--bs-danger); }
.session-panel--violet { --care-card-accent: rgb(var(--care-violet-rgb)); }

/* Notch pointing up at the open card */
.session-panel::before {
  content: "";
  position: absolute;
  top: -7px;
  left: var(--notch-left, 50%);
  width: 12px;
  height: 12px;
  background: var(--care-card-surface);
  border-top: 1px solid color-mix(in srgb, var(--care-card-accent) 30%, transparent);
  border-left: 1px solid color-mix(in srgb, var(--care-card-accent) 30%, transparent);
  transform: translateX(-50%) rotate(45deg);
  transition: left 0.3s var(--care-ease);
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
  color: var(--care-card-text);
}

@keyframes session-panel-in {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .session-panel::before {
    transition: none;
  }

  .session-panel {
    animation: none;
  }
}
</style>
