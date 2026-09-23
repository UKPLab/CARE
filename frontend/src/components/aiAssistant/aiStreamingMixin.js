import {MESSAGE_ROLES, MESSAGE_STATUSES} from "./messageConstants.js";

/**
 * Temporary AI Chat text, separate from persisted conversation messages.
 * @author Mohammed Rawhani
 */
export default {
  data() {
    return {
      streamRequestId: null,
      streamTarget: null,
      streamText: "",
      streamBuffer: "",
      streamFrame: null,
    };
  },
  watch: {
    aborting: {
      flush: "sync",
      handler(aborting) {
        if (aborting) this.clearStream();
      },
    },
    activeRequest: {
      flush: "sync",
      handler(request) {
        this.clearStream();
        this.streamRequestId = request?.requestId || null;
      },
    },
  },
  beforeUnmount() {
    this.clearStream();
  },
  methods: {
    /**
     * Accepts only text belonging to this screen's current request.
     * @param {Object} event - Service refresh envelope.
     * @returns {void}
     */
    handleConversationDelta({service, type, data} = {}) {
      if (service !== "AIAssistantService" || type !== "conversationDelta") return;
      const request = this.activeRequest;
      if (!request || !this.streamRequestId || data?.requestId !== this.streamRequestId
          || Number(data.studySessionId) !== this.studySessionId || Number(data.studyStepId) !== this.studyStepId
          || typeof data.text !== "string" || !data.text) return;
      const conversationId = this.streamTarget?.conversationId || request.conversationId || this.activeConversationId;
      const assistantMessageId = this.streamTarget?.assistantMessageId || request.assistantMessageId;
      if ((conversationId && Number(data.conversationId) !== Number(conversationId))
          || (assistantMessageId && Number(data.assistantMessageId) !== Number(assistantMessageId))) return;
      this.streamTarget = {conversationId: data.conversationId, assistantMessageId: data.assistantMessageId};
      this.streamBuffer += data.text;
      if (this.streamFrame !== null) return;
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
      if (!this.activeRequest) return messages;
      const assistantId = this.streamTarget?.assistantMessageId || this.activeRequest.assistantMessageId;
      return messages.map((message) => {
        const matches = message.id === "pending-assistant" || (assistantId && Number(message.id) === Number(assistantId));
        if (!matches || Number(message.role) !== MESSAGE_ROLES.ASSISTANT
            || Number(message.status) === MESSAGE_STATUSES.COMPLETED) return message;
        return {...message, status: MESSAGE_STATUSES.PENDING, content: this.streamText};
      });
    },
    /** Discards partial text; a new request is needed to accept more deltas. */
    clearStream() {
      if (this.streamFrame !== null) cancelAnimationFrame(this.streamFrame);
      this.streamFrame = null;
      this.streamRequestId = null;
      this.streamTarget = null;
      this.streamText = "";
      this.streamBuffer = "";
    },
  },
};
