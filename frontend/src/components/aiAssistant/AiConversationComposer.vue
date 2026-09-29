<template>
  <form class="conversation-composer border-top bg-body p-2" @submit.prevent="$emit('send')">
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
            tooltip="Remove quote"
            @click="$emit('clear-quote')"
        />
      </div>

      <textarea
          ref="textarea"
          :value="modelValue"
          class="form-control composer-textarea border-0 shadow-none bg-transparent"
          rows="1"
          placeholder="Ask about this study..."
          :disabled="disabled"
          @input="onInput"
          @paste="onPaste"
          @keydown.enter.exact.prevent="$emit('send')"
      />

      <div class="composer-actions d-flex align-items-center justify-content-between gap-2 px-2 py-1">
        <div class="dropdown">
          <BasicButton
              class="btn btn-sm composer-model d-inline-flex align-items-center gap-1"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              :disabled="disabled"
          >
            <BasicIcon icon-name="cpu" :size="15" />
            <span class="composer-model-name">{{ selectedModelName }}</span>
            <BasicIcon icon-name="chevron-down" :size="14" />
          </BasicButton>
          <ul class="dropdown-menu composer-model-menu">
            <li><h6 class="dropdown-header">Switch model</h6></li>
            <li v-for="model in models" :key="model.id">
              <BasicButton
                  class="dropdown-item d-flex align-items-center gap-2"
                  :class="{active: Number(model.id) === selectedModelId}"
                  @click="$emit('update:selectedModelId', Number(model.id))"
              >
                <BasicIcon icon-name="cpu" :size="15" />
                <span class="model-option-name flex-grow-1">{{ model.name }}</span>
                <BasicIcon
                    v-if="Number(model.id) === selectedModelId"
                    icon-name="check2"
                    :size="15"
                />
              </BasicButton>
            </li>
            <li v-if="models.length === 0">
              <span class="dropdown-item disabled text-muted">No models available</span>
            </li>
          </ul>
        </div>

        <BasicButton
            v-if="pending"
            class="btn btn-outline-danger btn-sm rounded-circle composer-button"
            icon="stop-circle"
            tooltip="Abort"
            :disabled="aborting"
            @click="$emit('abort')"
        />
        <BasicButton
            v-else
            class="btn btn-primary btn-sm rounded-circle composer-button"
            icon="send"
            tooltip="Send"
            :disabled="!canSend"
            :loading="sending"
            @click="$emit('send')"
        />
      </div>
    </div>
  </form>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import BasicIcon from "@/basic/Icon.vue";

// Upper bound for the auto-growing textarea (roughly the old three-row height).
const MAX_TEXTAREA_HEIGHT = 100;

/**
 * AI conversation input with model selector.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "AiConversationComposer",
  components: {BasicButton, BasicIcon},
  props: {
    modelValue: {
      type: String,
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
    busy: {
      type: Boolean,
      required: false,
      default: false,
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
    pending: {
      type: Boolean,
      required: false,
      default: false,
    },
    readOnly: {
      type: Boolean,
      required: false,
      default: false,
    },
    quote: {
      type: Object,
      required: false,
      default: null,
    },
  },
  emits: ["update:modelValue", "update:selectedModelId", "send", "abort", "clear-quote", "paste"],
  computed: {
    disabled() {
      return this.busy || this.readOnly || this.models.length === 0;
    },
    selectedModelName() {
      const model = this.models.find((item) => Number(item.id) === this.selectedModelId);
      return model ? model.name : "Select model";
    },
    canSend() {
      return (
          !this.disabled &&
          !!this.selectedModelId &&
          this.modelValue.trim().length > 0
      );
    },
  },
  watch: {
    // Resize when the draft changes externally (e.g. cleared after a send).
    modelValue() {
      this.$nextTick(this.autoGrow);
    },
  },
  mounted() {
    this.autoGrow();
  },
  methods: {
    /** Focuses the message textarea when the composer is available. */
    focus() {
      this.$nextTick(() => {
        if (!this.disabled) this.$refs.textarea?.focus();
      });
    },
    /**
     * Emits the new draft and keeps the textarea sized to its content.
     *
     * @param {Event} event - Textarea input event.
     * @returns {void}
     */
    onInput(event) {
      this.$emit("update:modelValue", event.target.value);
      this.autoGrow();
    },
    /**
     * Emits pasted text.
     *
     * @param {ClipboardEvent} event - Paste event.
     * @returns {void}
     */
    onPaste(event) {
      const text = event.clipboardData?.getData("text") || "";
      if (text) this.$emit("paste", {pastedText: text});
    },
    /**
     * Grows the textarea with its content up to a fixed maximum height.
     *
     * @returns {void}
     */
    autoGrow() {
      const el = this.$refs.textarea;
      if (!el) return;
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

/* Subtle, borderless model picker; hover/focus stay on-theme. */
.composer-model {
  max-width: 220px;
  color: var(--bs-secondary-color);
}

.composer-model-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-model:hover:not(:disabled),
.composer-model:focus-visible {
  background-color: var(--bs-secondary-bg);
  color: var(--bs-body-color);
}

/* Ghost button: no border, ring, or shadow in any state, including the
   active/open (.show) state and BasicButton's own hover shadow. */
.composer-model,
.composer-model:hover,
.composer-model:focus,
.composer-model:focus-visible,
.composer-model:active,
.composer-model.active,
.composer-model.show {
  border-color: transparent !important;
  outline: none !important;
  box-shadow: none !important;
}

/* Roomier menu: consistent padding, rounded rows, a quiet section title. */
.composer-model-menu {
  min-width: 12rem;
  padding: 0.35rem;
}

.composer-model-menu .dropdown-header {
  padding: 0.25rem 0.6rem 0.4rem;
  font-size: 0.7rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--bs-secondary-color);
}

.composer-model-menu :deep(.dropdown-item) {
  padding: 0.4rem 0.6rem;
  border-radius: var(--bs-border-radius);
}

.model-option-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Items are BasicButton, so reach past its scoped styles with :deep. */
.dropdown-menu :deep(.dropdown-item:hover),
.dropdown-menu :deep(.dropdown-item:focus),
.dropdown-menu :deep(.dropdown-item:focus-visible) {
  background-color: var(--bs-secondary-bg);
  color: var(--bs-body-color);
  outline: none;
  box-shadow: none;
}

.dropdown-menu :deep(.dropdown-item.active) {
  background-color: var(--bs-primary-bg-subtle);
  color: var(--bs-primary-text-emphasis);
  border-color: transparent;
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
