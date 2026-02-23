<template>
  <div class="card my-3">
    <div class="card-header collapsible-header" style="cursor: pointer" @click="toggleCollapse">
      <LoadIcon :icon-name="isCollapsed ? 'arrow-right-short' : 'arrow-down-short'" class="me-1"></LoadIcon>
      <span class="collapsible-title">{{ title }}</span>
      <span v-if="description" class="text-secondary ms-2 collapsible-description">
        {{ description }}
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
 * Collapsible - Card-based collapsible section for forms.
 * Used to group optional/advanced fields (e.g. Mail step SMTP/sendmail config) to reduce clutter.
 *
 * @param {string} [title] - Section title (default: "Advanced Settings")
 * @param {string} [description] - Optional description shown next to the title
 * @param {boolean} [collapsed] - Initial collapsed state (default: true)
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

.collapsible-header {
  font-size: 1.1rem;
  font-weight: 600;
}

.collapsible-title {
  font-size: 1.1rem;
  font-weight: 600;
}

.collapsible-description {
  font-size: 0.9rem;
  font-weight: 400;
}
</style>
