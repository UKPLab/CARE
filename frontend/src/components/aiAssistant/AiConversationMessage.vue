<template>
  <div class="conversation-message mb-3" :class="{'d-flex justify-content-end': isUser}">
    <!-- User: keeps a bubble. -->
    <div v-if="isUser" class="message-bubble px-3 py-2 bg-primary-subtle text-primary-emphasis">
      <div class="message-content">{{ displayContent }}</div>
    </div>

    <!-- Assistant is responding: a light animated indicator, no bubble. -->
    <div v-else-if="isPending" class="assistant-thinking">
      <span>Thinking</span>
      <span class="thinking-dots"><span /><span /><span /></span>
    </div>

    <!-- Failed (danger) or stopped (neutral): a quiet inline notice, no bubble. -->
    <div
        v-else-if="isError"
        class="assistant-error"
        :class="isAborted ? 'assistant-aborted' : 'assistant-failed'"
    >
      <BasicIcon :icon-name="isAborted ? 'stop-circle' : 'exclamation-circle'" :size="16" />
      <span>{{ displayContent }}</span>
      <BasicButton
          v-if="retryable"
          class="btn btn-sm btn-outline-secondary ms-1"
          icon="arrow-clockwise"
          title="Retry"
          :loading="busy"
          @click="$emit('retry', message)"
      />
    </div>

    <!-- Completed assistant reply: plain rendered markdown, no bubble. -->
    <div v-else class="assistant-message" @copy="onCopy">
      <AiMessageMarkdown :text="displayContent" />
    </div>
  </div>
</template>

<script>
import {defineAsyncComponent} from "vue";
import BasicButton from "@/basic/Button.vue";
import BasicIcon from "@/basic/Icon.vue";

// Lazy so markdown-it + DOMPurify load only when an assistant reply renders.
const AiMessageMarkdown = defineAsyncComponent(
    () => import("@/components/aiAssistant/AiMessageMarkdown.vue")
);

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
 * One visible AI conversation message.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "AiConversationMessage",
  components: {BasicButton, BasicIcon, AiMessageMarkdown},
  props: {
    message: {
      type: Object,
      required: true,
    },
    retryable: {
      type: Boolean,
      required: false,
      default: false,
    },
    busy: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  emits: ["retry", "copy"],
  computed: {
    role() {
      return Number(this.message.role);
    },
    status() {
      return Number(this.message.status);
    },
    isUser() {
      return this.role === MESSAGE_ROLES.USER;
    },
    isPending() {
      return this.status === MESSAGE_STATUSES.PENDING;
    },
    isAborted() {
      return this.status === MESSAGE_STATUSES.ABORTED;
    },
    isError() {
      return [MESSAGE_STATUSES.FAILED, MESSAGE_STATUSES.ABORTED].includes(this.status);
    },
    displayContent() {
      if (this.status === MESSAGE_STATUSES.FAILED) return "Response failed.";
      if (this.status === MESSAGE_STATUSES.ABORTED) return "Response stopped.";
      return this.message.content || "";
    },
  },
  methods: {
    /**
     * Emits copied assistant text.
     *
     * @returns {void}
     */
    onCopy() {
      const text = window.getSelection ? window.getSelection().toString() : "";
      if (!text) return;
      this.$emit("copy", {
        messageId: this.message.id,
        copiedText: text,
      });
    },
  },
};
</script>

<style scoped>
.message-bubble {
  max-width: 88%;
  border-radius: 1rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.message-content {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.45;
}

.assistant-message {
  line-height: 1.5;
}

/* Responding indicator: muted label with three pulsing dots. */
.assistant-thinking {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--bs-secondary-color);
  font-size: 0.9rem;
}

.thinking-dots {
  display: inline-flex;
  gap: 3px;
}

.thinking-dots span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.3;
  animation: thinking 1.2s infinite ease-in-out;
}

.thinking-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.thinking-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes thinking {
  0%, 80%, 100% {
    opacity: 0.3;
  }
  40% {
    opacity: 1;
  }
}

/* Quiet inline row, no bubble. Failure is danger; user stop is neutral. */
.assistant-error {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
}

.assistant-failed {
  color: var(--bs-danger);
}

.assistant-aborted {
  color: var(--bs-secondary-color);
}
</style>
