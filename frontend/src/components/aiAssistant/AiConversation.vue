<template>
  <div class="ai-conversation d-flex flex-column h-100">
    <AiConversationHeader
        :conversations="conversations"
        :active-conversation-id="activeConversationId"
        :busy="isBusy"
        :read-only="readOnly"
        @new="startNewConversation"
        @select="selectConversation"
    />

    <AiConversationBody
        ref="body"
        :messages="visibleMessages"
        :loading="loading"
        :busy="isBusy"
        :retryable-message-id="retryableMessageId"
        @retry="retryMessage"
    />

    <AiConversationComposer
        v-model="draft"
        v-model:selected-model-id="selectedModelId"
        :models="models"
        :error-message="errorMessage"
        :busy="isBusy"
        :sending="sending"
        :aborting="aborting"
        :pending="!!activeRequest"
        :read-only="readOnly"
        :quote="quote"
        @send="sendMessage"
        @abort="abortMessage"
        @clear-quote="clearQuote"
    />

    <AiAssistantRequest
        v-if="activeRequest"
        :key="activeRequest.requestId"
        ref="aiAssistantRequest"
        :request="activeRequest"
        :conversation-snapshot="conversationSnapshot"
        :study-session-id="studySessionId"
        :study-step-id="studyStepId"
        :document-id="documentId"
        :service="service"
        :study-data="studyData"
        :ordered-study-steps="orderedStudySteps"
        :selected-model-id="selectedModelId"
        @complete="handleRequestComplete"
        @failed="handleRequestFailed"
    />
  </div>
</template>

<script>
import AiAssistantRequest from "@/basic/service/AiAssistantRequest.vue";
import AiConversationHeader from "@/components/aiAssistant/AiConversationHeader.vue";
import AiConversationBody from "@/components/aiAssistant/AiConversationBody.vue";
import AiConversationComposer from "@/components/aiAssistant/AiConversationComposer.vue";

const MESSAGE_ROLES = Object.freeze({
  USER: 1,
  ASSISTANT: 2,
});

const MESSAGE_STATUSES = Object.freeze({
  PENDING: 0,
  COMPLETED: 1,
  FAILED: 2,
  ABORTED: 3,
});

const emptyConversationSnapshot = () => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  introducedContextStepIds: [],
  models: [],
  defaultModelId: null,
});

/**
 * Study AI conversation panel.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "AiConversation",
  components: {
    AiAssistantRequest,
    AiConversationHeader,
    AiConversationBody,
    AiConversationComposer,
  },
  props: {
    studySessionId: {
      type: Number,
      required: true,
    },
    studyStepId: {
      type: Number,
      required: true,
    },
    documentId: {
      type: Number,
      required: true,
    },
    service: {
      type: Object,
      required: true,
    },
    studyData: {
      type: Object,
      required: true,
    },
    orderedStudySteps: {
      type: Array,
      required: true,
    },
    readOnly: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    return {
      conversationSnapshot: emptyConversationSnapshot(),
      selectedModelId: null,
      draft: "",
      quote: null,
      activeRequest: null,
      loading: false,
      aborting: false,
      pendingContent: "",
      errorMessage: "",
    };
  },
  computed: {
    conversations() {
      return this.conversationSnapshot.conversations || [];
    },
    activeConversationId() {
      return this.conversationSnapshot.activeConversationId;
    },
    introducedContextStepIds() {
      return this.conversationSnapshot.introducedContextStepIds || [];
    },
    messages() {
      return this.conversationSnapshot.messages || [];
    },
    models() {
      return this.conversationSnapshot.models || [];
    },
    isBusy() {
      return this.loading || this.sending || this.aborting;
    },
    sending() {
      return !!this.activeRequest && !this.aborting;
    },
    latestAssistantId() {
      const assistants = this.messages.filter(
          (message) => Number(message.role) === MESSAGE_ROLES.ASSISTANT
      );
      return assistants.length ? Number(assistants[assistants.length - 1].id) : null;
    },
    retryableMessageId() {
      const latest = this.messages.find(
          (message) => Number(message.id) === this.latestAssistantId
      );
      if (!latest) return null;
      const status = Number(latest.status);
      return [MESSAGE_STATUSES.FAILED, MESSAGE_STATUSES.ABORTED].includes(status)
          ? Number(latest.id)
          : null;
    },
    visibleMessages() {
      if (!this.pendingContent) return this.messages;
      return [
        ...this.messages,
        {
          id: "pending-user",
          role: MESSAGE_ROLES.USER,
          content: this.pendingContent,
          status: MESSAGE_STATUSES.COMPLETED,
        },
        {
          id: "pending-assistant",
          role: MESSAGE_ROLES.ASSISTANT,
          content: "",
          status: MESSAGE_STATUSES.PENDING,
        },
      ];
    },
    canSend() {
      return (
          !this.readOnly &&
          !this.isBusy &&
          !!this.selectedModelId &&
          this.draft.trim().length > 0
      );
    },
  },
  watch: {
    studySessionId() {
      this.loadConversation();
    },
    studyStepId() {
      this.loadConversation();
    },
  },
  created() {
    // Reading selections are broadcast globally; keep only this step's quotes.
    this.eventBus.on("aiChatQuote", this.onQuote);
  },
  mounted() {
    this.loadConversation();
  },
  beforeUnmount() {
    this.eventBus.off("aiChatQuote", this.onQuote);
  },
  methods: {
    /**
     * Updates the loaded conversation snapshot.
     *
     * @param {Object} values - Snapshot fields to replace.
     * @returns {void}
     */
    setConversationSnapshot(values) {
      this.conversationSnapshot = {
        ...this.conversationSnapshot,
        ...values,
      };
    },
    /**
     * Loads the latest conversation snapshot for the current study step.
     *
     * @returns {Promise<void>}
     */
    async loadConversation({silent = false} = {}) {
      // Silent refresh re-syncs server state after an error without the
      // full-screen spinner or clearing the error already shown to the user.
      if (!silent) {
        this.loading = true;
        this.errorMessage = "";
      }
      try {
        const result = await this.$aiAssistant.getConversation({
          studySessionId: this.studySessionId,
          studyStepId: this.studyStepId,
          conversationId: this.activeConversationId,
        });
        this.setConversationSnapshot({
          activeConversationId: result.activeConversationId,
          conversations: result.conversations || [],
          introducedContextStepIds: result.introducedContextStepIds || [],
          messages: result.messages || [],
          models: result.models || [],
          defaultModelId: result.defaultModelId || null,
        });
        this.selectedModelId = this.resolveSelectedModel(result.defaultModelId);
      } catch (error) {
        this.errorMessage = error.message || "Failed to load AI chat";
      } finally {
        if (!silent) this.loading = false;
        // Scroll after loading clears so the messages are rendered, not the spinner.
        this.scrollToBottom();
      }
    },
    /**
     * Clears the current thread so the next message starts a new conversation.
     *
     * @returns {void}
     */
    startNewConversation() {
      if (this.isBusy) return;
      this.setConversationSnapshot({
        activeConversationId: null,
        messages: [],
        introducedContextStepIds: [],
      });
      this.pendingContent = "";
      this.quote = null;
      this.errorMessage = "";
    },
    /**
     * Adds a newly created conversation to the history list so it shows up
     * without a full reload. The backend re-sorts the list on the next load.
     *
     * @param {number} conversationId - Conversation returned by the send.
     * @param {string} [createdAt] - Server timestamp of the first message.
     * @param {string} [title] - First message text, used as the list label.
     * @returns {void}
     */
    ensureConversationListed(conversationId, createdAt, title) {
      if (!conversationId) return;
      const id = Number(conversationId);
      if (this.conversations.some((conversation) => Number(conversation.id) === id)) return;
      const timestamp = createdAt || new Date().toISOString();
      this.setConversationSnapshot({
        conversations: [
          {id, createdAt: timestamp, updatedAt: timestamp, title: title || null},
          ...this.conversations,
        ],
      });
    },
    /**
     * Loads a past conversation selected from the history menu.
     *
     * @param {number} conversationId - Conversation to open.
     * @returns {void}
     */
    selectConversation(conversationId) {
      if (this.isBusy || conversationId === this.activeConversationId) return;
      this.setConversationSnapshot({activeConversationId: conversationId});
      this.loadConversation();
    },
    /**
     * Keeps the current selected model if it is still available.
     *
     * @param {number|null} defaultModelId - Default model id from the backend.
     * @returns {number|null} Selected model id.
     */
    resolveSelectedModel(defaultModelId) {
      const modelIds = this.models.map((model) => Number(model.id));
      if (modelIds.includes(Number(this.selectedModelId))) {
        return Number(this.selectedModelId);
      }
      return defaultModelId || null;
    },
    /**
     * Stores a reading selection quoted into this step's chat.
     *
     * @param {Object} payload - Quote payload from the reader.
     * @param {string} payload.text - Selected text.
     * @param {number} payload.studyStepId - Originating study step.
     * @param {number} payload.documentId - Originating document.
     * @param {Object} payload.selectors - Anchoring selectors for the selected text.
     * @returns {void}
     */
    onQuote({text, studyStepId, documentId, selectors}) {
      if (Number(studyStepId) !== Number(this.studyStepId)) return;
      const quoteText = (text || "").trim();
      this.quote = quoteText ? {text: quoteText, studyStepId, documentId, selectors} : null;
    },
    /**
     * Clears the pending quote.
     *
     * @returns {void}
     */
    clearQuote() {
      this.quote = null;
    },
    /**
     * Renders a quote as a markdown blockquote for the outgoing message.
     *
     * @param {string} text - Quoted text.
     * @returns {string} Blockquote-prefixed text.
     */
    formatQuote(text) {
      return text.split("\n").map((line) => `> ${line}`).join("\n");
    },
    /**
     * Sends the current draft as one conversation turn.
     *
     * @returns {Promise<void>}
     */
    async sendMessage() {
      if (!this.canSend) return;
      const question = this.draft.trim();
      const quote = this.quote;
      const content = quote ? `${this.formatQuote(quote.text)}\n\n${question}` : question;
      const requestId = this.$aiAssistant.createRequestId();
      this.draft = "";
      this.quote = null;
      this.pendingContent = content;
      this.scrollToBottom();
      this.errorMessage = "";
      this.activeRequest = {
        type: "send",
        requestId,
        conversationId: this.activeConversationId,
        content: question,
        quote,
      };
    },
    /**
     * Retries the selected assistant message.
     *
     * @param {Object} message - Assistant message.
     * @returns {Promise<void>}
     */
    async retryMessage(message) {
      this.errorMessage = "";
      const requestId = this.$aiAssistant.createRequestId();
      this.activeRequest = {
        type: "retry",
        requestId,
        assistantMessageId: message.id,
      };
    },
    /**
     * Aborts the currently pending assistant request.
     *
     * @returns {Promise<void>}
     */
    async abortMessage() {
      if (!this.activeRequest) return;
      this.aborting = true;
      try {
        const request = this.$refs.aiAssistantRequest;
        if (!request) return;
        await request.abortRequest();
        await this.loadConversation({silent: true});
        this.clearActiveRequest();
      } catch (error) {
        this.errorMessage = error.message || "Failed to abort AI chat request";
      } finally {
        this.aborting = false;
      }
    },
    /**
     * Applies one completed assistant request.
     *
     * @param {Object} result - Backend response.
     * @returns {void}
     */
    handleRequestComplete(result) {
      const request = this.activeRequest;
      this.setConversationSnapshot({
        activeConversationId: result.conversationId || this.activeConversationId,
      });
      this.upsertMessages([result.userMessage, result.assistantMessage]);
      if (request?.type === "send") {
        this.markCurrentStepIntroduced();
        this.ensureConversationListed(
            result.conversationId,
            result.userMessage?.createdAt,
            this.pendingContent,
        );
      }
      this.clearActiveRequest();
    },
    /**
     * Handles one failed assistant request.
     *
     * @param {Error} error - Request error.
     * @returns {Promise<void>}
     */
    async handleRequestFailed(error) {
      this.errorMessage = error.message || "AI chat request failed";
      await this.loadConversation({silent: true});
      this.clearActiveRequest();
    },
    /**
     * Clears the pending request state.
     *
     * @returns {void}
     */
    clearActiveRequest() {
      this.activeRequest = null;
      this.aborting = false;
      this.pendingContent = "";
    },
    /**
     * Inserts or replaces returned messages.
     *
     * @param {Object[]} messages - Messages returned by the backend.
     * @returns {void}
     */
    upsertMessages(messages) {
      const byId = new Map(this.messages.map((message) => [Number(message.id), message]));
      messages.filter(Boolean).forEach((message) => {
        byId.set(Number(message.id), message);
      });
      this.setConversationSnapshot({
        messages: [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id)),
      });
      this.scrollToBottom();
    },
    /**
     * Marks the current step context as introduced after a successful turn.
     *
     * @returns {void}
     */
    markCurrentStepIntroduced() {
      const stepId = Number(this.studyStepId);
      if (!this.introducedContextStepIds.includes(stepId)) {
        this.setConversationSnapshot({
          introducedContextStepIds: [...this.introducedContextStepIds, stepId],
        });
      }
    },
    /**
     * Scrolls the message list to the newest message.
     *
     * @returns {void}
     */
    scrollToBottom() {
      this.$nextTick(() => {
        this.$refs.body?.scrollToBottom();
      });
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
