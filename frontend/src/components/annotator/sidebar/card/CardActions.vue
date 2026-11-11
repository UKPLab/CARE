<template>
  <div
    class="anno-actions"
    @click.stop
  >
    <BasicButton
      ref="trigger"
      class="btn-sm anno-actions-trigger care-focus-ring"
      icon="three-dots"
      text=""
      :title="$t('common.moreActions')"
      :aria-label="$t('common.moreActions')"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="toggle"
    />
    <div
      v-show="open"
      ref="menu"
      class="anno-actions-menu"
      role="menu"
      @click="closeMenu"
    >
      <slot />
    </div>
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";

// One card menu at a time. Table row menus are a different component.
let openAnnoMenu = null;

/**
 * "..." menu for a sidebar card. The slot keeps the existing action buttons.
 */
export default {
  name: "CardActions",
  components: { BasicButton },
  props: {
    placement: {
      type: String,
      required: false,
      default: "top",
    },
  },
  data() {
    return {
      open: false,
      listening: false,
    };
  },
  beforeUnmount() {
    this.closeMenu();
  },
  methods: {
    focusTrigger() {
      this.$refs.trigger?.$el?.focus();
    },
    bindMenuListeners() {
      if (this.listening) return;
      this.listening = true;
      document.addEventListener("click", this.onDocumentClick);
      document.addEventListener("keydown", this.onKeydown);
    },
    unbindMenuListeners() {
      if (!this.listening) return;
      this.listening = false;
      document.removeEventListener("click", this.onDocumentClick);
      document.removeEventListener("keydown", this.onKeydown);
    },
    closeMenu() {
      this.open = false;
      this.unbindMenuListeners();
      if (openAnnoMenu === this) openAnnoMenu = null;
    },
    toggle() {
      if (this.open) {
        this.closeMenu();
        return;
      }
      if (openAnnoMenu && openAnnoMenu !== this) {
        openAnnoMenu.closeMenu();
      }
      this.open = true;
      openAnnoMenu = this;
      this.bindMenuListeners();
      this.$nextTick(() => {
        const trigger = this.$refs.trigger?.$el;
        const menu = this.$refs.menu;
        if (!trigger || !menu) return;
        const rect = trigger.getBoundingClientRect();
        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        const below = this.placement === "bottom";
        const top = below ? rect.bottom + 4 : rect.top - menuHeight - 4;
        menu.style.top = `${Math.max(8, top)}px`;
        menu.style.left = `${Math.max(8, rect.right - menuWidth)}px`;
      });
    },
    onDocumentClick(event) {
      if (!this.open) return;
      if (this.$el.contains(event.target)) return;
      this.closeMenu();
    },
    onKeydown(event) {
      if (!this.open || event.key !== "Escape") return;
      this.closeMenu();
    },
  },
};
</script>

<style scoped>
.anno-actions {
  position: relative;
  display: flex;
  justify-content: flex-end;
}

.anno-actions-trigger {
  border: 0;
  color: var(--bs-body-color);
}

.anno-actions-menu {
  position: fixed;
  z-index: 1080;
  min-width: 11rem;
  display: flex;
  flex-direction: column;
  gap: .2rem;
  padding: .4rem;
  border: 1px solid var(--bs-border-color-translucent);
  border-radius: 8px;
  background: var(--bs-body-bg);
  box-shadow: 0 8px 20px -8px rgb(var(--care-shadow-rgb) / .28);
}

.anno-actions-menu :deep(button) {
  display: flex;
  align-items: center;
  gap: .55rem;
  width: 100%;
  margin: 0;
  padding: .5rem .7rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--bs-body-color);
  text-align: left;
  white-space: nowrap;
}

.anno-actions-menu :deep(button)::after {
  content: attr(title);
}

.anno-actions-menu :deep(button:not(:has(.visually-hidden)))::after {
  content: none;
}

.anno-actions-menu :deep(.visually-hidden) {
  display: none;
}

.anno-actions-menu :deep(button:hover) {
  background: var(--bs-tertiary-bg);
}

.anno-actions-menu :deep(.anno-action-danger) {
  color: var(--bs-danger);
}
</style>
