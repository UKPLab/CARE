<template>
  <section
    v-if="elements.length"
    class="sidebar-favorites"
    :aria-label="$t('sidebar.favorites.title')"
  >
    <BasicButton
      ref="trigger"
      class="sidebar-favorites-heading"
      :class="{ 'is-open': isOpen }"
      :aria-label="$t('sidebar.favorites.title')"
      :title="$t('sidebar.favorites.title')"
      :aria-expanded="isOpen"
      aria-haspopup="dialog"
      aria-controls="sidebar-favorites-popover"
      @click="togglePopover"
      @keydown.esc.stop.prevent="closePopover(true)"
    >
      <span class="sidebar-icon">
        <LoadIcon icon-name="star-fill" />
      </span>
      <span v-if="!isCollapsed" class="list-group-item-text">
        {{ $t('sidebar.favorites.title') }}
      </span>
    </BasicButton>
  </section>

  <Teleport to="body">
    <div
      v-if="isOpen && elements.length"
      id="sidebar-favorites-popover"
      ref="popover"
      class="sidebar-favorites-popover"
      :style="popoverStyle"
      role="dialog"
      :aria-label="$t('sidebar.favorites.title')"
      tabindex="-1"
      @keydown.esc.stop.prevent="closePopover(true)"
    >
      <div class="sidebar-favorites-popover-heading">
        <LoadIcon icon-name="star-fill" />
        <span>{{ $t('sidebar.favorites.title') }}</span>
      </div>
      <SidebarNavItem
        v-for="element in elements"
        :key="element.id"
        :element="element"
        variant="favorite"
        :is-active="String(element.id) === String(activeElementId)"
        :is-favorite="true"
        :favorite-disabled="favoriteDisabled"
        @toggle-favorite="$emit('toggle-favorite', $event)"
        @navigate="closePopover"
      />
    </div>
  </Teleport>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import LoadIcon from "@/basic/Icon.vue";
import SidebarNavItem from "./SidebarNavItem.vue";
import { getSidebarPreviewStyle } from "./helpers/sidebarHoverPreview.js";

export default {
  name: "SidebarFavorites",
  components: { BasicButton, LoadIcon, SidebarNavItem },
  props: {
    elements: {
      type: Array,
      default: () => [],
    },
    activeElementId: {
      type: [Number, String],
      default: null,
    },
    isCollapsed: {
      type: Boolean,
      default: false,
    },
    favoriteDisabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["toggle-favorite"],
  data() {
    return {
      isOpen: false,
      popoverStyle: {},
    };
  },
  watch: {
    elements(nextElements) {
      if (!nextElements.length) {
        this.closePopover();
      } else if (this.isOpen) {
        this.$nextTick(this.updatePopoverPosition);
      }
    },
    isCollapsed() {
      if (this.isOpen) {
        this.$nextTick(this.updatePopoverPosition);
      }
    },
  },
  mounted() {
    document.addEventListener("transitionend", this.handleSidebarTransitionEnd, true);
    document.addEventListener("pointerdown", this.handleOutsidePointerDown);
    window.addEventListener("resize", this.updatePopoverPosition);
    window.addEventListener("scroll", this.updatePopoverPosition, true);
  },
  beforeUnmount() {
    document.removeEventListener("transitionend", this.handleSidebarTransitionEnd, true);
    document.removeEventListener("pointerdown", this.handleOutsidePointerDown);
    window.removeEventListener("resize", this.updatePopoverPosition);
    window.removeEventListener("scroll", this.updatePopoverPosition, true);
  },
  methods: {
    togglePopover() {
      if (this.isOpen) {
        this.closePopover();
        return;
      }

      this.isOpen = true;
      this.$nextTick(() => {
        this.updatePopoverPosition();
        this.$nextTick(() => this.$refs.popover?.focus({ preventScroll: true }));
      });
    },
    closePopover(restoreFocus = false) {
      if (!this.isOpen) {
        return;
      }

      this.isOpen = false;
      this.popoverStyle = {};
      if (restoreFocus) {
        this.$nextTick(() => this.$refs.trigger?.$el?.focus());
      }
    },
    handleOutsidePointerDown(event) {
      const target = event.target;
      if (
        !this.isOpen
        || !target
        || this.$refs.trigger?.$el?.contains(target)
        || this.$refs.popover?.contains(target)
      ) {
        return;
      }

      this.closePopover();
    },
    handleSidebarTransitionEnd(event) {
      if (event.target?.id === "sidebar-wrapper" && event.propertyName === "width") {
        this.updatePopoverPosition();
      }
    },
    updatePopoverPosition() {
      const trigger = this.$refs.trigger?.$el;
      const popover = this.$refs.popover;
      if (!this.isOpen || !trigger || !popover) {
        return;
      }

      const triggerRect = trigger.getBoundingClientRect();
      this.popoverStyle = getSidebarPreviewStyle(
        { right: triggerRect.right, top: triggerRect.bottom + 8 },
        popover.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight }
      );
    },
  },
};
</script>

<style>
.sidebar-favorites {
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid var(--bs-border-color, rgba(0, 0, 0, 0.125));
}

.sidebar-favorites-heading {
  display: flex !important;
  width: 100%;
  min-height: 52px;
  align-items: center;
  padding: 0.75rem 1rem;
  border: 0;
  border-radius: 0;
  background-color: var(--bs-tertiary-bg, #f2f2f2);
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-align: left;
}

.sidebar-favorites-heading:hover,
.sidebar-favorites-heading.is-open {
  background-color: var(--bs-body-bg, #fff);
}

.sidebar-favorites-heading:focus-visible {
  outline: 2px solid var(--bs-primary, #0d6efd);
  outline-offset: -2px;
}

.sidebar-favorites-popover {
  position: fixed;
  z-index: 10000;
  box-sizing: border-box;
  width: min(280px, calc(100vw - 16px));
  max-width: calc(100vw - 16px);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--bs-border-color, rgba(0, 0, 0, 0.125));
  border-radius: var(--bs-border-radius-lg, 0.5rem);
  background-color: var(--bs-tertiary-bg, #f2f2f2);
  color: inherit;
  box-shadow: 0 0.5rem 1.25rem rgba(0, 0, 0, 0.18);
  scrollbar-width: thin;
}

.sidebar-favorites-popover:focus {
  outline: none;
}

.sidebar-favorites-popover-heading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--bs-border-color, rgba(0, 0, 0, 0.125));
  font-weight: 600;
}

.sidebar-favorites-popover .sidebar-nav-item {
  border-bottom: 1px solid var(--bs-border-color, rgba(0, 0, 0, 0.08));
}

.sidebar-favorites-popover .sidebar-nav-item:last-child {
  border-bottom: 0;
}
</style>
