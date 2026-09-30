<template>
  <ConversationBodyShell
      ref="shell"
      :loading="loading"
      :empty="messages.length === 0"
      loading-text="Loading Dialogue..."
      empty-title="No Dialogue question available"
  >
    <template v-for="item in dialogueTurns" :key="item.id">
      <DialogueQuestion
          v-if="item.type === 'question'"
          :turn="item"
          :read-only="readOnly"
          :is-busy="busy"
          :active-request="activeRequest"
          :sending="sending"
          :aborting="aborting"
          :active-question-message-id="activeQuestionMessageId"
          :retryable-message-id="retryableMessageId"
          :allow-skip="allowSkip"
          @send="$emit('send', $event)"
          @abort="$emit('abort')"
          @retry="$emit('retry', $event)"
          @typing-started="$emit('typing-started', $event)"
          @paste="$emit('paste', $event)"
      />
      <AiConversationMessage
          v-else
          :message="item.message"
          :retryable="retryableMessageId === Number(item.message.id)"
          :busy="busy"
          @retry="$emit('retry', $event)"
      />
    </template>
  </ConversationBodyShell>
</template>

<script>
import ConversationBodyShell from "@/components/aiAssistant/ConversationBodyShell.vue";
import AiConversationMessage from "@/components/aiAssistant/AiConversationMessage.vue";
import DialogueQuestion from "@/components/dialogue/DialogueQuestion.vue";
import {buildDialogueTurns} from "@/components/dialogue/dialogueMessages.js";

/**
 * Scrollable Dialogue message body.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "DialogueConversationBody",
  components: {ConversationBodyShell, AiConversationMessage, DialogueQuestion},
  props: {
    messages: {
      type: Array,
      required: true,
    },
    loading: {
      type: Boolean,
      required: false,
      default: false,
    },
    busy: {
      type: Boolean,
      required: false,
      default: false,
    },
    readOnly: {
      type: Boolean,
      required: false,
      default: false,
    },
    activeRequest: {
      type: Object,
      required: false,
      default: null,
    },
    sending: {
      type: Boolean,
      required: false,
      default: false,
    },
    aborting: {
      type: Boolean,
      required: false,
      default: false,
    },
    activeQuestionMessageId: {
      type: [String, Number],
      required: false,
      default: null,
    },
    retryableMessageId: {
      type: Number,
      required: false,
      default: null,
    },
    allowSkip: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  emits: ["send", "abort", "retry", "typing-started", "paste"],
  computed: {
    dialogueTurns() {
      return buildDialogueTurns(this.messages);
    },
  },
  methods: {
    /**
     * Scrolls to the newest visible message.
     *
     * @returns {void}
     */
    scrollToBottom() {
      this.$refs.shell?.scrollToBottom();
    },
  },
};
</script>
