<template>
  <div ref="messageList" class="conversation-body flex-grow-1 p-3">
    <div
        v-if="loading"
        class="conversation-state text-center text-muted"
    >
      <div class="spinner-border spinner-border-sm mb-2" role="status">
        <span class="visually-hidden">Loading chat...</span>
      </div>
      <div>Loading chat...</div>
    </div>

    <div
        v-else-if="messages.length === 0"
        class="conversation-state text-center text-muted"
    >
      <div class="empty-icon rounded-circle mx-auto mb-3">
        <BasicIcon icon-name="chat-dots" :size="28" />
      </div>
      <div class="fw-semibold text-body">Start a study chat</div>
      <div class="small mt-1">
        Ask about the current document or previous step context.
      </div>
    </div>

    <template v-else>
      <AiConversationMessage
          v-for="message in messages"
          :key="message.id"
          :message="message"
          :retryable="retryableMessageId === Number(message.id)"
          :busy="busy"
          @retry="$emit('retry', $event)"
          @copy="$emit('copy', $event)"
      />
    </template>
  </div>
</template>

<script>
import BasicIcon from "@/basic/Icon.vue";
import AiConversationMessage from "@/components/aiAssistant/AiConversationMessage.vue";

/**
 * Scrollable AI conversation message body.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "AiConversationBody",
  components: {AiConversationMessage, BasicIcon},
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
      this.$nextTick(() => {
        const list = this.$refs.messageList;
        if (list) list.scrollTop = list.scrollHeight;
      });
    },
  },
};
</script>

<style scoped>
.conversation-body {
  min-height: 0;
  overflow-y: auto;
  background: var(--bs-body-bg);
}

.conversation-state {
  display: flex;
  min-height: 260px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-icon {
  display: flex;
  width: 56px;
  height: 56px;
  align-items: center;
  justify-content: center;
  background: var(--bs-secondary-bg);
}
</style>
