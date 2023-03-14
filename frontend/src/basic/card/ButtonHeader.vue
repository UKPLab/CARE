<template>
  <button
      :title="title"
      class="btn btn-sm me-1"
      type="button"
      @click="action"
  >
    <LoadIcon
        v-if="icon"
        :icon-name="icon"
    />
    {{ buttonText }}
  </button>
</template>

<script>
import LoadIcon from "@/icons/LoadIcon.vue";

export default {
  name: "ButtonHeader",
  components: {LoadIcon},
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
      this.$socket.emit("stats", {
        action: "clickCardButton",
        data: {"title": this.title, "icon": this.icon, "props": this.props}
      });
    }
  }
}
</script>

<style scoped>

</style>