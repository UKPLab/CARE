<template>
  <div class="card my-3">
    <div class="card-header" style="cursor: pointer" @click="toggleCollapse">
      <LoadIcon :icon-name="isCollapsed ? 'arrow-right-short' : 'arrow-down-short'" class="me-1"></LoadIcon>
      {{ title }}
      <span v-if="description" class="text-secondary ms-2">
        <small>{{ description }}</small>
      </span>
    </div>
    <div v-if="!isCollapsed" class="card-body">
      <slot></slot>
    </div>
  </div>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";

/**
 * Collapsible - Collapsible section component for form fields
 * Used to group optional/advanced fields in forms to reduce clutter.
 *
 */
export default {
  name: "Collapsible",
  components: { LoadIcon },
  props: {
    title: {
      type: String,
      default: "Advanced Settings"
    },
    description: {
      type: String,
      required: false,
      default: null
    },
    collapsed: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {
      isCollapsed: true
    };
  },
  watch: {
    collapsed: {
      immediate: true,
      handler(newVal) {
        this.isCollapsed = newVal;
      }
    }
  },
  methods: {
    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed;
    }
  }
};
</script>

<style scoped>
.card-header {
  user-select: none;
}
</style>
