<template>
  <div class="conversation-header d-flex align-items-center justify-content-between border-bottom bg-body px-3 py-2">
    <div class="d-flex flex-column">
      <span class="fw-semibold small text-body">{{ $t('ai.chat.title') }}</span>
      <span class="small text-muted">{{ includeContext ? $t('ai.chat.withContext') : $t('ai.chat.freshConversation') }}</span>
    </div>

    <div class="d-flex align-items-center gap-1">
      <div class="dropdown">
        <BasicButton
            class="btn btn-sm header-button"
            icon="plus-lg"
            :tooltip="$t('ai.chat.newConversation')"
            :aria-label="$t('ai.chat.newConversation')"
            data-bs-toggle="dropdown"
            aria-expanded="false"
            :disabled="isBusy || readOnly"
        />
        <ul class="dropdown-menu dropdown-menu-end conversation-menu">
          <li><h6 class="dropdown-header">{{ $t('ai.chat.newConversation') }}</h6></li>
          <li>
            <BasicButton
                class="dropdown-item text-wrap"
                :disabled="isBusy || readOnly"
                @click="$emit('new', true)"
            >
              <span class="d-block fw-semibold">{{ $t('ai.chat.withContext') }}</span>
              <span class="d-block small text-muted">{{ contextDescription || $t('ai.chat.contextDescription') }}</span>
            </BasicButton>
          </li>
          <li>
            <BasicButton
                class="dropdown-item text-wrap"
                :disabled="isBusy || readOnly"
                @click="$emit('new', false)"
            >
              <span class="d-block fw-semibold">{{ $t('ai.chat.freshConversation') }}</span>
              <span class="d-block small text-muted">{{ $t('ai.chat.freshDescription') }}</span>
            </BasicButton>
          </li>
        </ul>
      </div>

      <div class="dropdown">
        <BasicButton
            class="btn btn-sm header-button"
            icon="clock-history"
            :tooltip="$t('ai.chat.history')"
            data-bs-toggle="dropdown"
            aria-expanded="false"
            :disabled="isBusy"
        />
        <ul class="dropdown-menu dropdown-menu-end conversation-menu">
          <li><h6 class="dropdown-header">{{ $t('ai.chat.recentChats') }}</h6></li>
          <li v-for="conversation in conversations" :key="conversation.id">
            <BasicButton
                class="dropdown-item d-flex align-items-center gap-2"
                :class="{active: Number(conversation.id) === activeConversationId}"
                :title="title(conversation)"
                @click="$emit('select', Number(conversation.id))"
            >
              <span class="history-text flex-grow-1">
                <span class="history-title text-truncate">{{ title(conversation) }}</span>
                <span class="history-date text-truncate small text-muted">
                  <template v-if="conversation.includeContext === false">{{ $t('ai.chat.fresh') }} · </template>{{ dateLabel(conversation) }}
                </span>
              </span>
              <BasicIcon
                  v-if="Number(conversation.id) === activeConversationId"
                  icon-name="check2"
                  :size="16"
              />
            </BasicButton>
          </li>
          <li v-if="conversations.length === 0">
            <span class="dropdown-item disabled text-muted">{{ $t('ai.chat.noChats') }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import BasicIcon from "@/basic/Icon.vue";
import {formatLocalizedDateTime} from "@/assets/utils";

/**
 * AI conversation header: start a new chat and switch between past ones.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "AiConversationHeader",
  components: {BasicButton, BasicIcon},
  props: {
    contextDescription: {
      type: String,
      required: false,
      default: "",
    },
    includeContext: {
      type: Boolean,
      required: false,
      default: true,
    },
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
    isBusy: {
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
      return conversation.title || this.$t("ai.chat.newChat");
    },
    /**
     * Subtitle line: the conversation's last-updated date and time.
     *
     * @param {Object} conversation - Conversation summary from the backend.
     * @returns {string} Localised date-time, or empty when unavailable.
     */
    dateLabel(conversation) {
      return formatLocalizedDateTime(conversation.updatedAt || conversation.createdAt);
    },
  },
};
</script>

<style scoped>
.conversation-header {
  flex-shrink: 0;
}

/* Roomier menu with consistent padding, rounded rows, a quiet section title. */
.conversation-menu {
  min-width: 16rem;
  max-width: 22rem;
  padding: 0.35rem;
}

.conversation-menu .dropdown-header {
  padding: 0.25rem 0.75rem 0.4rem;
  font-size: 0.7rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--bs-secondary-color);
}

.conversation-menu :deep(.dropdown-item) {
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
