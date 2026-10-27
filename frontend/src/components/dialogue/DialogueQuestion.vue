<template>
  <div
      class="dialogue-question mb-3 p-3 border rounded"
      :class="{'dialogue-question-active bg-body-tertiary': hasActiveQuestion}"
  >
    <div class="d-flex gap-3">
      <div class="question-marker flex-shrink-0">
        <span :class="markerClass(turn.question)">{{ marker(turn.question) }}</span>
      </div>
      <div class="flex-grow-1">
        <div class="assistant-message">
          <template v-if="anchoredQuestionParts">
            <AiMessageMarkdown
                v-if="anchoredQuestionParts.before"
                :text="anchoredQuestionParts.before"
            />
            <blockquote
                class="border-start border-3 border-primary-subtle bg-body-tertiary rounded-end px-3 py-2 my-2 text-body-secondary"
            >
              {{ anchoredQuestionParts.anchor }}
            </blockquote>
            <AiMessageMarkdown
                v-if="anchoredQuestionParts.after"
                :text="anchoredQuestionParts.after"
            />
          </template>
          <AiMessageMarkdown v-else :text="turn.question.content || ''" />
        </div>

        <div
            v-for="(entry, index) in entries"
            :key="entry.id"
            :class="{'dialogue-follow-up border-start ps-3 mt-3': index > 0}"
        >
          <template v-if="index > 0">
            <div :class="markerClass(entry.question)" class="mb-2">
              {{ marker(entry.question) }}
            </div>
            <div class="assistant-message">
              <AiMessageMarkdown :text="entry.question.content || ''" />
            </div>
          </template>

          <div v-if="entry.answer" class="dialogue-answer border-start ps-3 mt-3">
            <div class="small text-muted mb-1">{{ $t('ai.dialogue.yourAnswer') }}</div>
            <div class="answer-content">{{ answerText(entry.answer) }}</div>
          </div>

          <AiConversationMessage
              v-if="entry.response"
              class="mt-3"
              :message="entry.response"
              :retryable="isRetryable(entry.response)"
              :is-busy="isBusy"
              @retry="$emit('retry', $event)"
          />

          <DialogueAnswerInput
              v-if="isActiveQuestion(entry.question)"
              class="mt-3"
              :question="questionFromMessage(entry.question)"
              :read-only="readOnly"
              :is-busy="isBusy"
              :active-request="activeRequest"
              :sending="sending"
              :aborting="aborting"
              :allow-skip="allowSkip"
              @send="$emit('send', $event)"
              @abort="$emit('abort')"
              @typing-started="$emit('typing-started', $event)"
              @paste="$emit('paste', $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {defineAsyncComponent} from "vue";
import AiConversationMessage from "@/components/aiAssistant/AiConversationMessage.vue";
import DialogueAnswerInput from "@/components/dialogue/DialogueAnswerInput.vue";
import {splitDialogueQuestionText} from "@/components/dialogue/dialogueMessages.js";

const AiMessageMarkdown = defineAsyncComponent(
    () => import("@/components/aiAssistant/AiMessageMarkdown.vue")
);

/**
 * Renders one Dialogue question and its active answer input.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "DialogueQuestion",
  components: {AiConversationMessage, AiMessageMarkdown, DialogueAnswerInput},
  props: {
    turn: {
      type: Object,
      required: true,
    },
    readOnly: {
      type: Boolean,
      required: false,
      default: false,
    },
    isBusy: {
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
    anchoredQuestionParts() {
      return splitDialogueQuestionText(this.turn.question);
    },
    entries() {
      return [this.turn, ...(this.turn.followUps || [])];
    },
    hasActiveQuestion() {
      return this.entries.some((entry) => this.isActiveQuestion(entry.question));
    },
  },
  methods: {
    /**
     * Builds the question object expected by the answer input.
     *
     * @param {Object} message - AI question message.
     * @returns {Object} Dialogue question.
     */
    questionFromMessage(message) {
      const dialogueMetadata = message.metadata?.dialogue || {};
      return {
        id: String(dialogueMetadata.questionId || message.id),
        text: message.content || "",
        answerType: dialogueMetadata.answerType || "text",
        options: dialogueMetadata.options || [],
        followUpIndex: dialogueMetadata.followUpIndex || 0,
      };
    },
    /** Returns the visible value for a stored answer. */
    answerText(message) {
      return message?.metadata?.dialogue?.skipped ? this.$t("ai.dialogue.skipped") : message?.content || "";
    },
    /**
     * Returns the visible marker for one question message.
     *
     * @param {Object} message - AI question message.
     * @returns {string} Marker text.
     */
    marker(message) {
      const dialogueMetadata = message.metadata?.dialogue || {};
      if (dialogueMetadata.kind === "follow_up") return this.$t("ai.dialogue.followUpQuestion");
      return dialogueMetadata.questionNumber
          ? this.$t("ai.dialogue.questionNumber", {number: dialogueMetadata.questionNumber})
          : this.$t("ai.dialogue.question");
    },
    /**
     * Returns the visible marker style for one question message.
     *
     * @param {Object} message - AI question message.
     * @returns {string} Marker classes.
     */
    markerClass(message) {
      const dialogueMetadata = message.metadata?.dialogue || {};
      if (dialogueMetadata.kind === "follow_up") {
        return "badge rounded-pill bg-body-tertiary border text-body-secondary";
      }
      return "badge rounded-pill text-bg-primary";
    },
    /**
     * Returns true when this message owns the active answer input.
     *
     * @param {Object} message - AI question message.
     * @returns {boolean} Whether this is the active question.
     */
    isActiveQuestion(message) {
      return String(message.id) === String(this.activeQuestionMessageId);
    },
    /**
     * Returns true when this assistant response can be retried.
     *
     * @param {Object} message - AI response message.
     * @returns {boolean} Whether retry is allowed.
     */
    isRetryable(message) {
      return !this.readOnly && Number(message?.id) === Number(this.retryableMessageId);
    },
  },
};
</script>

<style scoped>
.assistant-message {
  line-height: 1.5;
}

.question-marker {
  width: 4.5rem;
}

.dialogue-question-active {
  border-color: var(--bs-primary-border-subtle) !important;
}

.answer-content {
  white-space: pre-wrap;
  word-break: break-word;
}

.dialogue-follow-up {
  border-color: var(--bs-border-color);
}
</style>
