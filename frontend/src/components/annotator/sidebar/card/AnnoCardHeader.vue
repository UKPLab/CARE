<template>
  <div
    class="row"
    :class="{ 'header-hoverable': collapsed && !editing }"
    :style="{ cursor: collapsed ? 'pointer' : 'default' }"
    @click="collapsed && !editing && setCollapsed(false)"
  >
    <!-- Mouse-only shortcut to open the card; the chevron below is the single keyboard and
         screen-reader control, so buttons are never nested inside each other -->
    <div class="col" style="display: flex; align-items: center;">
      <div
        v-if="!editing"
        :title="collapsed ? $t('annotator.card.markedCheckedClickToUncheck') : $t('annotator.card.clickToMarkChecked')"
        class="card-focusable care-focus-ring"
        style="display: inline-flex; margin-right: 8px;"
        role="button"
        tabindex="0"
        :aria-expanded="!collapsed"
        @click.stop="setCollapsed(!collapsed)"
        @keydown.enter.exact.prevent="setCollapsed(!collapsed)"
        @keydown.space.exact.prevent="setCollapsed(!collapsed)"
      >
        <LoadIcon
          :icon-name="collapsed ? 'chevron-right' : 'chevron-down'"
          :size="18"
          :style="{ cursor: 'pointer' }"
          class="check-icon"
        />
      </div>
      {{ creatorName }}
      <slot/>
    </div>
    <div class="col text-end">
      {{ formatLocalizedDate(updatedAt) }}
    </div>
  </div>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";
import { formatLocalizedDate } from "@/assets/utils";

/**
 * Header of an annotation card
 *
 * Shows the author and date, and the chevron that marks the card as checked (collapsed). The checked state is
 * stored per user (comment_state), restored when the card is shown again, and logged. The default slot shows
 * who else is editing the card.
 *
 * @author Nils Dycke, Dennis Zyska
 */
export default {
  name: "AnnoCardHeader",
  components: {LoadIcon},
  inject: {
    currentStudyStep: {default: null},
    documentId: {default: null},
    studySessionId: {default: null},
    studyStepId: {default: null},
    acceptStats: {default: () => false},
  },
  props: {
    commentId: {type: Number, required: true},
    creatorName: {type: String, default: ""},
    updatedAt: {type: [String, Date], default: null},
    collapsed: {type: Boolean, default: false},
    // While the card is edited it cannot be collapsed
    editing: {type: Boolean, default: false},
  },
  emits: ['update:collapsed'],
  computed: {
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    commentState() {
      return this.$store.getters['table/comment_state/getFiltered'](
        a => a.commentId === this.commentId && a.userId === this.userId
      )[0] || null;
    },
  },
  watch: {
    commentState: {
      immediate: true,
      handler(newVal) {
        if (newVal) {
          this.setCollapsed(newVal.state === 1);
        }
      }
    },
    collapsed(newValue) {
      const state = newValue ? 1 : 0;
      this.$socket.emit("appDataUpdate", {
        table: "comment_state",
        data: this.commentState ? {id: this.commentState.id, state} : {
          userId: this.userId,
          documentId: this.documentId,
          studySessionId: this.studySessionId,
          studyStepId: this.studyStepId,
          commentId: this.commentId,
          state,
        },
      });
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "commentToggleCollapse",
          data: {
            ...(this.currentStudyStep?.id ? {currentStudyStepId: this.currentStudyStep?.id} : {}),
            commentId: this.commentId,
            state: newValue,
            documentId: this.documentId,
            ...(this.studySessionId ? {studySessionId: this.studySessionId} : {}),
            ...(this.studyStepId ? {studyStepId: this.studyStepId} : {}),
          }
        });
      }
    },
  },
  methods: {
    formatLocalizedDate,
    setCollapsed(collapsed) {
      if (collapsed !== this.collapsed) this.$emit('update:collapsed', collapsed);
    },
  },
};
</script>

<style scoped>
.check-icon:hover {
  color: var(--care-primary) !important;
}

.header-hoverable {
  transition: background-color 0.2s ease;
}

.header-hoverable:hover {
  background-color: var(--bs-secondary-bg, #e9ecef) !important;
  border-radius: 4px;
}

.card-focusable:focus-visible {
  border-radius: 4px;
}
</style>
