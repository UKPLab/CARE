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
    currentStep: { 
      default: () => null 
    },
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
      console.log("karim", this.currentStep)
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "clickTopBarButton",
          data: {
            "title": this.title, 
            "icon": this.icon, 
            "props": this.props,
            "studySessionId": this.studySessionId,
            "currentStep": this.currentStep,
            }
        });
      }
    }
  }
}
</script>

<style scoped>

</style>