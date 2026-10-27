<template>
  <BackendTable
    ref="sessionTable"
    table="study_session"
    :columns="columns"
    :query-filter="queryFilter"
    :enrich-row="(row) => enrichSession(row)"
    :options="tableOptions"
    card-mode
  >
    <template #cards="cards">
      <div
        class="ss-cards"
        :class="{ 'is-refreshing': cards.loadingVisible && cards.rows.length > 0 }"
        :aria-busy="cards.loading"
      >
        <p
          v-if="cards.rows.length === 0"
          class="ss-empty"
        >
          {{ cards.loading ? $t('common.loadingFromServer') : $t('studies.dashboard.noSessionsInStudy') }}
        </p>
        <div
          v-else
          class="ss-list"
        >
          <article
            v-for="(card, index) in cards.rows"
            :key="card.id"
            class="ss-card"
            :class="[
              'ss-card--' + card.cardStatus,
              {
                'ss-card--deleting': cards.rowState(card).deleting,
                'ss-card--updated': cards.rowState(card).updated,
              },
            ]"
            :style="{ '--i': index }"
          >
            <header class="ss-card-head">
              <span class="ss-pill">
                <span class="ss-dot" />
                {{ statusLabel(card.cardStatus) }}
              </span>
              <span class="ss-card-id">#{{ card.id }}</span>
            </header>

            <div class="ss-card-meta">
              <span class="ss-meta-item">
                <LoadIcon
                  icon-name="calendar3"
                  :size="12"
                />
                {{ card.startedLabel }}
              </span>
              <span
                v-if="card.parentStudySessionId"
                class="ss-meta-item"
                :title="$t('studies.dashboard.copiedFrom', { id: card.parentStudySessionId })"
              >
                <LoadIcon
                  icon-name="diagram-2"
                  :size="12"
                />
                #{{ card.parentStudySessionId }}
              </span>
              <span
                v-if="card.showResumable"
                class="ss-meta-item"
              >
                <LoadIcon
                  icon-name="arrow-repeat"
                  :size="12"
                />
                {{ $t('studies.dashboard.resumable') }}
              </span>
            </div>

            <footer class="ss-card-foot">
              <button
                v-if="card.primary"
                type="button"
                class="ss-open"
                :class="{ 'ss-open--ghost': card.primary === 'inspect' }"
                @click="emitAction(card.primary, card)"
              >
                <LoadIcon
                  :icon-name="card.primary === 'inspect' ? 'search' : 'play-fill'"
                  :size="13"
                />
                {{ primaryLabel(card.primary) }}
              </button>
              <div class="ss-actions">
                <button
                  type="button"
                  class="ss-action"
                  :title="$t('dashboard.study.copySession')"
                  :aria-label="$t('dashboard.study.copySession')"
                  @click="emitAction('copy', card)"
                >
                  <LoadIcon
                    icon-name="clipboard"
                    :size="15"
                  />
                </button>
                <button
                  v-if="card.showDeleteButton"
                  type="button"
                  class="ss-action ss-action--danger"
                  :title="$t('dashboard.study.deleteSession')"
                  :aria-label="$t('dashboard.study.deleteSession')"
                  @click="emitAction('delete', card)"
                >
                  <LoadIcon
                    icon-name="trash"
                    :size="15"
                  />
                </button>
              </div>
            </footer>
          </article>
        </div>
      </div>
    </template>
  </BackendTable>
</template>

<script>
import BackendTable from "@/basic/BackendTable.vue";
import LoadIcon from "@/basic/Icon.vue";
import { formatLocalizedDateTime } from "@/assets/utils";

/**
 * The current user's sessions of one study, as cards ("My Sessions" dashboard).
 *
 * Rows come from BackendTable (server-side `queryTable` on study_session, filtered by study and
 * user, with live Delta updates), like StudySessionTable with `currentUserOnly` — no Vuex dump.
 * The start / resume / inspect / delete rules are the ones of that table. Actions are emitted;
 * the page owns the modals and the router.
 *
 * @author Andrii Nikitin
 */
export default {
  name: "StudySessionCards",
  components: { BackendTable, LoadIcon },
  props: {
    /** Study row from the page's BackendTable (closed, end, resumable, multipleSubmit, owners). */
    study: {
      type: Object,
      required: true,
    },
    /** Closed-studies list: finished sessions can be inspected. */
    showClosed: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["action"],
  data() {
    return {
      tableOptions: {
        pagination: {
          serverSide: true,
          itemsPerPage: 6,
          itemsPerPageList: [6, 12, 24],
          total: 0,
        },
        sort: { column: "id", order: "DESC" },
      },
    };
  },
  computed: {
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    /** Same filter as StudySessionTable with currentUserOnly. */
    queryFilter() {
      return [
        { key: "studyId", value: this.study.id },
        { key: "userId", value: this.userId },
      ];
    },
    /** BackendTable needs columns even in card mode (its hidden table stays mounted). */
    columns() {
      return [
        { name: this.$t("common.id"), key: "id" },
        { name: this.$t("studies.columns.started"), key: "startedLabel" },
      ];
    },
    studyClosed() {
      if (this.study.closed) return true;
      return !!(!this.study.multipleSubmit && this.study.end && new Date(this.study.end) < Date.now());
    },
  },
  methods: {
    /**
     * Card fields + the action rules of StudySessionTable.processSession (currentUserOnly).
     * @param {Object} session raw study_session row
     * @returns {Object}
     */
    enrichSession(session) {
      const row = { ...session };
      const started = row.start !== undefined && row.start !== null;
      const finished = row.end !== undefined && row.end !== null;
      // True only when the study is closed, the session is not finished and it was copied.
      const canResumeOrStart = this.studyClosed && !finished
        && row.parentStudySessionId !== undefined && row.parentStudySessionId !== null;
      const resumable = !!this.study.resumable;

      const showResume = (resumable && started && !this.studyClosed) || (resumable && started && canResumeOrStart);
      const showStart = (!started && !this.studyClosed) || (!started && canResumeOrStart);
      const showInspect = this.showClosed && !canResumeOrStart;

      row.primary = showResume ? "resume" : (showStart ? "start" : (showInspect ? "inspect" : null));
      row.showDeleteButton = this.userId === this.study.createdByUserId && this.userId !== this.study.userId;
      row.cardStatus = finished ? "finished" : (started ? "running" : "pending");
      row.showResumable = resumable && !finished;
      row.startedLabel = started
        ? this.$t("studies.dashboard.startedOn", {
          date: formatLocalizedDateTime(row.start, { dateStyle: "medium", timeStyle: "short" }),
        })
        : this.$t("studies.dashboard.notStartedYet");
      return row;
    },
    statusLabel(status) {
      return {
        finished: this.$t("studies.dashboard.finished"),
        running: this.$t("studies.dashboard.inProgress"),
        pending: this.$t("studies.dashboard.notStartedYet"),
      }[status];
    },
    primaryLabel(primary) {
      return {
        resume: this.$t("studies.resumeSession"),
        start: this.$t("studies.startSession"),
        inspect: this.$t("dashboard.study.inspectSession"),
      }[primary];
    },
    emitAction(type, session) {
      this.$emit("action", { type, session, study: this.study });
    },
    /** Reload the current page of sessions (e.g. after a copy). */
    refetch() {
      this.$refs.sessionTable?.refetchCurrentWindow?.();
    },
  },
};
</script>

<style scoped>
.ss-cards {
  transition: opacity 0.3s ease;
}

.ss-cards.is-refreshing {
  opacity: 0.55;
  pointer-events: none;
}

.ss-empty {
  margin: 0;
  padding: 0.6rem 0.2rem;
  font-size: 0.85rem;
  color: var(--sc-muted, var(--bs-secondary-color));
}

.ss-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr));
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.ss-card {
  --ss-accent: var(--bs-secondary);
  --ss-accent-rgb: var(--bs-secondary-rgb);

  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.7rem 0.85rem 0.6rem 1rem;
  overflow: hidden;
  background: var(--sc-surface-raised, var(--bs-tertiary-bg));
  border: 1px solid var(--sc-border, var(--bs-border-color-translucent));
  border-radius: 12px;
  animation: ss-in 0.4s var(--sc-ease, ease) both;
  animation-delay: calc(min(var(--i, 0), 10) * 30ms);
  transition: transform 0.25s var(--sc-ease, ease), border-color 0.25s ease, box-shadow 0.25s ease, opacity 0.4s ease;
}

.ss-card::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--ss-accent);
  opacity: 0.85;
}

.ss-card:hover {
  transform: translateY(-2px);
  border-color: rgba(var(--ss-accent-rgb), 0.35);
  box-shadow: 0 8px 20px -12px rgba(0, 0, 0, 0.35);
}

.ss-card--deleting {
  opacity: 0.35;
  pointer-events: none;
}

.ss-card--updated {
  border-color: rgba(var(--ss-accent-rgb), 0.5);
}

.ss-card--running { --ss-accent: var(--bs-primary); --ss-accent-rgb: var(--bs-primary-rgb); }
.ss-card--finished { --ss-accent: var(--bs-success); --ss-accent-rgb: var(--bs-success-rgb); }

[data-bs-theme="dark"] .ss-card--running {
  --ss-accent: var(--care-accent);
  --ss-accent-rgb: 227, 213, 168;
}

.ss-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.ss-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.15rem 0.55rem 0.15rem 0.45rem;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--ss-accent);
  background: rgba(var(--ss-accent-rgb), 0.12);
  border: 1px solid rgba(var(--ss-accent-rgb), 0.22);
  border-radius: 999px;
}

.ss-dot {
  position: relative;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.ss-card--running .ss-dot::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: currentColor;
  animation: ss-pulse 2.2s ease-out infinite;
}

.ss-card-id {
  font-family: var(--sc-font-mono, var(--bs-font-monospace));
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--sc-muted, var(--bs-secondary-color));
  opacity: 0.85;
}

.ss-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.8rem;
  font-size: 0.78rem;
  color: var(--sc-muted, var(--bs-secondary-color));
}

.ss-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
}

.ss-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-height: 2rem;
  margin-top: auto;
  padding-top: 0.5rem;
  border-top: 1px solid var(--sc-border, var(--bs-border-color-translucent));
}

.ss-open {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--care-on-primary);
  background: var(--care-primary);
  border: 1px solid transparent;
  border-radius: 8px;
  transition: filter 0.2s ease, transform 0.2s var(--sc-ease, ease), background-color 0.2s ease;
}

.ss-open:hover {
  filter: brightness(1.08);
}

[data-bs-theme="dark"] .ss-open:hover {
  filter: none;
  background: var(--care-accent-hover);
}

.ss-open:active {
  transform: scale(0.97);
}

/* Inspect is a read-only look, so it is less loud than start / resume */
.ss-open--ghost {
  color: var(--sc-text, var(--bs-emphasis-color));
  background: transparent;
  border-color: var(--sc-border, var(--bs-border-color));
}

.ss-open--ghost:hover {
  filter: none;
  background: rgba(var(--bs-secondary-rgb), 0.12);
}

[data-bs-theme="dark"] .ss-open--ghost:hover {
  background: rgba(var(--bs-secondary-rgb), 0.18);
}

.ss-actions {
  display: flex;
  gap: 0.15rem;
  margin-left: auto;
}

.ss-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.9rem;
  height: 1.9rem;
  padding: 0;
  color: var(--sc-muted, var(--bs-secondary-color));
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, transform 0.2s var(--sc-ease, ease);
}

.ss-action:hover {
  color: var(--sc-text, var(--bs-emphasis-color));
  background: rgba(var(--bs-secondary-rgb), 0.12);
  border-color: var(--sc-border, var(--bs-border-color));
}

.ss-action:active {
  transform: scale(0.92);
}

.ss-action--danger:hover {
  color: var(--bs-danger);
  background: rgba(var(--bs-danger-rgb), 0.1);
  border-color: rgba(var(--bs-danger-rgb), 0.25);
}

.ss-open:focus-visible,
.ss-action:focus-visible {
  outline: 2px solid rgba(var(--bs-primary-rgb), 0.55);
  outline-offset: 2px;
}

[data-bs-theme="dark"] .ss-open:focus-visible,
[data-bs-theme="dark"] .ss-action:focus-visible {
  outline-color: var(--care-accent);
}

@keyframes ss-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}

@keyframes ss-pulse {
  0% { transform: scale(1); opacity: 0.55; }
  70%, 100% { transform: scale(2.6); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .ss-card,
  .ss-card:hover {
    animation: none;
    transform: none;
    transition: none;
  }

  .ss-card--running .ss-dot::after {
    animation: none;
  }
}
</style>
