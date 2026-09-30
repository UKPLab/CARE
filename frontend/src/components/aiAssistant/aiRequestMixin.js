import {MESSAGE_ROLES, MESSAGE_STATUSES} from "@/components/aiAssistant/messageConstants";
import {resolveApiMessage} from "@/assets/utils";

/**
 * Shared request lifecycle for AI conversation surfaces (chat and dialogue).
 *
 * Hosts provide conversationSnapshot, reloadConversation, resetPending, and error text.
 * Chat additionally clears accepted drafts through acceptPendingInput.
 *
 * @author Mohammed Rawhani
 */
export default {
  data() {
    return {
      activeRequest: null,
      loading: false,
      aborting: false,
      errorMessage: "",
      snapshotLoadId: 0,
      recoverableRequest: null,
      recoveryTimer: null,
      recovering: false,
    };
  },
  computed: {
    messages() {
      return this.conversationSnapshot.messages || [];
    },
    activeConversationId() {
      return this.conversationSnapshot.activeConversationId;
    },
    sending() {
      return !!this.activeRequest && !this.aborting;
    },
    isBusy() {
      return this.loading || !!this.activeRequest
          || this.messages.some((message) => Number(message.status) === MESSAGE_STATUSES.PENDING);
    },
    latestAssistantId() {
      const assistants = this.messages.filter(
          (message) => Number(message.role) === MESSAGE_ROLES.ASSISTANT
      );
      return assistants.length ? Number(assistants[assistants.length - 1].id) : null;
    },
    retryableMessageId() {
      if (this.readOnly) return null;
      const latest = this.messages.find(
          (message) => Number(message.id) === this.latestAssistantId
      );
      if (!latest) return null;
      return [MESSAGE_STATUSES.FAILED, MESSAGE_STATUSES.ABORTED].includes(Number(latest.status))
          ? Number(latest.id)
          : null;
    },
  },
  beforeUnmount() {
    this.stopRecovery();
    this.snapshotLoadId += 1;
  },
  methods: {
    /** @returns {Object} Current snapshot load context. */
    beginSnapshotLoad() {
      return {
        loadId: ++this.snapshotLoadId,
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId,
        conversationId: this.activeConversationId,
      };
    },
    /**
     * Ignores results from an older load or study context.
     * @param {Object} context - Context captured before loading.
     * @returns {boolean} Whether the result still belongs to this screen.
     */
    isCurrentSnapshotLoad(context) {
      return context.loadId === this.snapshotLoadId
          && context.studySessionId === this.studySessionId
          && context.studyStepId === this.studyStepId
          && context.conversationId === this.activeConversationId;
    },
    /**
     * Merges persisted messages in database order.
     * @param {Object[]} incoming - Updated message rows.
     * @param {Object[]} [existing] - Persisted rows from the same conversation.
     * @returns {Object[]} Ordered persisted messages.
     */
    mergeMessages(incoming, existing = this.messages) {
      const byId = new Map(existing.map((message) => [Number(message.id), message]));
      incoming.filter(Boolean).forEach((message) => byId.set(Number(message.id), message));
      return [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id));
    },
    /**
     * Applies common persisted fields from a completed request.
     * @param {Object} result - Backend completion result.
     * @returns {void}
     */
    applyConversationResult(result) {
      this.stopRecovery();
      const conversationId = result.conversation?.id || result.conversationId || this.activeConversationId;
      const existing = Number(conversationId) === Number(this.activeConversationId) ? this.messages : [];
      const conversations = new Map((this.conversationSnapshot.conversations || [])
          .map((conversation) => [Number(conversation.id), conversation]));
      if (result.conversation) conversations.set(Number(result.conversation.id), result.conversation);
      this.snapshotLoadId += 1;
      this.loading = false;
      this.conversationSnapshot = {
        ...this.conversationSnapshot,
        activeConversationId: conversationId,
        includeContext: result.conversation?.includeContext ?? this.conversationSnapshot.includeContext ?? true,
        conversations: [...conversations.values()].sort((a, b) =>
          new Date(b.updatedAt) - new Date(a.updatedAt) || Number(b.id) - Number(a.id)),
        messages: result.messages || this.mergeMessages([result.userMessage, result.assistantMessage], existing),
      };
    },
    /**
     * Captures the persisted boundary before sending or retrying.
     * @param {Object} request - Outgoing local request.
     * @returns {void}
     */
    startRequest(request) {
      this.snapshotLoadId += 1;
      this.loading = false;
      this.stopRecovery();
      this.activeRequest = {
        ...request,
        previousMessageId: Math.max(0, ...this.messages.map((message) => Number(message.id))),
        previousAssistantUpdatedAt: this.messages.find((message) =>
          Number(message.id) === Number(request.assistantMessageId))?.updatedAt,
      };
    },
    /**
     * Reconciles a request against messages received from the server.
     * @param {Object} request - Active or recoverable request.
     * @returns {boolean} Whether the assistant outcome is persisted.
     */
    reconcileRequest(request = this.activeRequest || this.recoverableRequest) {
      if (!request) {
        // A pending row without a local request comes from a reload during a response.
        this.scheduleRecovery();
        return false;
      }
      const user = request.type === "send" && this.messages.find((message) =>
        Number(message.role) === MESSAGE_ROLES.USER
          && Number(message.id) > request.previousMessageId
          && message.content === request.submittedContent
          && (!request.questionId || String(message.metadata?.dialogue?.questionId) === String(request.questionId)));
      const assistant = this.messages.find((message) =>
        Number(message.role) === MESSAGE_ROLES.ASSISTANT
          && (request.type === "retry"
            ? Number(message.id) === Number(request.assistantMessageId)
            : user && Number(message.id) > Number(user.id)));
      if (user) {
        this.acceptPendingInput?.(request);
        this.resetPending();
        request.accepted = true;
      }
      const settled = !!assistant && (request.type !== "retry" || assistant.updatedAt !== request.previousAssistantUpdatedAt)
          && Number(assistant.status) !== MESSAGE_STATUSES.PENDING;
      if (settled && this.recoverableRequest === request) {
        if (!this.activeRequest) this.errorMessage = "";
        this.stopRecovery();
      } else {
        this.scheduleRecovery();
      }
      return settled;
    },
    /** Clears scheduled recovery when leaving a request or study context. */
    stopRecovery() {
      if (this.recoveryTimer !== null) clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
      this.recoverableRequest = null;
    },
    /**
     * Reloads while a persisted response is pending and no local request is active.
     * Ends on its own: the backend fails pending rows on timeout or restart.
     */
    scheduleRecovery() {
      if (this.activeRequest || this.recoveryTimer !== null || this.recovering) return;
      if (!this.messages.some((message) => Number(message.role) === MESSAGE_ROLES.ASSISTANT
          && Number(message.status) === MESSAGE_STATUSES.PENDING)) return;
      this.recoveryTimer = setTimeout(async () => {
        this.recoveryTimer = null;
        this.recovering = true;
        try {
          await this.reloadConversation({silent: true});
        } finally {
          this.recovering = false;
          this.scheduleRecovery();
        }
      }, 2000);
    },

    /**
     * Scrolls the message body to the newest message.
     *
     * @returns {void}
     */
    scrollToBottom() {
      this.$nextTick(() => {
        this.$refs.body?.scrollToBottom();
      });
    },
    /**
     * Clears the pending request and the host's pending draft/answer state.
     *
     * @returns {void}
     */
    clearActiveRequest() {
      this.activeRequest = null;
      this.aborting = false;
      this.resetPending();
      this.scheduleRecovery();
    },
    /**
     * Handles one failed assistant request by re-syncing server state.
     *
     * @param {Error} error - Request error.
     * @returns {Promise<void>}
     */
    async handleRequestFailed(error) {
      const request = this.activeRequest;
      if (!request) return;
      const dispatched = this.$refs.aiAssistantRequest?.dispatched;
      this.errorMessage = error.key || error.message ? resolveApiMessage(error) : this.requestFailedText;
      if (dispatched) {
        this.recoverableRequest = request;
        await this.reloadConversation({silent: true});
      }
      if (this.activeRequest !== request) return;
      if (dispatched && !this.reconcileRequest(request)) {
        this.errorMessage += !request.accepted
            ? " The outcome could not be confirmed. Your input is retained; refresh before sending again."
            : " Your answer was saved. Checking the response outcome.";
      }
      this.clearActiveRequest();
    },
    /**
     * Aborts the currently pending assistant request.
     *
     * @returns {Promise<void>}
     */
    async abortActiveRequest() {
      if (!this.activeRequest || this.aborting) return;
      const activeRequest = this.activeRequest;
      this.aborting = true;
      try {
        this.onBeforeAbort?.();
        const request = this.$refs.aiAssistantRequest;
        const result = request ? await request.abortRequest() : {aborted: true, local: true};
        if (this.activeRequest !== activeRequest) return;
        if (!result?.local) {
          this.recoverableRequest = activeRequest;
          await this.reloadConversation({silent: true});
        }
        if (this.activeRequest !== activeRequest) return;
        if (result?.aborted || this.reconcileRequest(activeRequest)) {
          this.clearActiveRequest();
        } else {
          this.errorMessage = "Stop was not confirmed. Waiting for the request outcome.";
        }
      } catch (error) {
        if (this.activeRequest !== activeRequest) return;
        await this.reloadConversation({silent: true});
        if (this.activeRequest !== activeRequest) return;
        if (this.reconcileRequest(activeRequest)) this.clearActiveRequest();
        else this.errorMessage = `${error.key || error.message ? resolveApiMessage(error) : this.abortFailedText}. Stop was not confirmed; waiting for the request outcome.`;
      } finally {
        if (this.activeRequest === activeRequest) this.aborting = false;
      }
    },
  },
};
