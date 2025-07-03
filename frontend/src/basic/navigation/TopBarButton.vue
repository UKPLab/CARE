<template>
  <button
    :title="title"
    class="btn"
    type="button"
    :disabled="disabled"
    @click="action"
  >
    <LoadIcon
      v-if="icon"
      :icon-name="icon"
    />
    <span><slot>{{ buttonText }}</slot></span>
  </button>
</template>


<script>
import LoadIcon from "@/basic/Icon.vue";

/**
 *  Topbar button acts a button in the topbar that can be clicked to perform an action.
 *
 * @param {String} title - The title of the button.
 * @param {Object} props - The props to be passed to the button.
 * @param {String} text - The text to be displayed on the button.
 * @param {Boolean} disabled - Whether the button is disabled.
 *
 * @author: Manu Sundar Raj Nandyal
 */

export default {
  name: "TopBarButton",
  components: {LoadIcon},
  inject: {
    acceptStats: {
      default: () => false
    },
    studySessionId: { 
      default: () => null 
    },
    currentStudyStep: { 
      default: () => null 
    },
    documentId: { 
      default: () => null 
    } 
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
    disabled: {
      type: Boolean,
      required: false,
      default: false
    }
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
          action: "clickTopBarButton",
          data: {
            ...(this.title ? { title: this.title } : {}),
            ...(this.icon ? { icon: this.icon } : {}),
            ...(this.props ? { props: this.props } : {}),
            ...(this.studySessionId ? { studySessionId: this.studySessionId } : {}),
            ...(this.currentStudyStep ? { currentStudyStepId: this.currentStudyStep.id } : {}),
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