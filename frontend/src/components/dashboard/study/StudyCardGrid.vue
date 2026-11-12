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
          <BasicButton
            v-if="openButton(row)"
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
          </BasicButton>
          <div class="status-card-actions">
            <BasicButton
              v-for="b in actionLayout(row).inline"
              :key="b.action"
              class="btn-icon"
              :class="{ 'btn-icon-danger': isDanger(b) }"
              :title="b.title"
              :aria-label="b.title"
              @click="emitAction(b, row)"
            >
              <LoadIcon
                :icon-name="b.icon"
                :size="15"
              />
            </BasicButton>
            <!-- The menu is teleported: the card clips its overflow for the rounded accent wash. -->
            <BasicPopupMenu
              v-if="actionLayout(row).menu.length > 0"
              :items="menuItems(row)"
              @select="emitAction($event, row)"
            />
          </div>
        </template>
      </StatusCard>
    </div>
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import LoadIcon from "@/basic/Icon.vue";
import BasicPopupMenu from "@/basic/PopupMenu.vue";
import StatusCard from "@/basic/dashboard/card/StatusCard.vue";
import StudyEmptyState from "./StudyEmptyState.vue";
import {
  buildStudyTimeline,
  formatStudyCardDate,
  relativeTimeFormatter,
  studyCardStatus,
} from "./studyCardHelpers.js";
import { isDangerButton, rowMenuItems, splitRowActions } from "@/basic/table/helpers/rowActionsLayout.js";

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
  components: { BasicButton, LoadIcon, BasicPopupMenu, StatusCard, StudyEmptyState },
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
      return splitRowActions(buttons, {
        maxInline: MAX_INLINE_ACTIONS,
        inline: INLINE_ACTION_ORDER,
        menuOnly: MENU_ONLY_ACTIONS,
      });
    },
    /**
     * Menu entries of the row's "more" menu.
     * @param {Object} row
     * @returns {Object[]}
     */
    menuItems(row) {
      return rowMenuItems(this.actionLayout(row).menu);
    },
    isDanger: isDangerButton,
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
  border-radius: var(--care-radius-sm);
  background: rgba(var(--bs-secondary-rgb), 0.08);
  border: 1px solid var(--care-card-border);
  cursor: help;
  transition: color 0.2s ease, background-color 0.2s ease;
}

.study-feature:hover {
  color: var(--care-card-accent);
  background: color-mix(in srgb, var(--care-card-accent) 12%, transparent);
}

/* ---------- Empty ---------- */

.study-cards-empty {
  background: var(--care-card-surface);
  border: 1px dashed rgba(var(--bs-secondary-rgb), 0.3);
  border-radius: var(--care-radius-xl);
  box-shadow: var(--care-card-shadow);
}

.study-cards-empty--loading {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--care-card-muted);
  animation: sc-card-in 0.5s var(--care-ease) both;
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
}
</style>
