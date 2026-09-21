<template>
  <div ref="messageList" class="conversation-body flex-grow-1 p-3">
    <div
        v-if="loading"
        class="conversation-state text-center text-muted"
    >
      <div class="spinner-border spinner-border-sm mb-2" role="status">
        <span class="visually-hidden">{{ loadingText }}</span>
      </div>
      <div>{{ loadingText }}</div>
    </div>

    <div
        v-else-if="empty"
        class="conversation-state text-center text-muted"
    >
      <div class="empty-icon rounded-circle mx-auto mb-3">
        <BasicIcon :icon-name="emptyIcon" :size="28" />
      </div>
      <div class="fw-semibold text-body">{{ emptyTitle }}</div>
      <div v-if="emptySubtitle" class="small mt-1">{{ emptySubtitle }}</div>
    </div>

    <template v-else>
      <slot />
    </template>
  </div>
</template>

<script>
import BasicIcon from "@/basic/Icon.vue";

/**
 * Scrollable message body shell shared by AI conversation surfaces.
 *
 * Owns the loading state, empty state, scroll container, and scrolling; the
 * host body supplies the message rendering through the default slot.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "ConversationBodyShell",
  components: {BasicIcon},
  props: {
    loading: {
      type: Boolean,
      required: false,
      default: false,
    },
    empty: {
      type: Boolean,
      required: false,
      default: false,
    },
    loadingText: {
      type: String,
      required: false,
      default: "Loading...",
    },
    emptyIcon: {
      type: String,
      required: false,
      default: "chat-dots",
    },
    emptyTitle: {
      type: String,
      required: false,
      default: "",
    },
    emptySubtitle: {
      type: String,
      required: false,
      default: "",
    },
  },
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
