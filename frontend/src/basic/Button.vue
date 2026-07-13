<template>
  <button
    :title="tooltip || title"
    :disabled="disabled || loading"
    class="btn"
    type="button"
    @click="action"
  >
    <span
      v-if="loading"
      class="spinner-border spinner-border-sm"
      :class="{ 'me-2': buttonText }"
      role="status"
    >
      <span class="visually-hidden">Loading...</span>
    </span>
    <slot v-else-if="$slots.default" />
    <template v-else>
      <LoadIcon
        v-if="icon"
        :rotate="rotateIcon? rotateIcon : null"
        :icon-name="icon"
        :color="iconColor"
      />
      {{ buttonText }}
    </template>
  </button>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";

export default {
  name: "BasicButton",
  components: {LoadIcon},
  inject: {
    acceptStats: { default: () => false },
    studySessionId: { default: () => null },
    currentStudyStep: { default: () => null },
    documentId: { default: () => null },
    studyStepId: { default: () => null },
  },
  props: {
    icon: {
      type: String,
      required: false,
      default: null
    },
    title: {
      type: String,
      required: false,
      default: null
    },
    tooltip: {
      type: String,
      required: false,
      default: null
    },
    "props": {
      type: Object,
      required: false,
      default: null
    },
    text: {
      type: String,
      required: false,
      default: null
    },
    rotateIcon: {
      type: Number,
      required: false,
      default: null
    },
    iconColor: {
      type: String,
      required: false,
      default: null
    },
    disabled: {
      type: Boolean,
      required: false,
      default: false
    },
    loading: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  emits: ["click"],
  computed: {
    buttonText() {
      return this.text !== null ? this.text : this.title
    }
  },
  methods: {
    action() {
      if (this.loading || this.disabled) {
        return;
      }
      this.$emit("click")
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "clickCardButton",
          data: {
            ...(this.title ? { title: this.title } : {}),
            ...(this.icon ? { icon: this.icon } : {}),
            ...(this.props ? { props: this.props } : {}),
            ...(this.studySessionId ? { studySessionId: this.studySessionId } : {}),
            ...(this.currentStudyStep && this.currentStudyStep.id ? { currentStudyStepId: this.currentStudyStep.id } : {}),
            ...(this.documentId ? { documentId: this.documentId } : {}),
            ...(this.studyStepId ? { studyStepId: this.studyStepId } : {}),
          }
        });
      }
    }
  }
}
</script>

<style scoped>
.btn {
  transition: box-shadow 0.2s ease-in-out;
}

.btn:hover:not(:disabled) {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>