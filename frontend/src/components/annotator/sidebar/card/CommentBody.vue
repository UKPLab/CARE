<template>
  <div
    v-if="!collapsed"
    class="comment card-text"
  >
    <div v-if="editing">
      <textarea
        ref="textarea"
        v-model="comment.text"
        class="form-control anno-note"
        :placeholder="$t('components.comment.enterText')"
        @keydown.ctrl.enter.exact.prevent="$emit('submit')"
        @keydown.meta.enter.exact.prevent="$emit('submit')"
        @keydown.esc.exact.prevent="$emit('escape')"
        @copy="onCopy"
        @paste="onPaste"
        @input="$emit('update:textError', false)"
      />
      <div
        v-if="textError"
        class="feedback-invalid invalid"
      >
        {{ $t('errors.element.fieldRequired') }}
      </div>
    </div>
    <div
      v-else-if="comment.text != null && comment.text.length > 0"
      :class="{ 'anno-comment-body': level === 0 }"
      @copy="onCopy"
    >
      {{ comment.text }}
    </div>
    <div
      v-else
      class="anno-comment-empty"
    >
      <i>{{ $t('components.comment.noComment')}}</i>
    </div>
    <div
      v-if="isSentimentAnalysisActive"
      class="text-end fw-light"
      :title="$t('components.comment.sentimentAnalysis')"
    >
      <span v-if="nlp_active && awaitingNlpResult && !edit">
        <IconLoading/>
      </span>
      <span v-else-if="nlp_active && nlp_result !== null">
        <span>
          {{ nlp_result.score.toFixed(2) * 100 }}%
        </span>
        <span v-if="nlp_result.label === 'neu'">
          &#129765;
        </span>
        <span v-else-if="nlp_result.label === 'pos'">
          &#128578;
        </span>
        <span v-else-if="nlp_result.label === 'neg'">
          &#9785;&#65039;
        </span>
      </span>
    </div>

    <TagSelector
      v-if="comment"
      v-model="comment.tags"
      class="anno-tags"
      :disabled="!edit"
      :is-editor="comment.userId === $store.getters['auth/getUserId']"
    />
    <slot/>
  </div>
</template>

<script>
import TagSelector from "./TagSelector.vue";
import IconLoading from "@/basic/icon/IconLoading.vue";

/**
 * Content of a comment in the annotation sidebar
 *
 * Shows the comment text (a textarea while it is edited), its sentiment and its tags; the default slot
 * holds the actions and replies of a reply. The component stays mounted while the comment is collapsed,
 * so the sentiment of every comment is requested when the comment is created, as before.
 *
 * @author Nils Dycke, Dennis Zyska
 */
export default {
  name: "CommentBody",
  components: {TagSelector, IconLoading},
  inject: {
    currentStudyStep: {default: null},
    documentId: {default: null},
    studySessionId: {default: null},
    studyStepId: {default: null},
    acceptStats: {default: () => false},
  },
  props: {
    commentId: {type: Number, required: true},
    collapsed: {type: Boolean, default: false},
    // Shows the textarea
    editing: {type: Boolean, default: false},
    // The card's own comment is being edited: tags can change, no sentiment spinner
    edit: {type: Boolean, default: false},
    // 0 for the card's main comment, whose text is shown boxed; 1 and deeper for replies
    level: {type: Number, default: 1},
    // Shows that the text is required (replies and document notes)
    textError: {type: Boolean, default: false},
  },
  emits: ['submit', 'escape', 'update:textError'],
  data() {
    return {awaitingNlpResult: false};
  },
  computed: {
    comment() {
      return this.$store.getters["table/comment/get"](this.commentId);
    },
    isSentimentAnalysisActive() {
      return this.$store.getters["settings/getValue"]("annotator.nlp.sentiment_analysis.activated") === "true";
    },
    nlp_active() {
      const conf = this.$store.getters["service/get"]("NLPService", "skillUpdate");
      return this.$store.getters["settings/getValue"]("annotator.nlp.activated") === "true" && conf && "sentiment_classification" in conf;
    },
    nlp_result() {
      const res = this.$store.getters["service/get"]("NLPService", "skillResults");
      return res && this.commentId in res ? res[this.commentId] : null;
    },
    statsContext() {
      return {
        ...(this.currentStudyStep?.id ? {currentStudyStepId: this.currentStudyStep?.id} : {}),
        documentId: this.documentId,
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId,
        from: "comment",
        commentId: this.commentId,
      };
    },
  },
  watch: {
    nlp_result(newV) {
      if (this.nlp_active) {
        this.awaitingNlpResult = newV === null;
      }
    },
    nlp_active() {
      if (this.nlp_active && this.nlp_result === null) {
        this.requestNlpFeedback();
      }
    },
  },
  mounted() {
    if (this.nlp_active && this.nlp_result === null && this.comment.text !== null) {
      this.requestNlpFeedback();
    }
  },
  methods: {
    /** Focuses the textarea once it is shown. */
    focusText() {
      this.$nextTick(() => this.$refs.textarea?.focus());
    },
    /** Asks for the sentiment of saved text (regardless of the server response on the update). */
    analyzeSentiment() {
      if (this.comment.text && this.nlp_active) {
        this.requestNlpFeedback();
      }
    },
    requestNlpFeedback() {
      this.$socket.emit("serviceRequest",
        {
          service: "NLPService",
          data: {
            id: this.commentId,
            name: "sentiment_classification",
            data: {text: this.comment.text}
          }
        }
      );
      this.awaitingNlpResult = true;
    },
    onPaste(event) {
      const pastedText = (event.clipboardData || window.clipboardData).getData('text');
      if (this.acceptStats && pastedText) {
        this.$socket.emit("stats", {action: "textPasted", data: {...this.statsContext, pastedText}});
      }
    },
    /**
     * Logs copied comment text.
     *
     * @param {ClipboardEvent} event - Copy event.
     * @returns {void}
     */
    onCopy(event) {
      const target = event.target;
      const copiedText = target?.value
        ? target.value.substring(target.selectionStart, target.selectionEnd)
        : window.getSelection()?.toString();
      if (this.acceptStats && copiedText) {
        this.$socket.emit("stats", {action: "textCopied", data: {...this.statsContext, copiedText}});
      }
    },
  },
};
</script>

<style scoped>
.comment {
  display: flex;
  flex-direction: column;
  gap: .5rem;
  margin: 0;
  color: var(--bs-body-color);
  font-style: normal;
}

.anno-note {
  border-radius: var(--care-radius-md);
}

.anno-comment-body {
  padding: .55rem .7rem;
  border: 1px solid var(--bs-border-color);
  border-radius: var(--care-radius-md);
  background: var(--bs-tertiary-bg);
}

.anno-comment-empty {
  color: var(--bs-secondary-color);
  font-size: .8125rem;
}

.anno-tags {
  margin: 0;
}
</style>
