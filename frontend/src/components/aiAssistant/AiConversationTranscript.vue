<template>
    <AiConversationBody
        ref="body"
        :follow-latest="true"
        :loading="loading"
        :empty="visibleMessages.length === 0"
        :loading-text="$t('ai.chat.loading')"
        :empty-title="snapshot.includeContext !== false ? $t('ai.chat.startStudyChat') : $t('ai.chat.startFreshConversation')"
        :empty-subtitle="snapshot.includeContext !== false
            ? $t('ai.chat.studyChatDescription')
            : $t('ai.chat.freshChatDescription')"
    >
      <AiConversationMessage
          v-for="message in visibleMessages"
          :key="message.id"
          :message="message"
          :retryable="retryableMessageId === Number(message.id)"
          :is-busy="isBusy"
          @retry="retry"
          @copy="$emit('stat', 'aiChatAssistantCopy', $event)"
      />
    </AiConversationBody>
</template>
<script>
import AiConversationBody from './AiConversationBody.vue';
import AiConversationMessage from './AiConversationMessage.vue';
import {AI_MESSAGE_ROLES, AI_MESSAGE_STATUSES} from '@/assets/aiMessageTypes';

/**
 * Chat message list: saved rows, the local pending turn, and the live
 * streamed preview of the active request's assistant reply. The pending turn
 * shows the active send request until the parent reports its user row as
 * persisted (acceptPending) or the request ends.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: 'AiConversationTranscript', components: {AiConversationBody, AiConversationMessage},
  inject: {studySessionId: {default: null}},
  props: {
    activeRequest: {type: Object, default: null},
    aborting: {type: Boolean, default: false},
    studyStepId: {type: Number, required: true},
    /** Conversation snapshot; read for the active conversation and context mode. */
    snapshot: {type: Object, required: true},
    loading: {type: Boolean, default: false},
    isBusy: {type: Boolean, default: false},
    retryableMessageId: {type: Number, default: null}
  },
  emits: ['retry', 'stat', 'accepted-input'],
  data() {
    return {acceptedRequestId: null, streamRequestId: null, streamTarget: null, streamText: '', streamBuffer: '', streamFrame: null};
  },
  computed: {
    messages() {
      return this.snapshot.messages || [];
    },
    pendingContent() {
      const request = this.activeRequest;
      return request?.type === "send" && request.requestId !== this.acceptedRequestId ? request.submittedContent : "";
    },
    visibleMessages() {
      if (!this.pendingContent) {
        return this.withStreamingMessage(this.messages);
      }
      return this.withStreamingMessage([
        ...this.messages,
        {
          id: "pending-user",
          role: AI_MESSAGE_ROLES.USER,
          content: this.pendingContent,
          status: AI_MESSAGE_STATUSES.COMPLETED,
        },
        {
          id: "pending-assistant",
          role: AI_MESSAGE_ROLES.ASSISTANT,
          content: "",
          status: AI_MESSAGE_STATUSES.PENDING,
        },
      ]);
    }
  },
  watch: {
    aborting(aborting) {
      if (aborting) {
        this.clearStream();
      }
    },
    activeRequest(request) {
      this.clearStream();
      this.streamRequestId = request?.requestId || null;
    }
  },
  sockets: {
    serviceRefresh(data) {
      this.handleConversationDelta(data);
    },
    disconnect() {
      this.clearStream();
    },
  },
  beforeUnmount() {this.clearStream();},
  methods: {
    scrollToBottom(options) {this.$refs.body?.scrollToBottom(options);},
    /** Hides the pending turn once its user row is persisted. */
    acceptPending() {
      this.acceptedRequestId = this.activeRequest?.requestId ?? null;
    },
    /**
     * Reports and requests a retry of the retryable assistant message.
     * @param {Object} message - Assistant message.
     * @returns {void}
     */
    retry(message) {
      if (this.isBusy || Number(message?.id) !== this.retryableMessageId) {
        return;
      }
      this.$emit("stat", "aiChatRetryClick", {assistantMessageId: message.id});
      this.$emit("retry", message);
    },
    /**
     * Accepts only text belonging to this screen's current request.
     * @param {Object} event - Service refresh envelope.
     * @returns {void}
     */
    handleConversationDelta({service, type, data} = {}) {
      if (service !== "AIAssistantService" || type !== "conversationDelta") {
        return;
      }
      const request = this.activeRequest;
      if (!request || !this.streamRequestId || data?.requestId !== this.streamRequestId
          || Number(data.studySessionId) !== this.studySessionId || Number(data.studyStepId) !== this.studyStepId
          || typeof data.text !== "string" || !data.text) {
        return;
      }
      const conversationId = this.streamTarget?.conversationId || request.conversationId || this.snapshot.activeConversationId;
      const assistantMessageId = this.streamTarget?.assistantMessageId || request.assistantMessageId;
      if ((conversationId && Number(data.conversationId) !== Number(conversationId))
          || (assistantMessageId && Number(data.assistantMessageId) !== Number(assistantMessageId))) {
        return;
      }
      this.$emit("accepted-input", request);
      this.streamTarget = {conversationId: data.conversationId, assistantMessageId: data.assistantMessageId};
      this.streamBuffer += data.text;
      if (this.streamFrame !== null) {
        return;
      }
      this.streamFrame = requestAnimationFrame(() => {
        this.streamText += this.streamBuffer;
        this.streamBuffer = "";
        this.streamFrame = null;
        this.scrollToBottom();
      });
    },
    /**
     * Overlays the preview on the pending row without changing saved history.
     * @param {Object[]} messages - Saved rows and optional local placeholders.
     * @returns {Object[]} Visible messages.
     */
    withStreamingMessage(messages) {
      if (!this.activeRequest) {
        return messages;
      }
      const assistantId = this.streamTarget?.assistantMessageId || this.activeRequest.assistantMessageId;
      return messages.map((message) => {
        const matches = message.id === "pending-assistant" || (assistantId && Number(message.id) === Number(assistantId));
        if (!matches || Number(message.role) !== AI_MESSAGE_ROLES.ASSISTANT
            || Number(message.status) === AI_MESSAGE_STATUSES.COMPLETED) {
          return message;
        }
        return {...message, status: AI_MESSAGE_STATUSES.PENDING, content: this.streamText};
      });
    },
    /** Discards partial text; a new request is needed to accept more deltas. */
    clearStream() {
      if (this.streamFrame !== null) {
        cancelAnimationFrame(this.streamFrame);
      }
      this.streamFrame = null;
      this.streamRequestId = null;
      this.streamTarget = null;
      this.streamText = "";
      this.streamBuffer = "";
    }
  },
};
</script>
