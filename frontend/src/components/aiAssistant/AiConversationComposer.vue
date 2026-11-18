<template>
  <form class="conversation-composer border-top bg-body p-2" @submit.prevent="submit">
    <div v-if="errorMessage" class="alert alert-danger py-2 mb-2">
      {{ errorMessage }}
    </div>

    <div class="composer-box border">
      <div v-if="quote" class="composer-quote">
        <BasicIcon icon-name="quote" :size="15" class="composer-quote-mark" />
        <span class="composer-quote-text">{{ quote.text }}</span>
        <BasicButton
            class="btn btn-sm composer-quote-close"
            icon="x-lg"
            :tooltip="$t('ai.chat.removeQuote')"
            @click="clearQuote"
        />
      </div>

      <textarea
          ref="textarea"
          :value="draft"
          class="form-control composer-textarea border-0 shadow-none bg-transparent"
          rows="1"
          :placeholder="$t('ai.chat.placeholder')"
          :disabled="disabled"
          @input="onInput"
          @paste="onPaste"
          @keydown.enter.exact.prevent="submit"
      />

      <div class="composer-actions d-flex align-items-center justify-content-between gap-2 px-2 py-1">
        <AiConversationModelPicker
            :models="models"
            :selected-model-id="selectedModelId"
            :disabled="disabled"
            @update:selected-model-id="$emit('update:selectedModelId', $event)"
        />

        <BasicButton
            v-if="activeRequest"
            class="btn btn-outline-danger btn-sm rounded-circle composer-button"
            icon="stop-circle"
            :tooltip="$t('common.abort')"
            :disabled="aborting"
            @click="abort"
        />
        <BasicButton
            v-else
            class="btn btn-primary btn-sm rounded-circle composer-button"
            icon="send"
            :tooltip="$t('common.send')"
            :disabled="!canSend"
            :loading="!!activeRequest && !aborting"
            @click="submit"
        />
      </div>
    </div>
  </form>
</template>

<script>
import AiConversationModelPicker from "./AiConversationModelPicker.vue";
import BasicButton from "@/basic/Button.vue";
import BasicIcon from "@/basic/Icon.vue";

// Upper bound for the auto-growing textarea (roughly the old three-row height).
const MAX_TEXTAREA_HEIGHT = 100;

/**
 * AI conversation input with model selector. Owns the draft and the quoted
 * reading selection until the parent confirms the submitted turn.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "AiConversationComposer",
  components: {AiConversationModelPicker, BasicButton, BasicIcon},
  inject: {
    showSidebarTabOf: {default: () => () => false},
  },
  props: {
    studyStepId: {
      type: Number,
      required: true,
    },
    models: {
      type: Array,
      required: true,
    },
    selectedModelId: {
      type: Number,
      required: false,
      default: null,
    },
    errorMessage: {
      type: String,
      required: false,
      default: "",
    },
    isBusy: {
      type: Boolean,
      required: false,
      default: false,
    },
    ready: {
      type: Boolean,
      required: false,
      default: false,
    },
    /** Request currently answering this conversation, if any. */
    activeRequest: {
      type: Object,
      required: false,
      default: null,
    },
    aborting: {
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
  emits: ["update:selectedModelId", "send", "abort", "stat"],
  data() {
    return {
      draft: "",
      quote: null,
    };
  },
  computed: {
    disabled() {
      return this.isBusy || this.readOnly || this.models.length === 0;
    },
    canSend() {
      return this.ready && this.draft.trim().length > 0;
    },
  },
  watch: {
    // Resize when the draft changes externally (e.g. cleared after a send).
    draft() {
      this.$nextTick(this.autoGrow);
    },
  },
  created() {
    // Reading selections are broadcast globally; keep only this step's quotes.
    this.eventBus.on("aiChatQuote", this.onQuote);
  },
  mounted() {
    this.autoGrow();
  },
  beforeUnmount() {
    this.eventBus.off("aiChatQuote", this.onQuote);
  },
  methods: {
    /**
     * Emits the draft (with any quote rendered as a blockquote) as one send
     * request. The draft stays until the parent confirms acceptance via
     * clearSubmitted.
     *
     * @returns {void}
     */
    submit() {
      if (!this.canSend) {
        return;
      }
      const question = this.draft.trim();
      const quote = this.quote;
      const quoted = quote ? quote.text.split("\n").map((line) => `> ${line}`).join("\n") : "";
      this.$emit("send", {
        type: "send",
        requestId: this.$aiAssistant.createRequestId(),
        draft: this.draft,
        submittedContent: quote ? `${quoted}\n\n${question}` : question,
        content: question,
        quote,
      });
    },
    /**
     * Clears only the parts of a submitted turn the user has not changed since.
     *
     * @param {Object} request - Send request carrying the submitted draft and quote.
     * @returns {void}
     */
    clearSubmitted({draft, quote} = {}) {
      if (this.draft === draft) {
        this.draft = "";
      }
      if (this.quote === quote) {
        this.quote = null;
      }
    },
    /** Reports the stop click and asks the parent to abort the active request. */
    abort() {
      this.$emit("stat", "aiChatAbortClick", {requestId: this.activeRequest.requestId});
      this.$emit("abort");
    },
    /** Removes the quoted reading selection. */
    clearQuote() {
      this.quote = null;
    },
    /**
     * Stores a reading selection quoted into this step's chat.
     *
     * @param {Object} payload - Quote payload from the reader.
     * @param {string} payload.text - Selected text.
     * @param {number} payload.studyStepId - Originating study step.
     * @param {number} payload.documentId - Originating document.
     * @returns {void}
     */
    onQuote({text, studyStepId, documentId}) {
      if (Number(studyStepId) !== Number(this.studyStepId)) {
        return;
      }
      const quoteText = (text || "").trim();
      this.quote = quoteText ? {text: quoteText, studyStepId, documentId} : null;
      if (this.quote) {
        this.$emit("stat", "aiChatQuoteCreate", {
          sourceStudyStepId: studyStepId,
          sourceDocumentId: documentId,
          length: quoteText.length,
        });
        this.showSidebarTabOf(this.$el, true);
        this.focus();
      }
    },
    /** Focuses the message textarea when the composer is available. */
    focus() {
      this.$nextTick(() => {
        if (!this.disabled) {
          this.$refs.textarea?.focus();
        }
      });
    },
    /**
     * Emits the new draft and keeps the textarea sized to its content.
     *
     * @param {Event} event - Textarea input event.
     * @returns {void}
     */
    onInput(event) {
      this.draft = event.target.value;
      this.autoGrow();
    },
    /**
     * Reports pasted text as a chat behavior event.
     *
     * @param {ClipboardEvent} event - Paste event.
     * @returns {void}
     */
    onPaste(event) {
      const text = event.clipboardData?.getData("text") || "";
      if (text) {
        this.$emit("stat", "aiChatInputPaste", {pastedText: text});
      }
    },
    /**
     * Grows the textarea with its content up to a fixed maximum height.
     *
     * @returns {void}
     */
    autoGrow() {
      const el = this.$refs.textarea;
      if (!el) {
        return;
      }
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
    },
  },
};
</script>

<style scoped>
.conversation-composer {
  flex-shrink: 0;
}

.composer-box {
  border-radius: 1rem;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

/* Highlight the whole box while typing, matching the theme's focus colour. */
.composer-box:focus-within {
  border-color: var(--bs-primary);
  box-shadow: 0 0 0 0.2rem rgba(var(--bs-primary-rgb), 0.15);
}

/* Quoted reading selection, shown above the input until sent or dismissed. */
.composer-quote {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 0.5rem 0.5rem 0;
  padding: 0.4rem 0.6rem;
  border-left: 3px solid var(--bs-primary);
  border-radius: 0.25rem;
  background: var(--bs-secondary-bg);
}

.composer-quote-mark {
  flex-shrink: 0;
  color: var(--bs-secondary-color);
}

.composer-quote-text {
  flex-grow: 1;
  min-width: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 0.8rem;
  color: var(--bs-secondary-color);
}

.composer-quote-close {
  flex-shrink: 0;
  padding: 0 0.25rem;
  color: var(--bs-secondary-color);
}

.composer-quote-close:hover:not(:disabled) {
  color: var(--bs-body-color);
}

.composer-textarea {
  resize: none;
  min-height: 40px;
  max-height: 100px;
  overflow-y: auto;
}

.composer-textarea:focus {
  box-shadow: none;
}



.composer-button {
  display: inline-flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  padding: 0;
}
</style>
