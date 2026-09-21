<template>
  <ConversationBodyShell
      ref="shell"
      :loading="loading"
      :empty="messages.length === 0"
      loading-text="Loading chat..."
      :empty-title="includeContext ? 'Start a study chat' : 'Start a fresh conversation'"
      :empty-subtitle="includeContext
          ? 'Ask about the current document or previous step context.'
          : 'Discuss any topic. No study context is added automatically.'"
  >
    <AiConversationMessage
        v-for="message in messages"
        :key="message.id"
        :message="message"
        :retryable="retryableMessageId === Number(message.id)"
        :busy="busy"
        @retry="$emit('retry', $event)"
        @copy="$emit('copy', $event)"
    />
  </ConversationBodyShell>
</template>

<script>
import ConversationBodyShell from "@/components/aiAssistant/ConversationBodyShell.vue";
import AiConversationMessage from "@/components/aiAssistant/AiConversationMessage.vue";

/**
 * Scrollable AI conversation message body.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "AiConversationBody",
  components: {ConversationBodyShell, AiConversationMessage},
  props: {
    includeContext: {
      type: Boolean,
      required: false,
      default: true,
    },
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
    retryableMessageId: {
      type: Number,
      required: false,
      default: null,
    },
  },
  emits: ["retry", "copy"],
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
