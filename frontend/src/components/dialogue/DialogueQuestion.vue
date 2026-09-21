<template>
  <div
      class="dialogue-question mb-3 p-3 border rounded"
      :class="{'dialogue-question-active bg-body-tertiary': hasActiveQuestion}"
  >
    <div class="d-flex gap-3">
      <div class="question-marker flex-shrink-0">
        <span :class="markerClass(turn.question)">{{ marker(turn.question) }}</span>
        <FormHelp
            v-if="questionHelp(turn.question)"
            :help="questionHelp(turn.question)"
            icon-name="info-circle"
            button-class="text-muted ms-1"
        />
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

        <div v-if="turn.answer" class="dialogue-answer border-start ps-3 mt-3">
          <div class="small text-muted mb-1">Your answer</div>
          <div class="answer-content">{{ answerText(turn.answer) }}</div>
        </div>

        <AiConversationMessage
            v-if="turn.response"
            class="mt-3"
            :message="turn.response"
            :retryable="isRetryable(turn.response)"
            :busy="isBusy"
            @retry="$emit('retry', $event)"
        />

        <DialogueAnswerInput
            v-if="isActiveQuestion(turn.question)"
            class="mt-3"
            :question="questionFromMessage(turn.question)"
            :read-only="readOnly"
            :is-busy="isBusy"
            :active-request="activeRequest"
            :sending="sending"
            :aborting="aborting"
            :error-message="errorMessage"
            :allow-skip="allowSkip"
            @send="$emit('send', $event)"
            @abort="$emit('abort')"
        />

        <div
            v-for="followUp in turn.followUps"
            :key="followUp.id"
            class="dialogue-follow-up border-start ps-3 mt-3"
        >
          <div :class="markerClass(followUp.question)" class="mb-2">
            {{ marker(followUp.question) }}
          </div>
          <div class="assistant-message">
            <AiMessageMarkdown :text="followUp.question.content || ''" />
          </div>

          <div v-if="followUp.answer" class="dialogue-answer border-start ps-3 mt-3">
            <div class="small text-muted mb-1">Your answer</div>
            <div class="answer-content">{{ answerText(followUp.answer) }}</div>
          </div>

          <AiConversationMessage
              v-if="followUp.response"
              class="mt-3"
              :message="followUp.response"
              :retryable="isRetryable(followUp.response)"
              :busy="isBusy"
              @retry="$emit('retry', $event)"
          />

          <DialogueAnswerInput
              v-if="isActiveQuestion(followUp.question)"
              class="mt-3"
              :question="questionFromMessage(followUp.question)"
              :read-only="readOnly"
              :is-busy="isBusy"
              :active-request="activeRequest"
              :sending="sending"
              :aborting="aborting"
              :error-message="errorMessage"
              :allow-skip="allowSkip"
              @send="$emit('send', $event)"
              @abort="$emit('abort')"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {defineAsyncComponent} from "vue";
import FormHelp from "@/basic/form/Help.vue";
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
  components: {AiConversationMessage, AiMessageMarkdown, DialogueAnswerInput, FormHelp},
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
    errorMessage: {
      type: String,
      required: false,
      default: "",
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
  emits: ["send", "abort", "retry"],
  computed: {
    anchoredQuestionParts() {
      return splitDialogueQuestionText(this.turn.question);
    },
    hasActiveQuestion() {
      return this.isActiveQuestion(this.turn.question)
          || (this.turn.followUps || []).some((followUp) => this.isActiveQuestion(followUp.question));
    },
  },
  methods: {
    /**
     * Returns the optional student guidance for a main question.
     *
     * @param {Object} message - AI question message.
     * @returns {string} Configured help text.
     */
    questionHelp(message) {
      return message?.metadata?.dialogue?.help || "";
    },
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
      };
    },
    /** Returns the visible value for a stored answer. */
    answerText(message) {
      return message?.metadata?.dialogue?.skipped ? "Skipped" : message?.content || "";
    },
    /**
     * Returns the visible marker for one question message.
     *
     * @param {Object} message - AI question message.
     * @returns {string} Marker text.
     */
    marker(message) {
      const dialogueMetadata = message.metadata?.dialogue || {};
      if (dialogueMetadata.kind === "follow_up") return "Follow-up question";
      return dialogueMetadata.questionNumber
          ? `Q${dialogueMetadata.questionNumber}`
          : "Question";
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
        return "badge rounded-pill text-bg-light border text-secondary";
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
  width: 5.5rem;
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
