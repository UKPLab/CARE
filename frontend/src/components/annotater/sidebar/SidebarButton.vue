<template>
  <button v-if="loading" :disabled="true" class="btn btn-sm" type="button">
    <IconLoading :loading="true" size="12"></IconLoading>
  </button>
  <button v-else class="btn btn-sm" data-placement="top" data-toggle="tooltip"
          title="Edit" type="button" v-on:click="action" :disabled="disabled">
    <LoadIcon :iconName="icon" :size="16"></LoadIcon>
    <span class="visually-hidden">{{ title }}</span>
  </button>
</template>

<script>
import LoadIcon from "@/icons/LoadIcon.vue";
import IconLoading from "@/icons/IconLoading.vue";

export default {
  name: "SidebarButton.vue",
  components: {LoadIcon, IconLoading},
  emits: ["click"],
  props: {
    "icon": {
      type: String,
      required: true
    },
    "title": {
      type: String,
      required: true,
    },
    "props": {
      type: Object,
      required: false
    },
    "loading": {
      type: Boolean,
      required: false,
      default: false
    },
    "disabled": {
      type: Boolean,
      required: false,
      default: false
    }

  },
  methods: {
    action() {
      this.$emit("click")
      this.$socket.emit("stats", {
        action: "clickSidebarButton",
        data: {"title": this.title, "icon": this.icon, "props": this.props}
      });
    }
  }
}
</script>

<style scoped>

</style>