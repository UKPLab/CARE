<template>
  <button
    v-if="loading"
    :disabled="true"
    class="btn btn-sm"
    type="button"
  >
    <IconLoading
      :loading="true"
      size="12"
    />
  </button>
  <button
    v-else
    class="btn btn-sm position-relative border-0"
    data-placement="top"
    data-toggle="tooltip"
    :title="title"
    type="button"
    :disabled="disabled"
    @click="action"
  >
    <LoadIcon
      :icon-name="icon"
      :size="16"
    />
    <span class="visually-hidden">{{ title }}</span>
    <span v-if="badge" class="position-absolute top-0 start-85 translate-middle badge rounded-pill bg-dark">
      {{ badge}}
    </span>
  </button>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";
import IconLoading from "@/basic/icons/IconLoading.vue";

/**
 * Generic button for the sidebar
 *
 * Generic component providing a standardized button for the sidebar card footers.
 *
 * @author Nils Dycke, Dennis Zyska
 */
export default {
  name: "SidebarButton",
  components: {LoadIcon, IconLoading},
  inject: {
    acceptStats: {
      default: () => false
    }
  },
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
      required: false,
      default: null
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
    },
    "badge": {
      type: Number,
      required: false,
      default: null
    }

  },
  emits: ["click"],
  methods: {
    action() {
      this.$emit("click")
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "clickSidebarButton",
          data: {"title": this.title, "icon": this.icon, "props": this.props}
        });
      }
    }
  }
}
</script>

<style scoped>
.start-85 {
  left: 85% !important;
}
</style>