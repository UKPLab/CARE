<template>
  <button
    :title="tooltip || title"
    :disabled="disabled"
    class="btn"
    :type="nativeType"
    @click="action"
  >
    <!-- class="btn btn-sm me-1" -->
    <LoadIcon    
      v-if="icon"
      :rotate="rotateIcon? rotateIcon : null"
      :icon-name="icon"
      :color="iconColor"
    />
    {{ buttonText }}
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
    nativeType: {
      type: String,
      required: false,
      default: "button",
      validator: (value) => ["button", "submit", "reset"].includes(value),
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