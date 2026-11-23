<template>
  <div
    class="care-nav-tabs"
    role="tablist"
  >
    <BasicButton
      v-for="tab in tabs"
      :key="tab.key"
      class="care-nav-tab"
      :class="{ active: modelValue === tab.key }"
      role="tab"
      :aria-selected="modelValue === tab.key ? 'true' : 'false'"
      @click="$emit('update:modelValue', tab.key)"
    >
      {{ tab.label }}
      <span
        v-if="tab.count != null"
        class="care-nav-tab-count"
      >{{ tab.count }}</span>
    </BasicButton>
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";

/**
 * Dashboard tab bar. Pass optional tab.count to show the badge, including 0.
 * Leave count off and the tab is only a label.
 */
export default {
  name: "NavTabs",
  components: { BasicButton },
  props: {
    tabs: {
      type: Array,
      required: true,
    },
    modelValue: {
      type: String,
      required: true,
    },
  },
  emits: ["update:modelValue"],
};
</script>

<style scoped>
.care-nav-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--care-card-border);
}

.care-nav-tabs :deep(.care-nav-tab.btn) {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: -1px;
  padding: 0.5rem 0.85rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--care-card-muted);
  background: transparent;
  border: 0;
  border-radius: var(--care-radius-md) var(--care-radius-md) 0 0;
  box-shadow: none;
  transition: color var(--care-dur-fast) var(--care-ease), background-color var(--care-dur-fast) var(--care-ease);
}

.care-nav-tabs :deep(.care-nav-tab.btn)::after {
  content: "";
  position: absolute;
  right: 0.5rem;
  bottom: 0;
  left: 0.5rem;
  height: 2px;
  background: var(--care-accent);
  border-radius: var(--care-radius-pill);
  transform: scaleX(0);
  transition: transform var(--care-dur-fast) var(--care-ease);
}

.care-nav-tabs :deep(.care-nav-tab.btn:is(:hover, :focus-visible)) {
  color: var(--care-card-text);
  background: var(--care-hover);
}

.care-nav-tabs :deep(.care-nav-tab.btn.active) {
  color: var(--care-accent);
  background: transparent;
}

.care-nav-tabs :deep(.care-nav-tab.btn.active)::after {
  transform: scaleX(1);
}

.care-nav-tab-count {
  min-width: 1.5rem;
  padding: 0.05rem 0.45rem;
  font-size: 0.75rem;
  font-weight: 650;
  line-height: 1.4;
  text-align: center;
  color: var(--care-card-muted);
  background: color-mix(in srgb, var(--care-card-muted) 14%, transparent);
  border-radius: var(--care-radius-pill);
}

.active .care-nav-tab-count {
  color: var(--care-accent);
  background: color-mix(in srgb, var(--care-accent) 14%, transparent);
}

@media (prefers-reduced-motion: reduce) {
  .care-nav-tabs :deep(.care-nav-tab.btn),
  .care-nav-tabs :deep(.care-nav-tab.btn)::after {
    transition: none;
  }
}
</style>
