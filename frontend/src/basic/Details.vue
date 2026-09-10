<template>
  <div class="basic-details">
    <h6 v-if="heading" class="mb-3">{{ heading }}</h6>
    <div
      v-for="(section, sectionIndex) in resolvedSections"
      :key="section.title || `section-${sectionIndex}`"
      :class="{
        'mb-4': sectionIndex < resolvedSections.length - 1,
        'mb-3': sectionIndex === resolvedSections.length - 1 && $slots.default,
      }"
    >
      <h6 v-if="section.title" class="mb-2">{{ section.title }}</h6>
      <dl class="row mb-0 small">
        <template v-for="item in section.items" :key="item.key || item.label">
          <dt class="col-sm-4">{{ item.label }}</dt>
          <dd class="col-sm-8 text-break">
            <span
              v-if="item.type === 'badge'"
              class="badge"
              :class="item.class"
            >{{ displayValue(item.value) }}</span>
            <code v-else-if="item.type === 'code'">{{ displayValue(item.value) }}</code>
            <ol
              v-else-if="item.type === 'list' && listValues(item).length"
              class="mb-0 ps-3"
            >
              <li
                v-for="(entry, index) in listValues(item)"
                :key="`${item.key || item.label}-${index}`"
              >
                {{ entry }}
              </li>
            </ol>
            <span v-else>{{ displayValue(item.type === 'list' ? null : item.value) }}</span>
          </dd>
        </template>
      </dl>
    </div>
    <slot />
    <div v-if="note" class="alert alert-info mt-3 mb-0">
      <i class="bi bi-info-circle"></i>
      {{ note }}
    </div>
  </div>
</template>

<script>
/**
 * Read-only label/value list for review steps and overview modals.
 *
 * Pass a flat `items` array, or `sections` with `{ title, items }`.
 * Each item is `{ key, label, value, type?, class?, visible? }`.
 * `type` is `text` (default), `badge`, `code`, or `list`.
 */
export default {
  name: "BasicDetails",
  props: {
    heading: {
      type: String,
      default: "",
    },
    items: {
      type: Array,
      default: () => [],
    },
    sections: {
      type: Array,
      default: () => [],
    },
    note: {
      type: String,
      default: "",
    },
  },
  computed: {
    resolvedSections() {
      if (this.sections.length > 0) {
        return this.sections
          .map((section) => ({
            title: section.title || "",
            items: this.visibleItems(section.items),
          }))
          .filter((section) => section.items.length > 0);
      }
      const items = this.visibleItems(this.items);
      return items.length > 0 ? [{ title: "", items }] : [];
    },
  },
  methods: {
    visibleItems(items) {
      return (items || []).filter((item) => item && item.visible !== false);
    },
    displayValue(value) {
      if (value == null || value === "") return "-";
      return value;
    },
    listValues(item) {
      return Array.isArray(item.value) ? item.value.filter((entry) => entry != null && entry !== "") : [];
    },
  },
};
</script>
