<template>
  <section class="collapsible">
    <button
      type="button"
      class="collapsible-header"
      :aria-expanded="!isCollapsed"
      @click="toggleCollapse"
    >
      <LoadIcon
        icon-name="chevron-right"
        class="collapsible-chevron"
        :class="{ open: !isCollapsed }"
      />
      <span class="collapsible-title">{{ title || $t("basic.form.advancedSettings") }}</span>
      <small v-if="description" class="text-secondary">{{ description }}</small>
    </button>
    <div v-if="!isCollapsed" class="collapsible-body">
      <slot></slot>
    </div>
  </section>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";

/**
 * Collapsible - Collapsible section for forms and settings.
 * Used to group optional/advanced fields (e.g. Mail step SMTP/sendmail config) to reduce clutter.
 *
 * @param {string} [title] - Section title (default: "Advanced Settings")
 * @param {string} [description] - Optional description shown next to the title
 * @param {boolean} [collapsed] - Initial collapsed state (default: true)
 */
export default {
  name: "FormCollapsible",
  components: { LoadIcon },
  props: {
    title: {
      type: String,
      default: null
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
.collapsible {
  border-bottom: 1px solid var(--bs-border-color-translucent);
}

.collapsible-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 8px;
  border: 0;
  border-radius: var(--bs-border-radius);
  background: transparent;
  color: var(--bs-body-color);
  text-align: left;
  user-select: none;
}

.collapsible-header:hover {
  background: var(--bs-tertiary-bg);
}

.collapsible-title {
  font-weight: 600;
}

.collapsible-chevron {
  color: var(--bs-secondary-color);
  transition: transform var(--care-dur-fast) var(--care-ease);
}

.collapsible-chevron.open {
  transform: rotate(90deg);
}

.collapsible-body {
  padding: 4px 8px 16px 32px;
}
</style>
