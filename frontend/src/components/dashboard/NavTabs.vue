<template>
  <ul class="nav nav-tabs mb-3">
    <li
      v-for="tab in tabs"
      :key="tab.key"
      class="nav-item"
    >
      <BasicButton
        class="nav-link"
        :class="{ active: modelValue === tab.key }"
        @click="$emit('update:modelValue', tab.key)"
      >
        {{ tab.label }}
        <span
          v-if="tab.count != null"
          class="badge bg-secondary ms-1"
        >{{ tab.count }}</span>
      </BasicButton>
    </li>
  </ul>
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
.nav-tabs :deep(.nav-link.btn) {
  background-color: transparent;
  border-color: transparent;
  border-radius: var(--bs-nav-tabs-border-radius) var(--bs-nav-tabs-border-radius) 0 0;
  box-shadow: none;
  color: var(--bs-nav-link-color);
}

.nav-tabs :deep(.nav-link.btn:hover) {
  box-shadow: none;
  border-color: var(--bs-nav-tabs-link-hover-border-color);
}

.nav-tabs :deep(.nav-link.btn.active) {
  background-color: var(--bs-nav-tabs-link-active-bg);
  border-color: var(--bs-nav-tabs-link-active-border-color);
  color: var(--bs-nav-tabs-link-active-color);
}
</style>
