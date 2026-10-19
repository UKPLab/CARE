<template>
  <div
    class="study-cards"
    :class="{ 'is-refreshing': loadingVisible && rows.length > 0 }"
    :aria-busy="loading"
  >
    <div
      class="study-cards-progress"
      aria-hidden="true"
    />

    <!-- Skeletons for the first load only: refining a search with no hits keeps the empty state. -->
    <div
      v-if="loading && rows.length === 0 && !searching"
      class="study-cards-grid"
    >
      <div
        v-for="n in skeletonCount"
        :key="'skeleton-' + n"
        class="study-card study-card--skeleton"
        :style="{ '--i': n - 1 }"
        aria-hidden="true"
      >
        <div class="skeleton-line skeleton-line--pill" />
        <div class="skeleton-line skeleton-line--title" />
        <div class="skeleton-line skeleton-line--meta" />
        <div class="skeleton-line skeleton-line--block" />
        <div class="skeleton-line skeleton-line--footer" />
      </div>
    </div>

    <div
      v-else-if="rows.length === 0 && total > 0"
      class="study-cards-empty study-cards-empty--loading"
    >
      {{ $t('common.loadingFromServer') }}
    </div>

    <div
      v-else-if="rows.length === 0"
      class="study-cards-empty"
    >
      <StudyEmptyState
        :searching="searching"
        :search-text="searchText"
        :can-create="!!onCreate"
        @clear="clearSearch && clearSearch()"
        @create="onCreate && onCreate()"
      />
    </div>

    <div
      v-else
      class="study-cards-grid"
    >
      <article
        v-for="(row, index) in rows"
        :key="row.__sid || row.id"
        class="study-card"
        :class="cardClass(row)"
        :style="{ '--i': index }"
      >
        <header class="study-card-head">
          <span
            class="study-state"
            :class="'study-state--' + stateSlug(row.state)"
          >
            <LoadIcon
              v-if="row.state === 'closed'"
              class="study-state-lock"
              icon-name="lock-fill"
              :size="10"
            />
            <span
              v-else
              class="study-state-dot"
            />
            {{ stateLabel(row.state) }}
          </span>
          <span class="study-card-head-end">
            <span
              v-for="f in features(row)"
              :key="f.key"
              class="study-feature"
              :title="f.label"
              :aria-label="f.label"
            >
              <LoadIcon
                :icon-name="f.icon"
                :size="12"
              />
            </span>
            <span class="study-card-id">#{{ row.id }}</span>
          </span>
        </header>

        <component
          :is="openButton(row) ? 'button' : 'h3'"
          class="study-card-title"
          :type="openButton(row) ? 'button' : null"
          :title="row.name || $t('studies.dashboard.noName')"
          @click="openButton(row) && emitAction(openButton(row), row)"
        >
          {{ row.name || $t('studies.dashboard.noName') }}
        </component>

        <div class="study-card-meta">
          <span
            v-if="row.createdAt"
            class="study-card-meta-item"
            :title="$t('studies.columns.created')"
          >
            <LoadIcon
              icon-name="calendar3"
              :size="12"
            />
            {{ formatDate(row.createdAt) }}
          </span>
          <span
            v-if="ownerName(row)"
            class="study-card-meta-item"
          >
            <LoadIcon
              icon-name="person"
              :size="12"
            />
            {{ ownerName(row) }}
          </span>
        </div>

        <div class="study-card-sessions">
          <div class="study-card-sessions-head">
            <span class="study-card-sessions-label">{{ $t('studies.columns.sessions') }}</span>
            <span class="study-card-sessions-count">
              <strong>{{ sessionCount(row) }}</strong>
              <span class="study-card-sessions-limit">
                / {{ hasLimit(row) ? row.limitSessions : '∞' }}
              </span>
            </span>
          </div>
          <div
            class="study-card-bar"
            :class="{ 'study-card-bar--open': !hasLimit(row) }"
          >
            <span
              class="study-card-bar-fill"
              :style="{ width: sessionFill(row) + '%' }"
            />
          </div>
          <div
            v-if="Number(row.limitSessionsPerUser) > 0"
            class="study-card-sessions-hint"
            :title="$t('studies.fields.limitSessionsPerUser.help')"
          >
            <LoadIcon
              icon-name="person"
              :size="11"
            />
            {{ $t('studies.cards.perUser', { limit: row.limitSessionsPerUser }, Number(row.limitSessionsPerUser)) }}
          </div>
        </div>

        <div
          v-if="timeline(row)"
          class="study-card-timeline"
          :class="'study-card-timeline--' + timeline(row).tone"
          :title="timeline(row).exact"
        >
          <LoadIcon
            :icon-name="timeline(row).icon"
            :size="13"
          />
          <span class="study-card-timeline-label">{{ timeline(row).label }}</span>
          <span
            v-if="timeline(row).relative"
            class="study-card-timeline-relative"
          >{{ timeline(row).relative }}</span>
        </div>

        <footer class="study-card-foot">
          <button
            v-if="openButton(row)"
            type="button"
            class="study-card-open"
            :title="openButton(row).title"
            @click="emitAction(openButton(row), row)"
          >
            {{ $t('studies.cards.open') }}
            <LoadIcon
              icon-name="arrow-right"
              :size="14"
            />
          </button>
          <div class="study-card-actions">
            <button
              v-for="b in actionLayout(row).inline"
              :key="b.action"
              type="button"
              class="study-card-action"
              :class="{ 'study-card-action--danger': isDanger(b) }"
              :title="b.title"
              :aria-label="b.title"
              @click="emitAction(b, row)"
            >
              <LoadIcon
                :icon-name="b.icon"
                :size="15"
              />
            </button>
            <button
              v-if="actionLayout(row).menu.length > 0"
              type="button"
              class="study-card-action study-card-action--more"
              :class="{ 'is-open': menu.rowId === row.id }"
              :title="$t('studies.cards.moreActions')"
              :aria-label="$t('studies.cards.moreActions')"
              aria-haspopup="menu"
              :aria-expanded="menu.rowId === row.id"
              @click.stop="toggleMenu($event, row)"
            >
              <LoadIcon
                icon-name="three-dots"
                :size="16"
              />
            </button>
          </div>
        </footer>
      </article>
    </div>

    <!-- Teleported: the card clips its overflow for the rounded accent wash. -->
    <Teleport to="body">
      <Transition name="sc-menu">
        <div
          v-if="menuRow"
          ref="menu"
          class="study-card-menu"
          :class="{ 'study-card-menu--up': menu.up }"
          :style="{ top: menu.top + 'px', left: menu.left + 'px' }"
          role="menu"
          @keydown.esc.prevent="closeMenu(true)"
        >
          <template
            v-for="(b, index) in actionLayout(menuRow).menu"
            :key="b.action"
          >
            <div
              v-if="isDanger(b) && index > 0 && !isDanger(actionLayout(menuRow).menu[index - 1])"
              class="study-card-menu-divider"
              role="separator"
            />
            <button
              type="button"
              role="menuitem"
              class="study-card-menu-item"
              :class="{ 'study-card-menu-item--danger': isDanger(b) }"
              @click="emitMenuAction(b)"
            >
              <LoadIcon
                :icon-name="b.icon"
                :size="15"
              />
              <span>{{ b.title }}</span>
            </button>
          </template>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script>
// Self-hosted (bundled by Vite, no third-party font CDN), SIL Open Font License 1.1.
import "@fontsource-variable/inter/opsz.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
import LoadIcon from "@/basic/Icon.vue";
import StudyEmptyState from "./StudyEmptyState.vue";
import { formatLocalizedDate, formatLocalizedDateTime } from "@/assets/utils";

/** Under this much time left, the close date turns amber. */
const SOON_MS = 3 * 24 * 60 * 60 * 1000;

const STATE_SLUGS = {
  "not started": "pending",
  running: "running",
  closed: "closed",
  ended: "ended",
};

/** Icons kept in the card footer when the row has more actions than fit. */
const INLINE_ACTION_ORDER = ["editStudy", "copyStudyLink", "inspectStudySessions", "showInformation"];
/** Never promoted to an inline icon; always behind "more". */
const MENU_ONLY_ACTIONS = ["restartStudy"];
const MAX_INLINE_ACTIONS = 3;

const STATE_LABEL_KEYS = {
  "not started": "studies.status.notStarted",
  running: "studies.status.running",
  closed: "studies.status.closed",
  ended: "studies.status.ended",
};

/**
 * Card body for the Studies dashboard, rendered in BackendTable's `#cards` slot.
 * Reads the same enriched rows and row buttons as the table; actions go back through
 * the table's emitter, so Study.vue handles them exactly like a table click.
 *
 * @author Andrii Nikitin
 */
export default {
  name: "StudyCardGrid",
  components: { LoadIcon, StudyEmptyState },
  props: {
    rows: {
      type: Array,
      required: true,
    },
    total: {
      type: Number,
      required: false,
      default: 0,
    },
    /** A request is in flight (skeletons when nothing is loaded yet). */
    loading: {
      type: Boolean,
      required: false,
      default: false,
    },
    /** A request has been running long enough to show (dims the current cards). */
    loadingVisible: {
      type: Boolean,
      required: false,
      default: false,
    },
    rowButtons: {
      type: Function,
      required: true,
    },
    rowState: {
      type: Function,
      required: false,
      default: () => ({}),
    },
    onAction: {
      type: Function,
      required: true,
    },
    showOwner: {
      type: Boolean,
      required: false,
      default: false,
    },
    /** The search bar narrows the query; the empty state then talks about the search. */
    searching: {
      type: Boolean,
      required: false,
      default: false,
    },
    searchText: {
      type: String,
      required: false,
      default: "",
    },
    clearSearch: {
      type: Function,
      required: false,
      default: null,
    },
    /** Opens study creation from the empty state; no button without it. */
    onCreate: {
      type: Function,
      required: false,
      default: null,
    },
  },
  data() {
    return {
      skeletonCount: 6,
      menu: { rowId: null, top: 0, left: 0, up: false, trigger: null },
    };
  },
  computed: {
    /** Date line per row id, built once per render of the page. */
    timelines() {
      const map = {};
      for (const row of this.rows) map[row.id] = this.buildTimeline(row);
      return map;
    },
    relativeFormat() {
      try {
        return new Intl.RelativeTimeFormat(this.$i18n?.locale || undefined, { numeric: "auto" });
      } catch (_error) {
        return null;
      }
    },
    /** Live row behind the open menu; null once it leaves the page (closes the menu). */
    menuRow() {
      if (this.menu.rowId == null) return null;
      return this.rows.find((r) => r.id === this.menu.rowId) || null;
    },
  },
  watch: {
    menuRow(row) {
      if (!row && this.menu.rowId != null) this.closeMenu();
    },
  },
  beforeUnmount() {
    this.unbindMenuListeners();
  },
  methods: {
    stateSlug(state) {
      return STATE_SLUGS[state] || "closed";
    },
    stateLabel(state) {
      const key = STATE_LABEL_KEYS[state];
      return key ? this.$t(key) : state || "";
    },
    cardClass(row) {
      const s = this.rowState(row) || {};
      return {
        ["study-card--" + this.stateSlug(row.state)]: true,
        "study-card--deleting": s.deleting,
        "study-card--placeholder": s.placeholder,
        "study-card--updated": s.updated,
        "study-card--entering": s.entering,
      };
    },
    formatDate(value) {
      return formatLocalizedDate(value, { day: "2-digit", month: "short", year: "numeric" });
    },
    timeline(row) {
      return this.timelines[row.id] || null;
    },
    /**
     * When the study opens or stops taking new sessions, from the same start / end the
     * state badge is derived from (enrichStudyRow).
     * @returns {{icon: string, tone: string, label: string, relative: string, exact: string}|null}
     */
    buildTimeline(row) {
      const start = this.toTime(row.start);
      const end = this.toTime(row.end);
      const now = Date.now();
      const entry = (icon, tone, key, time, relative = true) => ({
        icon,
        tone,
        label: this.$t(key, { date: this.formatDate(time) }),
        relative: relative ? this.formatRelative(time - now) : "",
        exact: formatLocalizedDateTime(time),
      });

      if (row.state === "not started" && start) {
        return entry("hourglass-split", "pending", "studies.cards.opensOn", start);
      }
      if (row.state === "running") {
        if (!end) {
          return { icon: "infinity", tone: "muted", label: this.$t("studies.cards.noEndDate"), relative: "", exact: "" };
        }
        if (end > now) {
          const soon = end - now <= SOON_MS;
          return entry(soon ? "alarm" : "calendar-event", soon ? "soon" : "running", "studies.cards.closesOn", end);
        }
        // Past the end but still running: multiple submissions keep existing sessions open.
        return entry("calendar-check", "muted", "studies.cards.noNewSessionsSince", end, false);
      }
      if (row.state === "ended" && end) {
        return entry("calendar-check", "muted", "studies.cards.endedOn", end, false);
      }
      return null;
    },
    toTime(value) {
      if (value === null || value === undefined || value === "") return null;
      const time = new Date(value).getTime();
      return Number.isNaN(time) ? null : time;
    },
    formatRelative(diffMs) {
      if (!this.relativeFormat) return "";
      const minutes = Math.round(diffMs / 60000);
      const hours = Math.round(diffMs / 3600000);
      const days = Math.round(diffMs / 86400000);
      if (Math.abs(minutes) < 60) return this.relativeFormat.format(minutes, "minute");
      if (Math.abs(hours) < 24) return this.relativeFormat.format(hours, "hour");
      if (Math.abs(days) < 60) return this.relativeFormat.format(days, "day");
      return this.relativeFormat.format(Math.round(days / 30), "month");
    },
    ownerName(row) {
      if (!this.showOwner) return "";
      return [row.firstName, row.lastName].filter(Boolean).join(" ");
    },
    sessionCount(row) {
      return Number(row.sessions) || 0;
    },
    hasLimit(row) {
      return Number(row.limitSessions) > 0;
    },
    sessionFill(row) {
      const count = this.sessionCount(row);
      if (!this.hasLimit(row)) return count > 0 ? 100 : 0;
      return Math.min(100, Math.round((count / Number(row.limitSessions)) * 100));
    },
    features(row) {
      const all = [
        { key: "collab", icon: "people", label: this.$t("studies.columns.collaborative") },
        { key: "resumable", icon: "arrow-repeat", label: this.$t("studies.columns.resumable") },
        { key: "multipleSubmit", icon: "files", label: this.$t("studies.columns.multipleSubmissions") },
        { key: "enableEmailNotifications", icon: "envelope", label: this.$t("studies.cards.emails") },
      ];
      return all.filter((f) => row[f.key] === true);
    },
    openButton(row) {
      return this.rowButtons(row).find((b) => b.action === "openStudy") || null;
    },
    /**
     * Everyday actions stay as icons; the rest go into the "more" menu so the footer
     * always fits one line. Destructive actions are last in either place.
     * @returns {{inline: Object[], menu: Object[]}}
     */
    actionLayout(row) {
      const buttons = this.rowButtons(row).filter((b) => b.action !== "openStudy");
      const ordered = [
        ...buttons.filter((b) => !this.isDanger(b)),
        ...buttons.filter((b) => this.isDanger(b)),
      ];
      if (ordered.length <= MAX_INLINE_ACTIONS + 1) {
        return { inline: ordered, menu: [] };
      }
      const preferred = INLINE_ACTION_ORDER
        .map((action) => ordered.find((b) => b.action === action))
        .filter(Boolean);
      const fill = ordered.filter((b) => !this.isDanger(b) && !preferred.includes(b)
        && !MENU_ONLY_ACTIONS.includes(b.action));
      const inline = [...preferred, ...fill].slice(0, MAX_INLINE_ACTIONS);
      return { inline, menu: ordered.filter((b) => !inline.includes(b)) };
    },
    toggleMenu(event, row) {
      if (this.menu.rowId === row.id) {
        this.closeMenu();
        return;
      }
      const trigger = event.currentTarget;
      const rect = trigger.getBoundingClientRect();
      // Roughly the height of five items; flip upwards when the card sits near the bottom.
      const up = rect.bottom + 240 > window.innerHeight;
      this.menu = {
        rowId: row.id,
        top: up ? rect.top - 6 : rect.bottom + 6,
        left: rect.right,
        up,
        trigger,
      };
      this.bindMenuListeners();
      this.$nextTick(() => this.$refs.menu?.querySelector("button")?.focus({ preventScroll: true }));
    },
    closeMenu(restoreFocus = false) {
      const trigger = this.menu.trigger;
      this.menu = { rowId: null, top: 0, left: 0, up: false, trigger: null };
      this.unbindMenuListeners();
      if (restoreFocus) trigger?.focus?.({ preventScroll: true });
    },
    emitMenuAction(button) {
      const row = this.menuRow;
      this.closeMenu();
      this.emitAction(button, row);
    },
    bindMenuListeners() {
      this.unbindMenuListeners();
      this._onMenuPointer = (e) => {
        if (this.$refs.menu?.contains(e.target) || this.menu.trigger?.contains(e.target)) return;
        this.closeMenu();
      };
      this._onMenuViewport = () => this.closeMenu();
      document.addEventListener("pointerdown", this._onMenuPointer, true);
      window.addEventListener("scroll", this._onMenuViewport, true);
      window.addEventListener("resize", this._onMenuViewport);
    },
    unbindMenuListeners() {
      if (!this._onMenuPointer) return;
      document.removeEventListener("pointerdown", this._onMenuPointer, true);
      window.removeEventListener("scroll", this._onMenuViewport, true);
      window.removeEventListener("resize", this._onMenuViewport);
      this._onMenuPointer = null;
      this._onMenuViewport = null;
    },
    isDanger(button) {
      return !!button?.options?.specifiers?.["btn-outline-danger"];
    },
    emitAction(button, row) {
      if (!button) return;
      const s = this.rowState(row) || {};
      if (s.deleting || s.placeholder) return;
      this.onAction({ action: button.action, params: row, stats: button.stats });
    },
  },
};
</script>

<style scoped>
.study-cards {
  --sc-radius: 14px;
  --sc-surface: var(--bs-body-bg);
  --sc-surface-raised: var(--bs-tertiary-bg);
  --sc-border: var(--bs-border-color-translucent);
  --sc-text: var(--bs-emphasis-color);
  --sc-muted: var(--bs-secondary-color);
  --sc-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06);
  --sc-shadow-hover: 0 10px 28px -12px rgba(15, 23, 42, 0.22), 0 4px 10px -4px rgba(15, 23, 42, 0.08);
  --sc-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --sc-font: "Inter Variable", "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system,
    "Helvetica Neue", Roboto, sans-serif;
  --sc-font-mono: "JetBrains Mono Variable", var(--bs-font-monospace);

  position: relative;
  font-family: var(--sc-font);
  font-optical-sizing: auto;
  /* Inter: open digits, single-storey a, rounded quotes. */
  font-feature-settings: "cv01", "cv11", "ss03";
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

[data-bs-theme="dark"] .study-cards {
  --sc-surface: color-mix(in srgb, var(--bs-body-bg) 95%, #ffffff 5%);
  --sc-surface-raised: color-mix(in srgb, var(--bs-body-bg) 91%, #ffffff 9%);
  --sc-border: rgba(255, 255, 255, 0.08);
  --sc-shadow: 0 1px 0 rgba(255, 255, 255, 0.03) inset, 0 1px 2px rgba(0, 0, 0, 0.4);
  --sc-shadow-hover: 0 1px 0 rgba(255, 255, 255, 0.05) inset, 0 16px 36px -14px rgba(0, 0, 0, 0.7);
}

/* Thin indeterminate bar while a page request is visibly slow. */
.study-cards-progress {
  position: absolute;
  top: -0.5rem;
  left: 0;
  right: 0;
  height: 2px;
  overflow: hidden;
  border-radius: 2px;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.study-cards-progress::after {
  content: "";
  position: absolute;
  inset: 0;
  width: 35%;
  background: linear-gradient(90deg, transparent, var(--bs-primary), transparent);
  animation: sc-progress 1.1s ease-in-out infinite;
}

.study-cards.is-refreshing .study-cards-progress {
  opacity: 1;
}

.study-cards.is-refreshing .study-cards-grid {
  opacity: 0.55;
  filter: saturate(0.7);
  pointer-events: none;
}

.study-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: 1rem;
  transition: opacity 0.3s ease, filter 0.3s ease;
}

/* ---------- Card ---------- */

.study-card {
  --sc-accent: var(--bs-secondary);
  --sc-accent-rgb: var(--bs-secondary-rgb);

  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 0;
  padding: 0.85rem 1rem 0.75rem;
  background: var(--sc-surface);
  border: 1px solid var(--sc-border);
  border-radius: var(--sc-radius);
  box-shadow: var(--sc-shadow);
  overflow: hidden;
  isolation: isolate;
  animation: sc-card-in 0.5s var(--sc-ease) both;
  animation-delay: calc(min(var(--i, 0), 12) * 35ms);
  transition:
    transform 0.35s var(--sc-ease),
    box-shadow 0.35s var(--sc-ease),
    border-color 0.35s var(--sc-ease),
    opacity 0.4s ease;
}

/* Soft wash of the state colour from the top edge. */
.study-card::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 4.5rem;
  background: radial-gradient(120% 100% at 0% 0%, rgba(var(--sc-accent-rgb), 0.11), transparent 70%);
  pointer-events: none;
  z-index: -1;
  transition: opacity 0.35s ease;
  opacity: 0.8;
}

.study-card::after {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--sc-accent);
  opacity: 0.85;
}

.study-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--sc-shadow-hover);
  border-color: rgba(var(--sc-accent-rgb), 0.35);
}

.study-card:hover::before {
  opacity: 1;
}

.study-card--running { --sc-accent: var(--bs-success); --sc-accent-rgb: var(--bs-success-rgb); }
.study-card--pending { --sc-accent: var(--bs-warning); --sc-accent-rgb: var(--bs-warning-rgb); }
.study-card--closed { --sc-accent: rgb(var(--sc-accent-rgb)); --sc-accent-rgb: 111, 92, 230; }
.study-card--ended { --sc-accent: var(--bs-danger); --sc-accent-rgb: var(--bs-danger-rgb); }

[data-bs-theme="dark"] .study-card--closed { --sc-accent-rgb: 167, 151, 255; }

.study-card--ended .study-card-title {
  color: var(--sc-muted);
}

/* Closed = sealed: violet wash with a faint hatch, a gradient edge, and a lock in the pill. */
.study-card--closed::before {
  background:
    repeating-linear-gradient(
      -45deg,
      rgba(var(--sc-accent-rgb), 0.07) 0 1px,
      transparent 1px 9px
    ),
    radial-gradient(120% 100% at 0% 0%, rgba(var(--sc-accent-rgb), 0.16), transparent 70%);
  -webkit-mask-image: linear-gradient(180deg, #000 30%, transparent);
  mask-image: linear-gradient(180deg, #000 30%, transparent);
}

.study-card--closed::after {
  background: linear-gradient(180deg, rgb(var(--sc-accent-rgb)), rgba(var(--sc-accent-rgb), 0.25));
}

.study-card--closed .study-card-title {
  color: color-mix(in srgb, var(--sc-text) 78%, rgb(var(--sc-accent-rgb)) 22%);
}

.study-card--closed:hover .study-state-lock {
  transform: rotate(-12deg) scale(1.1);
}

/* ---------- Head ---------- */

.study-card-head {
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
  border-radius: 999px;
  color: var(--sc-accent);
  background: rgba(var(--sc-accent-rgb), 0.12);
  border: 1px solid rgba(var(--sc-accent-rgb), 0.22);
}

.study-state--pending {
  color: color-mix(in srgb, var(--bs-warning) 70%, var(--bs-emphasis-color) 30%);
}

.study-state-lock {
  transition: transform 0.35s var(--sc-ease);
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
  animation: sc-pulse 2.2s ease-out infinite;
}

.study-card-id {
  font-family: var(--sc-font-mono);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--sc-muted);
  opacity: 0.8;
}

/* ---------- Title + meta ---------- */

.study-card-title {
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
  font-family: var(--sc-font);
  font-size: 1.02rem;
  font-weight: 650;
  line-height: 1.3;
  letter-spacing: -0.012em;
  color: var(--sc-text);
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: 100%;
}

button.study-card-title {
  cursor: pointer;
  transition: color 0.2s ease;
}

button.study-card-title:hover {
  color: var(--bs-primary);
}

button.study-card-title:focus-visible {
  outline: 2px solid rgba(var(--bs-primary-rgb), 0.5);
  outline-offset: 3px;
  border-radius: 4px;
}

.study-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.9rem;
  margin-top: -0.3rem;
  font-size: 0.78rem;
  color: var(--sc-muted);
}

.study-card-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
}

/* ---------- Sessions ---------- */

.study-card-sessions {
  padding: 0.5rem 0.7rem 0.55rem;
  border-radius: 10px;
  background: var(--sc-surface-raised);
  border: 1px solid var(--sc-border);
}

.study-card-sessions-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.3rem;
}

.study-card-sessions-label {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--sc-muted);
}

.study-card-sessions-count {
  font-variant-numeric: tabular-nums;
  color: var(--sc-text);
}

.study-card-sessions-count strong {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.study-card-sessions-limit {
  font-size: 0.82rem;
  color: var(--sc-muted);
}

.study-card-bar {
  position: relative;
  height: 5px;
  border-radius: 999px;
  background: rgba(var(--bs-secondary-rgb), 0.15);
  overflow: hidden;
}

.study-card-bar-fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(var(--sc-accent-rgb), 0.65), var(--sc-accent));
  transition: width 0.8s var(--sc-ease);
  animation: sc-bar-in 0.9s var(--sc-ease) both;
  animation-delay: calc(min(var(--i, 0), 12) * 35ms + 150ms);
}

/* No limit: a calm striped track instead of a fake percentage. */
.study-card-bar--open .study-card-bar-fill {
  opacity: 0.45;
  background: repeating-linear-gradient(
    -45deg,
    rgba(var(--sc-accent-rgb), 0.55) 0 6px,
    rgba(var(--sc-accent-rgb), 0.25) 6px 12px
  );
}

.study-card-sessions-hint {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.35rem;
  cursor: help;
  font-size: 0.72rem;
  color: var(--sc-muted);
}

/* ---------- Feature icons (header) + date line ---------- */

.study-card-head-end {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  min-width: 0;
}

.study-feature {
  display: inline-grid;
  place-items: center;
  width: 1.4rem;
  height: 1.4rem;
  color: var(--sc-muted);
  border-radius: 6px;
  background: rgba(var(--bs-secondary-rgb), 0.08);
  border: 1px solid var(--sc-border);
  cursor: help;
  transition: color 0.2s ease, background-color 0.2s ease;
}

.study-feature:hover {
  color: var(--sc-accent);
  background: rgba(var(--sc-accent-rgb), 0.12);
}

.study-card-head-end .study-card-id {
  margin-left: 0.3rem;
}

.study-card-timeline {
  --tl-rgb: var(--bs-secondary-rgb);
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  padding: 0.3rem 0.55rem;
  font-size: 0.76rem;
  font-weight: 500;
  color: var(--sc-muted);
  border-radius: 8px;
  background: rgba(var(--tl-rgb), 0.07);
  border: 1px solid rgba(var(--tl-rgb), 0.14);
  cursor: default;
}

.study-card-timeline :deep(svg) {
  flex: 0 0 auto;
  color: rgb(var(--tl-rgb));
}

.study-card-timeline-label {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.study-card-timeline-relative {
  flex: 0 0 auto;
  margin-left: auto;
  padding-left: 0.4rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: rgb(var(--tl-rgb));
}

.study-card-timeline--running { --tl-rgb: var(--bs-success-rgb); color: var(--sc-text); }
.study-card-timeline--pending { --tl-rgb: var(--bs-info-rgb); color: var(--sc-text); }
.study-card-timeline--muted { --tl-rgb: var(--bs-secondary-rgb); }

/* Closing within three days: amber, with a slow breathing glow. */
.study-card-timeline--soon {
  --tl-rgb: var(--bs-warning-rgb);
  color: var(--sc-text);
  animation: sc-soon 2.8s ease-in-out infinite;
}

.study-card-timeline--soon .study-card-timeline-relative {
  color: color-mix(in srgb, rgb(var(--tl-rgb)) 70%, var(--sc-text) 30%);
}

/* ---------- Footer ---------- */

.study-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.65rem;
  border-top: 1px solid var(--sc-border);
}

.study-card-open {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.38rem 0.85rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #fff;
  background: var(--bs-primary);
  border: 0;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(var(--bs-primary-rgb), 0.3), 0 4px 12px -4px rgba(var(--bs-primary-rgb), 0.5);
  transition: transform 0.2s var(--sc-ease), box-shadow 0.2s ease, filter 0.2s ease;
}

.study-card-open :deep(svg) {
  transition: transform 0.25s var(--sc-ease);
}

.study-card-open:hover {
  filter: brightness(1.08);
  box-shadow: 0 1px 2px rgba(var(--bs-primary-rgb), 0.3), 0 8px 18px -6px rgba(var(--bs-primary-rgb), 0.6);
}

.study-card-open:hover :deep(svg) {
  transform: translateX(3px);
}

.study-card-open:active {
  transform: scale(0.97);
}

.study-card-open:focus-visible,
.study-card-action:focus-visible {
  outline: 2px solid rgba(var(--bs-primary-rgb), 0.55);
  outline-offset: 2px;
}

.study-card-actions {
  display: flex;
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: 0.15rem;
  margin-left: auto;
}

.study-card-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  color: var(--sc-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, transform 0.2s var(--sc-ease);
}

.study-card-action:hover {
  color: var(--sc-text);
  background: rgba(var(--bs-secondary-rgb), 0.12);
  border-color: var(--sc-border);
}

.study-card-action:active {
  transform: scale(0.92);
}

.study-card-action--danger:hover {
  color: var(--bs-danger);
  background: rgba(var(--bs-danger-rgb), 0.1);
  border-color: rgba(var(--bs-danger-rgb), 0.25);
}

.study-card-action--more.is-open {
  color: var(--bs-primary);
  background: rgba(var(--bs-primary-rgb), 0.1);
  border-color: rgba(var(--bs-primary-rgb), 0.25);
}

/* ---------- More-actions menu (teleported to body) ---------- */

.study-card-menu {
  position: fixed;
  z-index: 1080;
  min-width: 13rem;
  padding: 0.35rem;
  translate: -100% 0;
  transform-origin: top right;
  font-family: "Inter Variable", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif;
  font-feature-settings: "cv01", "cv11", "ss03";
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color-translucent);
  border-radius: 12px;
  box-shadow: 0 12px 32px -8px rgba(15, 23, 42, 0.22), 0 2px 6px rgba(15, 23, 42, 0.08);
}

.study-card-menu--up {
  translate: -100% -100%;
  transform-origin: bottom right;
}

[data-bs-theme="dark"] .study-card-menu {
  background: color-mix(in srgb, var(--bs-body-bg) 90%, #ffffff 10%);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 16px 40px -10px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(0, 0, 0, 0.3);
}

.study-card-menu-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.45rem 0.65rem;
  font-size: 0.85rem;
  font-weight: 500;
  text-align: left;
  white-space: nowrap;
  color: var(--bs-body-color);
  background: transparent;
  border: 0;
  border-radius: 8px;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.study-card-menu-item :deep(svg) {
  flex: 0 0 auto;
  color: var(--bs-secondary-color);
  transition: color 0.15s ease;
}

.study-card-menu-item:hover,
.study-card-menu-item:focus-visible {
  outline: none;
  background: rgba(var(--bs-secondary-rgb), 0.12);
  color: var(--bs-emphasis-color);
}

.study-card-menu-item:hover :deep(svg),
.study-card-menu-item:focus-visible :deep(svg) {
  color: var(--bs-emphasis-color);
}

.study-card-menu-item--danger,
.study-card-menu-item--danger :deep(svg) {
  color: var(--bs-danger);
}

.study-card-menu-item--danger:hover,
.study-card-menu-item--danger:focus-visible {
  color: var(--bs-danger);
  background: rgba(var(--bs-danger-rgb), 0.1);
}

.study-card-menu-item--danger:hover :deep(svg),
.study-card-menu-item--danger:focus-visible :deep(svg) {
  color: var(--bs-danger);
}

.study-card-menu-divider {
  height: 1px;
  margin: 0.3rem 0.4rem;
  background: var(--bs-border-color-translucent);
}

.sc-menu-enter-active {
  transition: opacity 0.16s ease, transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}

.sc-menu-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.sc-menu-enter-from,
.sc-menu-leave-to {
  opacity: 0;
  transform: scale(0.94);
}

/* ---------- Live update states (same flags as the table rows) ---------- */

.study-card--entering {
  animation: sc-card-enter 0.9s var(--sc-ease) both;
}

.study-card--updated {
  animation: sc-card-updated 1.4s ease-out both;
}

.study-card--deleting {
  pointer-events: none;
  animation: sc-card-delete 0.75s var(--sc-ease) forwards;
}

.study-card--placeholder {
  pointer-events: none;
  opacity: 0.45;
}

/* ---------- Skeleton ---------- */

.study-card--skeleton {
  gap: 0.75rem;
}

.study-card--skeleton::after,
.study-card--skeleton::before {
  display: none;
}

.skeleton-line {
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    rgba(var(--bs-secondary-rgb), 0.1) 0%,
    rgba(var(--bs-secondary-rgb), 0.2) 40%,
    rgba(var(--bs-secondary-rgb), 0.1) 80%
  );
  background-size: 300% 100%;
  animation: sc-shimmer 1.6s ease-in-out infinite;
}

.skeleton-line--pill { width: 34%; height: 1.15rem; border-radius: 999px; }
.skeleton-line--title { width: 78%; height: 1.25rem; }
.skeleton-line--meta { width: 45%; height: 0.8rem; }
.skeleton-line--block { width: 100%; height: 3.6rem; border-radius: 10px; }
.skeleton-line--footer { width: 100%; height: 2rem; margin-top: 0.4rem; }

/* ---------- Empty ---------- */

.study-cards-empty {
  background: var(--sc-surface);
  border: 1px dashed rgba(var(--bs-secondary-rgb), 0.3);
  border-radius: var(--sc-radius);
  box-shadow: var(--sc-shadow);
}

.study-cards-empty--loading {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--sc-muted);
  animation: sc-card-in 0.5s var(--sc-ease) both;
}

/* ---------- Keyframes ---------- */

@keyframes sc-card-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes sc-card-enter {
  0% {
    opacity: 0;
    transform: translateY(-8px) scale(0.97);
    box-shadow: 0 0 0 0 rgba(var(--bs-primary-rgb), 0);
  }
  40% {
    opacity: 1;
    box-shadow: 0 0 0 3px rgba(var(--bs-primary-rgb), 0.35);
  }
  100% {
    transform: none;
    box-shadow: var(--sc-shadow);
  }
}

@keyframes sc-card-updated {
  0% { box-shadow: 0 0 0 0 rgba(var(--bs-info-rgb), 0); }
  25% { box-shadow: 0 0 0 3px rgba(var(--bs-info-rgb), 0.4); }
  100% { box-shadow: var(--sc-shadow); }
}

@keyframes sc-card-delete {
  0% {
    opacity: 1;
    transform: none;
    box-shadow: 0 0 0 0 rgba(var(--bs-danger-rgb), 0);
  }
  30% {
    box-shadow: 0 0 0 3px rgba(var(--bs-danger-rgb), 0.35);
  }
  100% {
    opacity: 0;
    transform: scale(0.94);
    filter: blur(1px);
  }
}

@keyframes sc-bar-in {
  from { transform: scaleX(0); transform-origin: left; }
  to { transform: scaleX(1); transform-origin: left; }
}

@keyframes sc-soon {
  0%, 100% { box-shadow: 0 0 0 0 rgba(var(--bs-warning-rgb), 0); }
  50% { box-shadow: 0 0 0 3px rgba(var(--bs-warning-rgb), 0.16); }
}

@keyframes sc-pulse {
  0% { transform: scale(1); opacity: 0.7; }
  80%, 100% { transform: scale(3); opacity: 0; }
}

@keyframes sc-shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: 0 0; }
}

@keyframes sc-progress {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}

@media (prefers-reduced-motion: reduce) {
  .study-card,
  .study-card-bar-fill,
  .study-cards-empty,
  .study-state-dot::after,
  .study-card-timeline--soon,
  .skeleton-line,
  .study-cards-progress::after {
    animation: none !important;
  }

  .study-card,
  .study-card-open,
  .study-card-action,
  .sc-menu-enter-active,
  .sc-menu-leave-active {
    transition: none;
  }

  .study-card:hover {
    transform: none;
  }
}
</style>
