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
      class="status-card-grid"
    >
      <StatusCard
        v-for="n in skeletonCount"
        :key="'skeleton-' + n"
        :index="n - 1"
        skeleton
      />
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
        :filter-labels="filterLabels"
        :can-create="!!onCreate"
        @clear="clearSearch && clearSearch()"
        @create="onCreate && onCreate()"
      />
    </div>

    <div
      v-else
      class="status-card-grid"
      :class="{ 'is-refreshing': loadingVisible }"
    >
      <StatusCard
        v-for="(row, index) in rows"
        :key="row.__sid || row.id"
        v-bind="cardStatus(row.state)"
        :index="index"
        :item-id="row.id"
        :title="row.name || $t('studies.dashboard.noName')"
        :title-clickable="!!openButton(row)"
        :meta="metaItems(row)"
        :progress="progressOf(row)"
        :timeline="timeline(row)"
        :live-state="rowState(row) || {}"
        @title-click="emitAction(openButton(row), row)"
      >
        <template #badges>
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
        </template>

        <template
          v-if="Number(row.limitSessionsPerUser) > 0"
          #progress-hint
        >
          <div
            class="status-card-hint"
            :title="$t('studies.fields.limitSessionsPerUser.help')"
          >
            <LoadIcon
              icon-name="person"
              :size="11"
            />
            {{ $t('studies.cards.perUser', { limit: row.limitSessionsPerUser }, Number(row.limitSessionsPerUser)) }}
          </div>
        </template>

        <template #footer>
          <button
            v-if="openButton(row)"
            type="button"
            class="status-card-primary"
            :title="openButton(row).title"
            @click="emitAction(openButton(row), row)"
          >
            {{ $t('studies.cards.open') }}
            <LoadIcon
              class="status-card-nudge"
              icon-name="arrow-right"
              :size="14"
            />
          </button>
          <div class="status-card-actions">
            <button
              v-for="b in actionLayout(row).inline"
              :key="b.action"
              type="button"
              class="status-card-icon-btn"
              :class="{ 'status-card-icon-btn--danger': isDanger(b) }"
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
              class="status-card-icon-btn"
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
        </template>
      </StatusCard>
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
import LoadIcon from "@/basic/Icon.vue";
import StatusCard from "@/basic/dashboard/card/StatusCard.vue";
import StudyEmptyState from "./StudyEmptyState.vue";
import {
  buildStudyTimeline,
  formatStudyCardDate,
  relativeTimeFormatter,
  studyCardStatus,
} from "./studyCardHelpers.js";

/** Icons kept in the card footer when the row has more actions than fit. */
const INLINE_ACTION_ORDER = ["editStudy", "copyStudyLink", "inspectStudySessions", "showInformation"];
/** Never promoted to an inline icon; always behind "more". */
const MENU_ONLY_ACTIONS = ["restartStudy"];
const MAX_INLINE_ACTIONS = 3;

/**
 * Card body for the Studies dashboard, rendered in BackendTable's `#cards` slot.
 * Reads the same enriched rows and row buttons as the table; actions go back through
 * the table's emitter, so Study.vue handles them exactly like a table click.
 * Each card is a StatusCard; this file adds the Studies-only parts (feature badges,
 * action layout with the "more" menu, empty states).
 *
 * @author Andrii Nikitin
 */
export default {
  name: "StudyCardGrid",
  components: { LoadIcon, StatusCard, StudyEmptyState },
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
    /** Active filter chips, worded as in the search bar. */
    filterLabels: {
      type: Array,
      required: false,
      default: () => [],
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
      const relative = relativeTimeFormatter(this.$i18n?.locale);
      const map = {};
      for (const row of this.rows) {
        map[row.id] = buildStudyTimeline(row, row.state, { t: (...args) => this.$t(...args), relative });
      }
      return map;
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
    /** StatusCard status props (tone, label, lock, pulse) from studyCardHelpers. */
    cardStatus(state) {
      return studyCardStatus(state, (...args) => this.$t(...args));
    },
    metaItems(row) {
      const items = [];
      if (row.createdAt) {
        items.push({
          key: "created",
          icon: "calendar3",
          text: formatStudyCardDate(row.createdAt),
          title: this.$t("studies.columns.created"),
        });
      }
      const owner = this.ownerName(row);
      if (owner) {
        items.push({ key: "owner", icon: "person", text: owner });
      }
      return items;
    },
    progressOf(row) {
      return {
        label: this.$t("studies.columns.sessions"),
        value: this.sessionCount(row),
        suffix: "/ " + (this.hasLimit(row) ? row.limitSessions : "∞"),
        percent: this.sessionFill(row),
        unbounded: !this.hasLimit(row),
      };
    },
    timeline(row) {
      return this.timelines[row.id] || null;
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
/* The card itself (look, footer buttons, skeleton, live states) is StatusCard.vue.
   This file only styles what the Studies page adds around it. */
.study-cards {
  position: relative;
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

/* ---------- Feature badges (StatusCard #badges slot) ---------- */

.study-feature {
  display: inline-grid;
  place-items: center;
  width: 1.4rem;
  height: 1.4rem;
  color: var(--care-card-muted);
  border-radius: 6px;
  background: rgba(var(--bs-secondary-rgb), 0.08);
  border: 1px solid var(--care-card-border);
  cursor: help;
  transition: color 0.2s ease, background-color 0.2s ease;
}

.study-feature:hover {
  color: var(--care-card-accent);
  background: color-mix(in srgb, var(--care-card-accent) 12%, transparent);
}

/* ---------- More-actions menu (teleported to body) ---------- */

.study-card-menu {
  position: fixed;
  z-index: 1080;
  min-width: 13rem;
  padding: 0.35rem;
  translate: -100% 0;
  transform-origin: top right;
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color-translucent);
  border-radius: 12px;
  box-shadow: var(--care-shadow-3);
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

/* ---------- Empty ---------- */

.study-cards-empty {
  background: var(--care-card-surface);
  border: 1px dashed rgba(var(--bs-secondary-rgb), 0.3);
  border-radius: var(--care-card-radius);
  box-shadow: var(--care-card-shadow);
}

.study-cards-empty--loading {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--care-card-muted);
  animation: sc-card-in 0.5s var(--care-card-ease) both;
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

@keyframes sc-progress {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}

@media (prefers-reduced-motion: reduce) {
  .study-cards-empty,
  .study-cards-progress::after {
    animation: none !important;
  }

  .sc-menu-enter-active,
  .sc-menu-leave-active {
    transition: none;
  }
}
</style>
