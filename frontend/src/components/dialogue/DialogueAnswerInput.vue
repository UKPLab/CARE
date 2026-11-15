<template>
  <form class="dialogue-answer-input mt-3" @submit.prevent="submit">
    <fieldset :disabled="isBusy || readOnly">
      <template v-if="usesCheckboxes">
        <div
            v-for="option in currentOptions"
            :key="optionValue(option)"
            class="form-check mb-2"
        >
          <input
              :id="inputId(option)"
              v-model="selectedOptions"
              class="form-check-input"
              type="checkbox"
              :name="inputName"
              :value="optionValue(option)"
          >
          <label class="form-check-label" :for="inputId(option)">
            {{ optionLabel(option) }}
          </label>
        </div>
      </template>

      <template v-else-if="usesRadios">
        <div
            v-for="option in currentOptions"
            :key="optionValue(option)"
            class="form-check mb-2"
        >
          <input
              :id="inputId(option)"
              v-model="selectedOption"
              class="form-check-input"
              type="radio"
              :name="inputName"
              :value="optionValue(option)"
          >
          <label class="form-check-label" :for="inputId(option)">
            {{ optionLabel(option) }}
          </label>
        </div>
      </template>

      <textarea
          v-else
          v-model="answerDraft"
          class="form-control dialogue-textarea"
          rows="3"
          :placeholder="$t('ai.dialogue.answerPlaceholder')"
          :aria-label="question.text || $t('ai.dialogue.answer')"
          @beforeinput="onBeforeInput"
          @input="onInput"
          @paste="onPaste"
          @compositionstart="onCompositionStart"
          @compositionend="onCompositionEnd"
          @blur="endTypingInterval"
      />
    </fieldset>

    <div class="d-flex justify-content-end gap-2 mt-2">
      <BasicButton
          v-if="!activeRequest && allowSkip"
          class="btn btn-outline-secondary"
          :title="$t('ai.dialogue.skipQuestion')"
          :disabled="isBusy || readOnly"
          @click="skip"
      >
        {{ $t('ai.dialogue.skip') }}
      </BasicButton>
      <BasicButton
          v-if="activeRequest"
          class="btn btn-outline-danger"
          icon="stop-circle"
          :text="$t('ai.assistant.stop')"
          :title="$t('ai.assistant.stop')"
          :loading="aborting"
          @click="$emit('abort')"
      />
      <BasicButton
          v-else
          class="btn btn-primary"
          icon="send"
          :text="$t('common.submitText')"
          :title="$t('ai.dialogue.submitAnswer')"
          :disabled="!canSend"
          :loading="sending"
          @click="submit"
      />
    </div>
  </form>
</template>

<script>
import BasicButton from "@/basic/Button.vue";

const RADIO_TYPES = Object.freeze(["likert", "singleChoice"]);
const CHECKBOX_TYPES = Object.freeze(["multipleChoice"]);

/**
 * Renders the answer control for a Dialogue question.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "DialogueAnswerInput",
  components: {BasicButton},
  inject: {
    acceptStats: {default: false},
  },
  props: {
    question: {
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
    allowSkip: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  emits: ["send", "abort", "typing-started", "paste"],
  data() {
    return {
      answerDraft: "",
      selectedOption: null,
      selectedOptions: [],
      typingStarted: false,
      compositionSummary: {typedCharacters: 0, pastedCharacters: 0, deletedCharacters: 0, activeTypingMs: 0},
      previousText: "",
      beforeEdit: null,
      composing: false,
      lastEditAt: null,
    };
  },
  computed: {
    currentOptions() {
      return this.question?.options || [];
    },
    answerType() {
      return this.question?.answerType || "text";
    },
    inputName() {
      return `dialogue_${this.question.id}`;
    },
    usesRadios() {
      return RADIO_TYPES.includes(this.answerType);
    },
    usesCheckboxes() {
      return CHECKBOX_TYPES.includes(this.answerType);
    },
    answerText() {
      if (this.usesCheckboxes) {
        return this.selectedOptions
            .map((value) => this.optionLabelByValue(value))
            .filter(Boolean)
            .join(", ");
      }
      if (this.usesRadios) {
        return this.optionLabelByValue(this.selectedOption);
      }
      return this.answerDraft.trim();
    },
    answerValue() {
      if (this.usesCheckboxes) {
        return this.selectedOptions;
      }
      if (this.usesRadios) {
        return this.selectedOption;
      }
      return this.answerDraft.trim();
    },
    canSend() {
      return !this.readOnly && !this.isBusy && !!this.answerText;
    },
  },
  watch: {
    "question.id"() {
      this.resetComposition();
    },
    "question.followUpIndex"() {
      this.resetComposition();
    },
    acceptStats() {
      this.resetComposition();
    },
  },
  mounted() {
    document.addEventListener("visibilitychange", this.endTypingInterval);
  },
  beforeUnmount() {
    document.removeEventListener("visibilitychange", this.endTypingInterval);
  },
  methods: {
    /**
     * Records the first typed character for this question.
     *
     * @param {InputEvent} event - Textarea input event.
     * @returns {void}
     */
    onInput(event) {
      if (event.isComposing || this.composing) {
        return;
      }
      this.recordEdit(event.target?.value ?? this.answerDraft ?? "", event.inputType);
      if (this.typingStarted || event.inputType === "insertFromPaste") {
        return;
      }
      this.typingStarted = true;
      this.$emit("typing-started", {
        questionId: this.question.id,
        followUpIndex: this.question.followUpIndex || 0,
      });
    },
    /**
     * Records text pasted into this question.
     *
     * @param {ClipboardEvent} event - Textarea paste event.
     * @returns {void}
     */
    onPaste(event) {
      if (!this.acceptStats) {
        return;
      }
      const pastedText = (event.clipboardData || window.clipboardData).getData("text");
      if (!pastedText) {
        return;
      }
      this.$emit("paste", {
        questionId: this.question.id,
        followUpIndex: this.question.followUpIndex || 0,
        pastedLength: pastedText.length,
      });
    },
    /**
     * Resets aggregate measurements for the active question instance.
     * @returns {void}
     */
    resetComposition() {
      this.typingStarted = false;
      this.compositionSummary = {typedCharacters: 0, pastedCharacters: 0, deletedCharacters: 0, activeTypingMs: 0};
      this.previousText = this.acceptStats ? this.answerDraft : "";
      this.beforeEdit = null;
      this.composing = false;
      this.lastEditAt = null;
    },
    /**
     * Ends a typing interval on focus or visibility changes.
     * @returns {void}
     */
    endTypingInterval() {
      this.lastEditAt = null;
    },
    /**
     * Captures selected-text replacement without recording a keystroke event.
     * @param {InputEvent} event - Textarea edit event.
     * @returns {void}
     */
    onBeforeInput(event) {
      if (this.acceptStats && !this.composing) {
        this.beforeEdit = {start: event.target.selectionStart, end: event.target.selectionEnd, text: event.target.value};
      }
    },
    /**
     * Defers composition previews until the committed text is available.
     * @param {CompositionEvent} event - Textarea edit event.
     * @returns {void}
     */
    onCompositionStart(event) {
      this.onBeforeInput(event);
      this.composing = true;
    },
    /**
     * Counts committed composition text once.
     * @param {CompositionEvent} event - Textarea edit event.
     * @returns {void}
     */
    onCompositionEnd(event) {
      this.composing = false;
      this.onInput({target: event.target, inputType: "insertCompositionText"});
    },
    /**
     * Adds edit totals without sending per-keystroke statistics.
     * @param {string} text - Current textarea value.
     * @param {string} inputType - Browser edit operation.
     * @returns {void}
     */
    recordEdit(text, inputType = "") {
      if (!this.acceptStats) {
        return;
      }
      const previous = this.previousText;
      let prefix = 0;
      while (prefix < previous.length && prefix < text.length && previous[prefix] === text[prefix]) {
        prefix += 1;
      }
      let suffix = 0;
      while (suffix < previous.length - prefix && suffix < text.length - prefix
          && previous[previous.length - suffix - 1] === text[text.length - suffix - 1]) {
        suffix += 1;
      }
      let removed = previous.length - prefix - suffix;
      let inserted = text.length - prefix - suffix;
      if (this.beforeEdit && inputType.startsWith("insert") && this.beforeEdit.end > this.beforeEdit.start) {
        removed = this.beforeEdit.end - this.beforeEdit.start;
        inserted = Math.max(0, text.length - (this.beforeEdit.text.length - removed));
      }
      this.beforeEdit = null;
      this.previousText = text;
      if (!removed && !inserted) {
        return;
      }
      this.compositionSummary.deletedCharacters += removed;
      if (inputType === "insertFromPaste") {
        this.compositionSummary.pastedCharacters += inserted;
      } else if (!inputType.startsWith("history")) {
        this.compositionSummary.typedCharacters += inserted;
      }
      const now = Date.now();
      const interval = this.lastEditAt === null ? 0 : now - this.lastEditAt;
      if (interval >= 0 && interval <= 2000) {
        this.compositionSummary.activeTypingMs += interval;
      }
      this.lastEditAt = now;
    },
    /**
     * Builds a stable input id for one option.
     *
     * @param {*} option - Question option.
     * @returns {string} Input id.
     */
    inputId(option) {
      return `dialogue_${this.question.id}_${this.optionValue(option)}`;
    },
    /**
     * Returns an option's stored value.
     *
     * @param {*} option - Question option.
     * @returns {string} Option value.
     */
    optionValue(option) {
      if (option && typeof option === "object") {
        return String(option.value ?? option.label ?? option.name);
      }
      return String(option);
    },
    /**
     * Returns an option's display label.
     *
     * @param {*} option - Question option.
     * @returns {string} Option label.
     */
    optionLabel(option) {
      if (option && typeof option === "object") {
        return String(option.label ?? option.name ?? option.value);
      }
      return String(option);
    },
    /**
     * Returns the label for a stored option value.
     *
     * @param {string} value - Stored option value.
     * @returns {string} Option label.
     */
    optionLabelByValue(value) {
      const option = this.currentOptions.find((entry) => String(this.optionValue(entry)) === String(value));
      return option ? this.optionLabel(option) : "";
    },
    /**
     * Emits the answer while retaining controls until the question changes.
     *
     * @returns {void}
     */
    submit() {
      if (!this.canSend) {
        return;
      }
      this.$emit("send", {
        answerText: this.answerText,
        answerValue: this.answerValue,
        followUpIndex: this.question.followUpIndex || 0,
        ...(this.acceptStats ? {composition: {...this.compositionSummary}} : {}),
      });
    },
    /**
     * Records an explicit skipped answer.
     * @returns {void}
     */
    skip() {
      if (!this.allowSkip || this.isBusy || this.readOnly) {
        return;
      }
      this.$emit("send", {answerText: "", answerValue: null, skipped: true,
        followUpIndex: this.question.followUpIndex || 0,
        ...(this.acceptStats ? {composition: {...this.compositionSummary}} : {}),
      });
    },
  },
};
</script>

<style scoped>
.dialogue-textarea {
  resize: vertical;
}
</style>
