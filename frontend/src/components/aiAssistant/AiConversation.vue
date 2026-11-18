<template>
  <div class="ai-conversation d-flex flex-column h-100">
    <AiConversationHistory
        :study-step-id="studyStepId"
        :snapshot="conversationSnapshot"
        :conversation-too-long="requestFailureKey === 'errors.ai.chat.conversationTooLong'"
        :load-failed="loadFailed"
        :auto-retry="autoRetry"
        :loading="loading"
        :is-busy="isBusy"
        :read-only="readOnly"
        @new="startNewConversation"
        @select="selectConversation"
        @retry="retryLoadConversation"
        @refresh="refreshOnReturn"
        @stat="logChatEvent"
    />

    <AiConversationTranscript
        ref="body"
        :active-request="activeRequest"
        :aborting="aborting"
        :study-step-id="studyStepId"
        :snapshot="conversationSnapshot"
        :loading="loading"
        :is-busy="isBusy"
        :retryable-message-id="retryableMessageId"
        @retry="retryMessage"
        @stat="logChatEvent"
        @accepted-input="acceptPendingInput"
    />

    <AiConversationComposer
        ref="composer"
        v-model:selected-model-id="selectedModelId"
        :study-step-id="studyStepId"
        :models="conversationSnapshot.models"
        :error-message="errorMessage"
        :is-busy="isBusy"
        :ready="canSubmit"
        :active-request="activeRequest"
        :aborting="aborting"
        :read-only="readOnly"
        @send="sendMessage"
        @abort="abortChatRequest"
        @stat="logChatEvent"
    />

    <AiAssistantRequest
        v-if="activeRequest"
        :key="activeRequest.requestId"
        ref="aiAssistantRequest"
        :request="activeRequest"
        :study-step-id="studyStepId"
        :document-id="documentId"
        :service="service"
        :selected-model-id="selectedModelId"
        @complete="handleRequestComplete"
        @failed="handleChatRequestFailed"
    />
  </div>
</template>

<script>
import AiConversationHistory from "./AiConversationHistory.vue";
import AiConversationTranscript from "./AiConversationTranscript.vue";
import AiAssistantRequest from "@/basic/service/AiAssistantRequest.vue";
import AiConversationComposer from "@/components/aiAssistant/AiConversationComposer.vue";
import aiRequestMixin from "@/basic/service/aiRequestMixin";
import {AI_MESSAGE_STATUSES} from "@/assets/aiMessageTypes";
import {resolveApiMessage} from "@/assets/utils";

/**
 * Study AI conversation panel for one study context (AiChatSidebar remounts it
 * when the session or step changes). Owns the conversation snapshot and request
 * lifecycle; the history strip, transcript and composer render it and report
 * user intents back through events.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "AiConversation",
  components: {
    AiAssistantRequest,
    AiConversationHistory,
    AiConversationComposer,
    AiConversationTranscript,
  },
  mixins: [aiRequestMixin],
  inject: {
    studySessionId: {default: null},
  },
  props: {
    studyStepId: {type: Number, required: true},
    documentId: {type: Number, required: true},
    service: {type: Object, required: true},
    readOnly: {type: Boolean, required: false, default: false},
  },
  emits: ["stat"],
  data() {
    return {
      loadFailed: false,
      autoRetry: null,
      failedLoadConversationId: null,
      requestFailureKey: "",
      conversationSnapshot: {
        conversations: [],
        activeConversationId: null,
        includeContext: true,
        messages: [],
        models: [],
        defaultModelId: null,
        contextNearLimit: false,
      },
      newConversationSelected: false,
      selectedModelId: null,
    };
  },
  computed: {
    requestFailedText() {
      return this.$t("ai.chat.errors.requestFailed");
    },
    abortFailedText() {
      return this.$t("ai.chat.errors.abortFailed");
    },
    /** Whether a non-empty draft may be sent; the composer adds the draft check. */
    canSubmit() {
      return !this.readOnly && !this.loadFailed && !this.isBusy && !!this.selectedModelId;
    },
  },
  sockets: {
    connect() {
      this.loadConversation({silent: true});
    },
    disconnect() {
      this.snapshotLoadId += 1;
      this.loading = false;
      this.loadFailed = true;
    },
  },
  mounted() {
    this.loadConversation();
  },
  methods: {
    /**
     * Discards the preview before recovering the persisted failure state.
     * @param {Error} error - Request failure.
     * @param {boolean} dispatched - Whether the request reached the server.
     * @returns {Promise<void>}
     */
    async handleChatRequestFailed(error, dispatched) {
      this.$refs.body?.clearStream();
      await this.handleRequestFailed(error, dispatched);
      this.requestFailureKey = error.key || "";
      if (error.key === "errors.ai.chat.conversationTooLong") {
        this.logChatEvent("aiChatContextBlocked", {aiModelId: this.selectedModelId});
      }
      this.$refs.composer?.focus();
    },
    /** Aborts the active request and restores the Chat input when available. */
    async abortChatRequest() {
      await this.abortActiveRequest();
      this.$refs.composer?.focus();
    },
    /**
     * Updates the loaded conversation snapshot.
     * @param {Object} values - Snapshot fields to replace.
     * @returns {void}
     */
    setConversationSnapshot(values) {
      this.conversationSnapshot = {...this.conversationSnapshot, ...values};
    },
    /**
     * Reports one AI chat behavior event; the study host records it.
     *
     * @param {string} action - Statistic action name.
     * @param {Object} data - Event metadata.
     * @returns {void}
     */
    logChatEvent(action, data = {}) {
      this.$emit("stat", action, {conversationId: this.activeConversationId, ...data});
    },
    /**
     * Loads the latest conversation snapshot for the current study step.
     *
     * @param {Object} [options] - Loading options.
     * @returns {Promise<boolean>} Whether the snapshot loaded.
     */
    loadConversation({silent = false, conversationId = this.activeConversationId, retry = false} = {}) {
      const preserveNewConversation = this.newConversationSelected && conversationId === null
          && !this.activeRequest && !this.recoverableRequest;
      this.autoRetry = null;
      this.failedLoadConversationId = conversationId;
      return this.loadSnapshot({
        silent,
        fetch: (context) => this.$aiAssistant.getConversation({
          studySessionId: context.studySessionId,
          studyStepId: context.studyStepId,
          conversationId,
          aiModelId: silent && conversationId === this.activeConversationId ? this.selectedModelId : null,
        }),
        apply: (result) => this.applyLoadedSnapshot(result, {silent, preserveNewConversation}),
        fail: (error, context) => {
          this.loadFailed = true;
          this.errorMessage = resolveApiMessage(error, "ai.chat.errors.loadFailed");
          if (error.key === "ai.errors.requestTimeout" && !retry && !this.recovering
              && !this.activeRequest && !this.recoverableRequest
              && !this.messages.some(message => Number(message.status) === AI_MESSAGE_STATUSES.PENDING)) {
            this.autoRetry = {context, silent, conversationId};
          }
        },
        settle: (context) => context.loadId === this.snapshotLoadId
            && this.scrollToBottom({force: !silent && !this.loadFailed}),
      });
    },
    /**
     * Applies a current snapshot, keeping an unsaved new-conversation choice.
     *
     * @param {Object} result - Backend conversation snapshot.
     * @param {Object} options - Whether the load was silent and should keep a new conversation.
     * @returns {boolean} Whether the snapshot was applied.
     */
    applyLoadedSnapshot(result, {silent, preserveNewConversation}) {
      const listed = {
        conversations: result.conversations || [],
        models: result.models || [],
        defaultModelId: result.defaultModelId || null,
      };
      if (preserveNewConversation && this.newConversationSelected) {
        this.setConversationSnapshot(listed);
        this.selectedModelId = this.resolveSelectedModel(result.defaultModelId);
        this.loadFailed = false;
        this.errorMessage = "";
        return true;
      }
      // Keep an unsaved choice until recovery finds the new conversation.
      if (silent && this.newConversationSelected && (!result.activeConversationId
          || listed.conversations.some((conversation) => Number(conversation.id) === Number(result.activeConversationId)))) {
        return false;
      }
      this.setConversationSnapshot({
        ...listed,
        activeConversationId: result.activeConversationId,
        includeContext: result.includeContext !== false,
        messages: result.messages || [],
        contextNearLimit: result.contextNearLimit === true,
      });
      if (this.loadFailed && !this.activeRequest && !this.recoverableRequest) {
        this.errorMessage = "";
      }
      this.loadFailed = false;
      this.selectedModelId = result.selectedModelId || this.resolveSelectedModel(result.defaultModelId);
      if (result.activeConversationId) {
        this.newConversationSelected = false;
      }
      if (this.reconcileRequest()) {
        this.clearActiveRequest();
      }
      return true;
    },
    /**
     * Clears the current thread so the next message starts a new conversation.
     *
     * @param {boolean} [includeContext=true] - Whether to add configured study context.
     * @returns {void}
     */
    startNewConversation(includeContext = true) {
      if (this.isBusy || this.readOnly || (this.loadFailed && !this.conversationSnapshot.models.length)) {
        return;
      }
      this.stopRecovery();
      this.snapshotLoadId += 1;
      this.autoRetry = null;
      this.loadFailed = false;
      this.requestFailureKey = "";
      const {defaultModelId, models} = this.conversationSnapshot;
      this.selectedModelId = defaultModelId || models[0]?.id || null;
      this.newConversationSelected = true;
      this.setConversationSnapshot({activeConversationId: null, includeContext, messages: [], contextNearLimit: false});
      this.$refs.composer?.clearQuote();
      this.errorMessage = "";
      this.$refs.composer?.focus();
    },
    /**
     * Loads a past conversation selected from the history menu.
     *
     * @param {number} conversationId - Conversation to open.
     * @returns {void}
     */
    selectConversation(conversationId) {
      this.stopRecovery();
      this.loadConversation({conversationId});
    },
    /**
     * Reloads a failed snapshot: the student's manual retry, or the history
     * strip's one automatic retry while that failed load is still current.
     * @param {Object|null} failure - Automatic retry details, or null for a manual retry.
     * @returns {Promise<boolean>|undefined} Whether the snapshot loaded.
     */
    retryLoadConversation(failure) {
      if (!failure) {
        return this.loadConversation({conversationId: this.newConversationSelected ? null : this.failedLoadConversationId});
      }
      if (failure === this.autoRetry && this.isCurrentSnapshotLoad(failure.context)) {
        return this.loadConversation({silent: failure.silent, conversationId: failure.conversationId, retry: true});
      }
    },
    /**
     * Refreshes a retained pane when its study step becomes current again.
     * @param {number|null} conversationId - Explicitly selected history conversation, or null for the latest.
     * @returns {void}
     */
    refreshOnReturn(conversationId) {
      if (!this.activeRequest && !this.recoverableRequest) {
        this.loadConversation({conversationId});
      }
    },
    /**
     * Keeps the current selected model if it is still available.
     *
     * @param {number|null} defaultModelId - Default model id from the backend.
     * @returns {number|null} Selected model id.
     */
    resolveSelectedModel(defaultModelId) {
      const modelIds = this.conversationSnapshot.models.map((model) => Number(model.id));
      if (modelIds.includes(Number(this.selectedModelId))) {
        return Number(this.selectedModelId);
      }
      return defaultModelId || null;
    },
    /**
     * Sends one composed turn into the open (or a new) conversation.
     *
     * @param {Object} turn - Send request built by the composer.
     * @returns {void}
     */
    sendMessage(turn) {
      if (!this.canSubmit || !turn.content) {
        return;
      }
      this.scrollToBottom({force: true});
      this.errorMessage = "";
      const {activeConversationId: conversationId, includeContext} = this.conversationSnapshot;
      this.startRequest({...turn, conversationId, includeContext});
    },
    /**
     * Retries an assistant message; the transcript only offers the current
     * retryable message (none in read-only mode) while the chat is idle.
     *
     * @param {Object} message - Assistant message.
     * @returns {void}
     */
    retryMessage(message) {
      this.errorMessage = "";
      this.startRequest({type: "retry", requestId: this.$aiAssistant.createRequestId(), assistantMessageId: message.id});
    },
    /**
     * Applies one completed assistant request.
     *
     * @param {Object} result - Backend response.
     * @returns {void}
     */
    handleRequestComplete(result) {
      this.applyConversationResult(result);
      this.newConversationSelected = false;
      this.acceptPendingInput(this.activeRequest);
      this.clearActiveRequest();
      this.errorMessage = "";
      this.scrollToBottom();
      this.$refs.composer?.focus();
    },
    /**
     * Clears only the submitted draft after its user row was accepted.
     * @param {Object} request - Accepted request.
     * @returns {void}
     */
    acceptPendingInput(request) {
      if (request?.type === "send") {
        this.$refs.composer?.clearSubmitted(request);
      }
    },
    /**
     * Re-fetches the conversation snapshot (aiRequestMixin contract).
     *
     * @param {Object} [options] - Loading options.
     * @returns {Promise<boolean>}
     */
    reloadConversation(options) {
      return this.loadConversation(options);
    },
    /** Clears the pending draft state (aiRequestMixin contract). */
    resetPending() {
      this.$refs.body?.acceptPending();
    },
  },
};
</script>

<style scoped>
.ai-conversation {
  /* Fill the sidebar pane top-to-bottom so scrolling stays inside the
     chat body and the composer is always pinned at the bottom. */
  position: absolute;
  inset: 0;
  overflow: hidden;
}
</style>
