<template>
  <button
    :title="title"
    class="btn"
    type="button"
    @click="action"
  >
    <!-- class="btn btn-sm me-1" -->
    <LoadIcon
      v-if="icon"
      :icon-name="icon"
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
    documentId: { default: () => null } 
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
  },
  emits: ["click"],
  computed: {
    buttonText() {
      return this.text ? this.text : this.title
    }
  },
  methods: {
    action() {
      this.$emit("click")
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "clickCardButton",
          data: {
            "title": this.title, 
            "icon": this.icon, 
            "props": this.studyId,
            ...(this.studySessionId ? { studySessionId: this.studySessionId } : {}),
            ...(this.currentStudyStep ? { currentStudyStep: this.currentStudyStep } : {}),
            ...(this.documentId ? { documentId: this.documentId } : {})
          }
        });
      }
    }
  }
}
</script>

<style scoped>

</style>