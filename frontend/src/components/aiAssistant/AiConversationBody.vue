<template>
  <div ref="messageList" class="conversation-body flex-grow-1 p-3" @scroll="onScroll">
    <div
        v-if="loading"
        class="conversation-state text-center text-muted"
    >
      <div class="spinner-border spinner-border-sm mb-2" role="status">
        <span class="visually-hidden">{{ loadingText || $t('common.loading') }}</span>
      </div>
      <div>{{ loadingText || $t('common.loading') }}</div>
    </div>

    <div
        v-else-if="empty"
        class="conversation-state text-center text-muted"
    >
      <div class="empty-icon rounded-circle mx-auto mb-3">
        <BasicIcon icon-name="chat-dots" :size="28" />
      </div>
      <div class="fw-semibold text-body">{{ emptyTitle }}</div>
      <div v-if="emptySubtitle" class="small mt-1">{{ emptySubtitle }}</div>
    </div>

    <template v-else>
      <slot />
      <BasicButton v-if="followLatest && !followingLatest" class="jump-to-latest" @click="scrollToBottom({force: true})">
        {{ $t("ai.chat.jumpToLatest") }}
      </BasicButton>
    </template>
  </div>
</template>

<script>
import BasicIcon from "@/basic/Icon.vue";
import BasicButton from "@/basic/Button.vue";

/**
 * Scrollable message body shell shared by AI conversation surfaces.
 *
 * Owns the loading state, empty state, scroll container, and scrolling; the
 * host body supplies the message rendering through the default slot.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "AiConversationBody",
  components: {BasicIcon, BasicButton},
  data() {
    return {followingLatest: true};
  },
  props: {
    followLatest: {
      type: Boolean,
      required: false,
      default: false,
    },
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
      default: "",
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
    scrollToBottom({force = false} = {}) {
      if (this.followLatest && !force && !this.followingLatest) {
        return;
      }
      if (force) {
        this.followingLatest = true;
      }
      this.$nextTick(() => {
        const list = this.$refs.messageList;
        if (list) {
          list.scrollTop = list.scrollHeight;
        }
      });
    },
    /** Remembers the reader's position before the next streamed update. */
    onScroll() {
      const list = this.$refs.messageList;
      if (list) {
        this.followingLatest = list.scrollHeight - list.clientHeight - list.scrollTop <= 48;
      }
    },
  },
};
</script>

<style scoped>
.jump-to-latest {
  position: sticky;
  bottom: 0;
  display: block;
  margin-left: auto;
}

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
