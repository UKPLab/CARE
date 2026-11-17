<template>
  <div class="conversation-history">
    <AiConversationHeader
        :conversations="snapshot.conversations || []"
        :active-conversation-id="snapshot.activeConversationId"
        :include-context="snapshot.includeContext !== false"
        :context-description="contextDescription"
        :is-busy="isBusy"
        :read-only="readOnly"
        @new="startNew"
        @select="select"
    />

    <div
        v-if="snapshot.contextNearLimit && !readOnly"
        class="alert alert-warning m-2 py-2 px-3 small d-flex align-items-center justify-content-between"
        role="alert"
    >
      <span>{{ $t('ai.chat.contextNearLimit') }}</span>
      <BasicButton
          class="btn btn-sm btn-outline-secondary ms-2"
          :title="$t('ai.chat.newConversation')"
          :disabled="isBusy"
          @click="startNew(true)"
      >
        {{ $t('ai.chat.newConversation') }}
      </BasicButton>
    </div>

    <div v-if="loadFailed" class="alert alert-danger m-2" role="alert">
      {{ $t("ai.chat.errors.loadFailed") }}
      <BasicButton :disabled="loading" @click="$emit('retry', null)">{{ $t("ai.chat.retry") }}</BasicButton>
    </div>
    <div v-if="conversationTooLong && !readOnly" class="m-2">
      <BasicButton :disabled="isBusy" @click="startNew(true)">{{ $t("ai.chat.newConversation") }}</BasicButton>
    </div>
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import AiConversationHeader from "./AiConversationHeader.vue";

/** Dialogue study steps change between turns, so their chat context is refreshed. */
const DIALOGUE_STEP_TYPE = 2;
/** Delay before a timed-out snapshot load is retried once. */
const LOAD_RETRY_DELAY = 2000;

/**
 * Conversation navigation strip: header menus plus the history load and
 * context-limit notices. Owns which kind of navigation the student made
 * (history pick vs. latest) and the one-shot retry of a timed-out load; the
 * parent conversation owns the snapshot and acts on the emitted intents.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "AiConversationHistory",
  components: {BasicButton, AiConversationHeader},
  inject: {
    orderedStudySteps: {default: () => []},
    currentStudyStep: {default: null},
    studySessionId: {default: null},
  },
  props: {
    studyStepId: {type: Number, required: true},
    /** Conversation snapshot owned by the parent; read-only here. */
    snapshot: {type: Object, required: true},
    conversationTooLong: {type: Boolean, default: false},
    loadFailed: {type: Boolean, default: false},
    /** Failed load to retry automatically once; a new object schedules a new retry. */
    autoRetry: {type: Object, default: null},
    loading: {type: Boolean, default: false},
    isBusy: {type: Boolean, default: false},
    readOnly: {type: Boolean, default: false},
  },
  emits: ["new", "select", "retry", "refresh", "stat"],
  data() {
    return {
      historySelected: false,
      retryTimer: null,
    };
  },
  computed: {
    contextDescription() {
      const step = this.orderedStudySteps.find((item) => item.id === this.studyStepId);
      return step?.stepType === DIALOGUE_STEP_TYPE ? this.$t("ai.chat.contextUpdateHint") : "";
    },
  },
  watch: {
    autoRetry(failure) {
      this.cancelRetry();
      if (failure) {
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          this.$emit("retry", failure);
        }, LOAD_RETRY_DELAY);
      }
    },
    studySessionId() {
      this.historySelected = false;
    },
    studyStepId() {
      this.historySelected = false;
    },
    "currentStudyStep.id"(stepId) {
      if (stepId === this.studyStepId) {
        // Retained panes refresh on return, unless history was selected explicitly.
        this.$emit("refresh", this.historySelected ? this.snapshot.activeConversationId : null);
      }
    },
  },
  beforeUnmount() {
    this.cancelRetry();
  },
  methods: {
    /**
     * Requests a new conversation, dropping any explicit history selection.
     * @param {boolean} includeContext - Whether to add configured study context.
     * @returns {void}
     */
    startNew(includeContext) {
      this.historySelected = false;
      this.$emit("new", includeContext);
    },
    /**
     * Requests a past conversation from the history menu.
     * @param {number} conversationId - Conversation to open.
     * @returns {void}
     */
    select(conversationId) {
      if (this.isBusy || conversationId === this.snapshot.activeConversationId) {
        return;
      }
      this.historySelected = true;
      this.$emit("stat", "aiChatConversationSwitch", {
        fromConversationId: this.snapshot.activeConversationId,
        toConversationId: Number(conversationId),
      });
      this.$emit("select", conversationId);
    },
    /** Cancels a scheduled automatic retry. */
    cancelRetry() {
      if (this.retryTimer !== null) {
        clearTimeout(this.retryTimer);
      }
      this.retryTimer = null;
    },
  },
};
</script>

<style scoped>
.conversation-history {
  flex-shrink: 0;
}
</style>
