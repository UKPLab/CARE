<template>
  <AiConversationBody
      ref="shell"
      :loading="loading"
      :empty="visibleMessages.length === 0"
      :loading-text="$t('ai.dialogue.loading')"
      :empty-title="$t('ai.dialogue.noQuestion')"
  >
    <template v-for="item in dialogueTurns" :key="item.id">
      <DialogueQuestion
          v-if="item.type === 'question'"
          :turn="item"
          :read-only="readOnly"
          :is-busy="isBusy"
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
          @copy="$emit('copy', $event)"
      />
      <AiConversationMessage
          v-else
          :message="item.message"
          :retryable="retryableMessageId === Number(item.message.id)"
          :is-busy="isBusy"
          @retry="$emit('retry', $event)"
      />
    </template>
  </AiConversationBody>
</template>

<script>
import AiConversationBody from "@/components/aiAssistant/AiConversationBody.vue";
import AiConversationMessage from "@/components/aiAssistant/AiConversationMessage.vue";
import DialogueQuestion from "@/components/dialogue/DialogueQuestion.vue";
import {buildDialogueAnswerMessage, buildDialoguePendingMessage, buildDialogueQuestionMessage, isDialogueQuestion, buildDialogueTurns} from "@/components/dialogue/dialogueMessages.js";

/**
 * Scrollable Dialogue message body.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "DialogueConversationBody",
  components: {AiConversationBody, AiConversationMessage, DialogueQuestion},
  props: {
    currentQuestion: {type: Object, default: null}, complete: {type: Boolean, default: false},
    pendingAnswer: {type: String, default: ''}, pendingSkipped: {type: Boolean, default: false},
    contextKey: {type: String, required: true},
    messages: {
      type: Array,
      required: true,
    },
    loading: {
      type: Boolean,
      required: false,
      default: false,
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
  emits: ["send", "abort", "retry", "typing-started", "paste", "copy", "question-shown"],
  data() {return {shownQuestionKeys: new Set()};},
  computed: {
    visibleMessages() {
      const base = this.messages.length || !this.currentQuestion
          ? this.messages
          : [buildDialogueQuestionMessage(this.currentQuestion)];
      if (!this.pendingAnswer) {
        return base;
      }
      return [
        ...base,
        buildDialogueAnswerMessage(this.currentQuestion, this.pendingAnswer, this.pendingSkipped),
        buildDialoguePendingMessage(this.currentQuestion),
      ];
    },
    activeQuestionMessageId() {
      const questionId = this.activeRequest?.questionId || (!this.complete && this.currentQuestion?.id);
      if (!questionId) {
        return null;
      }
      const latestQuestion = [...this.visibleMessages].reverse()
          .find((message) =>
            isDialogueQuestion(message)
              && String(message.metadata?.dialogue?.questionId) === String(questionId)
          );
      return latestQuestion?.id || null;
    },
    dialogueTurns() {
      return buildDialogueTurns(this.visibleMessages);
    },
  },
  watch: {
    contextKey() {this.shownQuestionKeys.clear();},
    activeQuestionMessageId: {
      handler(messageId) {
        if (messageId) {
          this.$nextTick(() => this.logQuestionShown(messageId));
        }
      },
      immediate: true,
    }
  },
  methods: {
    logQuestionShown(messageId) {
      const message = this.visibleMessages.find((entry) => String(entry.id) === String(messageId));
      if (!message) {
        return;
      }
      const dialogue = message.metadata?.dialogue || {};
      const key = [dialogue.kind, dialogue.questionId, dialogue.followUpIndex || 0].join(":");
      if (this.shownQuestionKeys.has(key)) {
        return;
      }
      this.shownQuestionKeys.add(key);
      this.$emit("question-shown", {
        questionId: dialogue.questionId,
        followUpIndex: dialogue.followUpIndex || 0,
      });
    },
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
