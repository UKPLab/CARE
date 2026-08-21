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
        :pending="!!pendingRequestId"
        :read-only="readOnly"
        :quote="quote"
        @send="sendMessage"
        @abort="abortMessage"
        @clear-quote="clearQuote"
    />
  </div>
</template>

<script>
import AiConversationHeader from "@/components/aiAssistant/AiConversationHeader.vue";
import AiConversationBody from "@/components/aiAssistant/AiConversationBody.vue";
import AiConversationComposer from "@/components/aiAssistant/AiConversationComposer.vue";
import {buildHookValues} from "@/basic/service/hookInputs";

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

/**
 * Study AI conversation panel.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "AiConversation",
  components: {AiConversationHeader, AiConversationBody, AiConversationComposer},
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
      activeConversationId: null,
      conversations: [],
      introducedContextStepIds: [],
      messages: [],
      models: [],
      selectedModelId: null,
      draft: "",
      quote: null,
      loading: false,
      sending: false,
      aborting: false,
      abortRequested: false,
      pendingRequestId: null,
      pendingContent: "",
      errorMessage: "",
    };
  },
  computed: {
    isBusy() {
      return this.loading || this.sending || this.aborting;
    },
    needsStepContext() {
      return !this.introducedContextStepIds.includes(Number(this.studyStepId));
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
        this.activeConversationId = result.activeConversationId;
        this.conversations = result.conversations || [];
        this.introducedContextStepIds = result.introducedContextStepIds || [];
        this.messages = result.messages || [];
        this.models = result.models || [];
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
      this.activeConversationId = null;
      this.messages = [];
      this.introducedContextStepIds = [];
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
      this.conversations = [
        {id, createdAt: timestamp, updatedAt: timestamp, title: title || null},
        ...this.conversations,
      ];
    },
    /**
     * Loads a past conversation selected from the history menu.
     *
     * @param {number} conversationId - Conversation to open.
     * @returns {void}
     */
    selectConversation(conversationId) {
      if (this.isBusy || conversationId === this.activeConversationId) return;
      this.activeConversationId = conversationId;
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
     * Builds the runtime context needed by mapped hook input resolution.
     *
     * @returns {Object} Hook input context.
     */
    getHookInputContext() {
      return {
        socket: this.$socket,
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId,
        documentId: this.documentId,
        orderedStudySteps: this.orderedStudySteps,
        studyData: this.studyData,
      };
    },
    /**
     * Resolves mapped context only when this step has not introduced it yet.
     *
     * @returns {Promise<Object|null>} Resolved context values.
     */
    async buildContextValues() {
      if (!this.needsStepContext) return null;
      return buildHookValues(this.getHookInputContext(), this.service.inputs || {});
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
      this.draft = "";
      this.quote = null;
      this.pendingContent = content;
      this.scrollToBottom();
      this.errorMessage = "";
      this.sending = true;
      this.abortRequested = false;
      this.pendingRequestId = this.$aiAssistant.createRequestId();

      try {
        const values = await this.buildContextValues();
        const result = await this.$aiAssistant.sendConversationMessage({
          studySessionId: this.studySessionId,
          studyStepId: this.studyStepId,
          conversationId: this.activeConversationId,
          aiModelId: this.selectedModelId,
          requestId: this.pendingRequestId,
          content: question,
          quote,
          values,
        });
        this.activeConversationId = result.conversationId || this.activeConversationId;
        this.upsertMessages([result.userMessage, result.assistantMessage]);
        this.markCurrentStepIntroduced();
        this.ensureConversationListed(
            result.conversationId,
            result.userMessage?.createdAt,
            content,
        );
      } catch (error) {
        if (!this.abortRequested) {
          this.errorMessage = error.message || "AI chat request failed";
        }
        await this.loadConversation({silent: true});
      } finally {
        this.sending = false;
        this.pendingRequestId = null;
        this.pendingContent = "";
      }
    },
    /**
     * Retries the selected assistant message.
     *
     * @param {Object} message - Assistant message.
     * @returns {Promise<void>}
     */
    async retryMessage(message) {
      this.errorMessage = "";
      this.sending = true;
      this.abortRequested = false;
      this.pendingRequestId = this.$aiAssistant.createRequestId();
      try {
        const result = await this.$aiAssistant.retryConversationMessage({
          assistantMessageId: message.id,
          requestId: this.pendingRequestId,
        });
        this.upsertMessages([result.assistantMessage]);
      } catch (error) {
        if (!this.abortRequested) {
          this.errorMessage = error.message || "AI chat retry failed";
        }
        await this.loadConversation({silent: true});
      } finally {
        this.sending = false;
        this.pendingRequestId = null;
      }
    },
    /**
     * Aborts the currently pending assistant request.
     *
     * @returns {Promise<void>}
     */
    async abortMessage() {
      if (!this.pendingRequestId) return;
      this.aborting = true;
      this.abortRequested = true;
      try {
        await this.$aiAssistant.abortConversationMessage({
          requestId: this.pendingRequestId,
        });
      } catch (error) {
        this.errorMessage = error.message || "Failed to abort AI chat request";
      } finally {
        this.aborting = false;
        await this.loadConversation({silent: true});
      }
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
      this.messages = [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id));
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
        this.introducedContextStepIds = [...this.introducedContextStepIds, stepId];
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
