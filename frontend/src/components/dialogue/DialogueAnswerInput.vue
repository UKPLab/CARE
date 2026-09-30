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
          placeholder="Write your answer..."
          :aria-label="question.text || 'Dialogue answer'"
          @input="handleTyping"
          @paste="handlePaste"
      />
    </fieldset>

    <div class="d-flex justify-content-end gap-2 mt-2">
      <BasicButton
          v-if="!activeRequest && allowSkip"
          class="btn btn-outline-secondary"
          title="Skip question"
          :disabled="isBusy || readOnly"
          @click="skip"
      >
        Skip
      </BasicButton>
      <BasicButton
          v-if="activeRequest"
          class="btn btn-outline-danger"
          icon="stop-circle"
          title="Stop"
          :loading="aborting"
          @click="$emit('abort')"
      >
        Stop
      </BasicButton>
      <BasicButton
          v-else
          class="btn btn-primary"
          icon="send"
          title="Submit answer"
          :disabled="!canSend"
          :loading="sending"
          @click="submit"
      >
        Submit
      </BasicButton>
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
      if (this.usesRadios) return this.optionLabelByValue(this.selectedOption);
      return this.answerDraft.trim();
    },
    answerValue() {
      if (this.usesCheckboxes) return this.selectedOptions;
      if (this.usesRadios) return this.selectedOption;
      return this.answerDraft.trim();
    },
    canSend() {
      return !this.readOnly && !this.isBusy && !!this.answerText;
    },
  },
  watch: {
    "question.id"() {
      this.typingStarted = false;
    },
  },
  methods: {
    /**
     * Records the first typed character for this question.
     *
     * @param {InputEvent} event - Textarea input event.
     * @returns {void}
     */
    handleTyping(event) {
      if (this.typingStarted || event.inputType === "insertFromPaste") return;
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
    handlePaste(event) {
      const pastedText = (event.clipboardData || window.clipboardData).getData("text");
      if (!pastedText) return;
      this.$emit("paste", {
        questionId: this.question.id,
        followUpIndex: this.question.followUpIndex || 0,
        pastedLength: pastedText.length,
      });
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
      if (option && typeof option === "object") return String(option.value ?? option.label ?? option.name);
      return String(option);
    },
    /**
     * Returns an option's display label.
     *
     * @param {*} option - Question option.
     * @returns {string} Option label.
     */
    optionLabel(option) {
      if (option && typeof option === "object") return String(option.label ?? option.name ?? option.value);
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
      if (!this.canSend) return;
      this.$emit("send", {
        answerText: this.answerText,
        answerValue: this.answerValue,
      });
    },
    /** Records an explicit skipped answer. */
    skip() {
      if (!this.allowSkip || this.isBusy || this.readOnly) return;
      this.$emit("send", {answerText: "", answerValue: null, skipped: true});
    },
  },
};
</script>

<style scoped>
.dialogue-textarea {
  resize: vertical;
}
</style>
