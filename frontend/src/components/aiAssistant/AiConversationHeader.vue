<template>
  <div class="conversation-header d-flex align-items-center justify-content-between border-bottom bg-body px-3 py-2">
    <span class="fw-semibold small text-body">Study chat</span>

    <div class="d-flex align-items-center gap-1">
      <BasicButton
          class="btn btn-sm header-button"
          icon="plus-lg"
          tooltip="New chat"
          :disabled="busy || readOnly"
          @click="$emit('new')"
      />

      <div class="dropdown">
        <BasicButton
            class="btn btn-sm header-button"
            icon="clock-history"
            tooltip="History"
            data-bs-toggle="dropdown"
            aria-expanded="false"
            :disabled="busy"
        />
        <ul class="dropdown-menu dropdown-menu-end history-menu">
          <li><h6 class="dropdown-header">Recent chats</h6></li>
          <li v-for="conversation in conversations" :key="conversation.id">
            <BasicButton
                class="dropdown-item d-flex align-items-center gap-2"
                :class="{active: Number(conversation.id) === activeConversationId}"
                :title="title(conversation)"
                @click="$emit('select', Number(conversation.id))"
            >
              <span class="history-text flex-grow-1">
                <span class="history-title text-truncate">{{ title(conversation) }}</span>
                <span class="history-date text-truncate small text-muted">{{ dateLabel(conversation) }}</span>
              </span>
              <BasicIcon
                  v-if="Number(conversation.id) === activeConversationId"
                  icon-name="check2"
                  :size="16"
              />
            </BasicButton>
          </li>
          <li v-if="conversations.length === 0">
            <span class="dropdown-item disabled text-muted">No chats yet</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import BasicIcon from "@/basic/Icon.vue";

/**
 * AI conversation header: start a new chat and switch between past ones.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "AiConversationHeader",
  components: {BasicButton, BasicIcon},
  props: {
    conversations: {
      type: Array,
      required: false,
      default: () => [],
    },
    activeConversationId: {
      type: Number,
      required: false,
      default: null,
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
  },
  emits: ["new", "select"],
  methods: {
    /**
     * Title line: the conversation's first message.
     *
     * @param {Object} conversation - Conversation summary from the backend.
     * @returns {string} Title text.
     */
    title(conversation) {
      return conversation.title || "New chat";
    },
    /**
     * Subtitle line: the conversation's last-updated date and time.
     *
     * @param {Object} conversation - Conversation summary from the backend.
     * @returns {string} Localised date-time, or empty when unavailable.
     */
    dateLabel(conversation) {
      const date = new Date(conversation.updatedAt || conversation.createdAt);
      return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
    },
  },
};
</script>

<style scoped>
.conversation-header {
  flex-shrink: 0;
}

/* Roomier menu with consistent padding, rounded rows, a quiet section title. */
.history-menu {
  min-width: 16rem;
  max-width: 22rem;
  padding: 0.35rem;
}

.history-menu .dropdown-header {
  padding: 0.25rem 0.75rem 0.4rem;
  font-size: 0.7rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--bs-secondary-color);
}

.history-menu :deep(.dropdown-item) {
  padding: 0.4rem 0.75rem;
  border-radius: var(--bs-border-radius);
}

/* Two-line item: first message on top, muted date beneath, both truncated. */
.history-text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  line-height: 1.25;
}

.history-title,
.history-date {
  display: block;
  max-width: 100%;
}

.history-date {
  font-size: 0.75rem;
}

/* Subtle ghost buttons; hover/focus stay on-theme, matching the composer. */
.header-button {
  color: var(--bs-secondary-color);
}

.header-button:hover:not(:disabled),
.header-button:focus-visible {
  background-color: var(--bs-secondary-bg);
  color: var(--bs-body-color);
}

/* Ghost button: no border, ring, or shadow in any state, including the
   active/open (.show) state and BasicButton's own hover shadow. */
.header-button,
.header-button:hover,
.header-button:focus,
.header-button:focus-visible,
.header-button:active,
.header-button.active,
.header-button.show {
  border-color: transparent !important;
  outline: none !important;
  box-shadow: none !important;
}

.dropdown-menu :deep(.dropdown-item.active) {
  background-color: var(--bs-primary-bg-subtle);
  color: var(--bs-primary-text-emphasis);
  border-color: transparent;
  box-shadow: none;
}

.dropdown-menu :deep(.dropdown-item:hover),
.dropdown-menu :deep(.dropdown-item:focus),
.dropdown-menu :deep(.dropdown-item:focus-visible) {
  background-color: var(--bs-secondary-bg);
  color: var(--bs-body-color);
  outline: none;
  box-shadow: none;
}
</style>
