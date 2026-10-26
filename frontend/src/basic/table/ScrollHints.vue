<template>
  <div
    v-if="frame && (left || right)"
    class="table-scroll-hints"
    :style="{
      top: frame.top + 'px',
      left: frame.left + 'px',
      width: frame.width + 'px',
      height: frame.height + 'px',
    }"
  >
    <div
      class="table-scroll-fade table-scroll-fade--left"
      :class="{ 'is-visible': left }"
    ></div>
    <div
      class="table-scroll-fade table-scroll-fade--right"
      :class="{ 'is-visible': right }"
    ></div>
    <button
      v-show="left"
      type="button"
      class="table-scroll-btn table-scroll-btn--left"
      :aria-label="$t('common.scrollTableLeft')"
      :title="$t('common.scrollTableLeft')"
      @click="$emit('scroll', -1)"
    >
      <LoadIcon
        icon-name="chevron-left"
        :size="14"
      />
    </button>
    <button
      v-show="right"
      type="button"
      class="table-scroll-btn table-scroll-btn--right"
      :aria-label="$t('common.scrollTableRight')"
      :title="$t('common.scrollTableRight')"
      @click="$emit('scroll', 1)"
    >
      <LoadIcon
        icon-name="chevron-right"
        :size="14"
      />
    </button>
  </div>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";

/**
 * Edge fade and chevron buttons signalling that a table scrolls sideways.
 *
 * Purely presentational: Table.vue / BackendTable.vue compute state and geometry
 * via helpers/tableScrollHints.js and render this next to `.table-wrapper`
 * inside a `position: relative` frame.
 */
export default {
  name: "TableScrollHints",
  components: { LoadIcon },
  props: {
    /** More content hidden on the left */
    left: {
      type: Boolean,
      default: false,
    },
    /** More content hidden on the right */
    right: {
      type: Boolean,
      default: false,
    },
    /** Overlay box in px relative to the frame: { top, left, width, height } */
    frame: {
      type: Object,
      default: null,
    },
  },
  emits: ["scroll"],
};
</script>

<style scoped>
.table-scroll-hints {
  position: absolute;
  z-index: 8; /* above sticky header (4) and fixed columns (up to 7) */
  pointer-events: none;
  --table-scroll-shade: rgb(0 0 0 / 0.07);
}

[data-bs-theme="dark"] .table-scroll-hints {
  --table-scroll-shade: rgb(0 0 0 / 0.35);
}

.table-scroll-fade {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 28px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.table-scroll-fade.is-visible {
  opacity: 1;
}

.table-scroll-fade--left {
  left: 0;
  background: linear-gradient(to right, var(--table-scroll-shade), transparent);
}

.table-scroll-fade--right {
  right: 0;
  background: linear-gradient(to left, var(--table-scroll-shade), transparent);
}

/* Small, quiet round button; vertically centred but never taller than the header + a row */
.table-scroll-btn {
  position: absolute;
  top: min(50%, 4.5rem);
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  pointer-events: auto;
  color: var(--bs-secondary-color);
  background: color-mix(in srgb, var(--bs-body-bg) 88%, transparent);
  border: 1px solid var(--bs-border-color);
  border-radius: 50%;
  box-shadow: var(--care-shadow-1, 0 1px 2px rgb(0 0 0 / 0.1));
  opacity: 0.8;
  cursor: pointer;
  transition: opacity 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}

.table-scroll-btn--left {
  left: 6px;
}

.table-scroll-btn--right {
  right: 6px;
}

.table-scroll-btn:hover,
.table-scroll-btn:focus-visible {
  opacity: 1;
  color: var(--bs-emphasis-color);
  background: var(--bs-secondary-bg);
}

.table-scroll-btn:focus-visible {
  outline: 2px solid var(--care-primary, var(--bs-primary));
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .table-scroll-fade,
  .table-scroll-btn {
    transition: none;
  }
}
</style>
