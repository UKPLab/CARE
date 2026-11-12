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
          class="status-card-grid status-card-grid--compact ss-list"
        >
          <StatusCard
            v-for="(card, index) in cards.rows"
            :key="card.id"
            compact
            :index="index"
            :tone="statusTone(card.cardStatus)"
            :state-label="statusLabel(card.cardStatus)"
            :live="card.cardStatus === 'running'"
            :item-id="card.id"
            :meta="metaItems(card)"
            :live-state="cards.rowState(card) || {}"
          >
            <template #footer>
              <BasicButton
                v-if="card.primary"
                class="status-card-primary"
                :class="{ 'status-card-primary--ghost': card.primary === 'inspect' }"
                @click="emitAction(card.primary, card)"
              >
                <LoadIcon
                  :icon-name="card.primary === 'inspect' ? 'search' : 'play-fill'"
                  :size="13"
                />
                {{ primaryLabel(card.primary) }}
              </BasicButton>
              <div class="status-card-actions">
                <BasicButton
                  class="btn-icon"
                  :title="$t('dashboard.study.copySession')"
                  :aria-label="$t('dashboard.study.copySession')"
                  @click="emitAction('copy', card)"
                >
                  <LoadIcon
                    icon-name="clipboard"
                    :size="15"
                  />
                </BasicButton>
                <BasicButton
                  v-if="card.showDeleteButton"
                  class="btn-icon btn-icon-danger"
                  :title="$t('dashboard.study.deleteSession')"
                  :aria-label="$t('dashboard.study.deleteSession')"
                  @click="emitAction('delete', card)"
                >
                  <LoadIcon
                    icon-name="trash"
                    :size="15"
                  />
                </BasicButton>
              </div>
            </template>
          </StatusCard>
        </div>
      </div>
    </template>
  </BackendTable>
</template>

<script>
import BackendTable from "@/basic/BackendTable.vue";
import BasicButton from "@/basic/Button.vue";
import LoadIcon from "@/basic/Icon.vue";
import StatusCard from "@/basic/dashboard/card/StatusCard.vue";
import { formatLocalizedDateTime } from "@/assets/utils";
import { isStudyOpen, ownSessionActions } from "./studyCardHelpers.js";

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
  components: { BackendTable, BasicButton, LoadIcon, StatusCard },
  props: {
    /** Study row from the page's BackendTable (closed, end, resumable, multipleSubmit, owners). */
    study: {
      type: Object,
      required: true,
    },
    /** Closed-studies list: finished sessions can be inspected. */
    showClosed: {
      type: Boolean,
      required: false,
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
      return !isStudyOpen(this.study);
    },
  },
  methods: {
    /**
     * Card fields + the action rules shared with StudySessionTable (ownSessionActions).
     * @param {Object} session raw study_session row
     * @returns {Object}
     */
    enrichSession(session) {
      const row = { ...session };
      const started = row.start !== undefined && row.start !== null;
      const finished = row.end !== undefined && row.end !== null;
      const actions = ownSessionActions(row, this.study, {
        studyClosed: this.studyClosed,
        showClosed: this.showClosed,
        userId: this.userId,
      });

      row.primary = actions.resume ? "resume" : (actions.start ? "start" : (actions.inspect ? "inspect" : null));
      row.showDeleteButton = actions.delete;
      row.cardStatus = finished ? "finished" : (started ? "running" : "pending");
      row.showResumable = !!this.study.resumable && !finished;
      row.startedLabel = started
        ? this.$t("studies.dashboard.startedOn", {
          date: formatLocalizedDateTime(row.start, { dateStyle: "medium", timeStyle: "short" }),
        })
        : this.$t("studies.dashboard.notStartedYet");
      return row;
    },
    /** In progress uses the theme accent (blue / yellow), finished green, not started grey. */
    statusTone(status) {
      return { finished: "success", running: "primary", pending: "neutral" }[status] || "neutral";
    },
    metaItems(card) {
      const items = [{ key: "started", icon: "calendar3", text: card.startedLabel }];
      if (card.parentStudySessionId) {
        items.push({
          key: "parent",
          icon: "diagram-2",
          text: "#" + card.parentStudySessionId,
          title: this.$t("studies.dashboard.copiedFrom", { id: card.parentStudySessionId }),
        });
      }
      if (card.showResumable) {
        items.push({ key: "resumable", icon: "arrow-repeat", text: this.$t("studies.dashboard.resumable") });
      }
      return items;
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
  color: var(--care-card-muted);
}

/* The cards themselves are compact StatusCards (StatusCard.vue). */
.ss-list {
  margin-bottom: 0.75rem;
}
</style>
