<template>
  <div class="btn-group btn-group-sm row-actions">
    <TableButton
      v-for="b in actions.inline"
      :key="b.action"
      :action="b.action"
      :icon="b.icon"
      :options="b.options"
      :params="params"
      :stats="b.stats"
      :title="b.title"
      @action="actionEmitter"
    />
    <button
      v-if="actions.menu.length > 0"
      ref="trigger"
      type="button"
      class="btn btn-sm btn-outline-secondary row-actions-more"
      :class="{ 'is-open': menuOpen }"
      :title="$t('common.moreActions')"
      :aria-label="$t('common.moreActions')"
      aria-haspopup="menu"
      :aria-expanded="menuOpen"
      @click.stop="toggleMenu"
    >
      <LoadIcon
        icon-name="three-dots"
        :size="16"
      />
    </button>

    <!-- Teleported: the table wrapper clips overflow and sticky cells stack above rows. -->
    <Teleport
      v-if="actions.menu.length > 0"
      to="body"
    >
      <Transition name="row-actions-menu">
        <div
          v-if="menuOpen"
          ref="menu"
          class="row-actions-menu"
          :class="{ 'row-actions-menu--up': menuPos.up }"
          :style="{ top: menuPos.top + 'px', left: menuPos.left + 'px' }"
          role="menu"
          @keydown.esc.prevent.stop="closeMenu(true)"
          @keydown.down.prevent="moveFocus(1)"
          @keydown.up.prevent="moveFocus(-1)"
          @keydown.tab="closeMenu(false)"
        >
          <template
            v-for="(b, index) in actions.menu"
            :key="b.action"
          >
            <div
              v-if="isDanger(b) && index > 0 && !isDanger(actions.menu[index - 1])"
              class="row-actions-menu-divider"
              role="separator"
            />
            <button
              type="button"
              role="menuitem"
              class="row-actions-menu-item"
              :class="{ 'row-actions-menu-item--danger': isDanger(b) }"
              @click="menuAction(b)"
            >
              <LoadIcon
                v-if="b.icon"
                :icon-name="b.icon"
                :size="15"
              />
              <span>{{ b.title }}</span>
            </button>
          </template>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script>
import TableButton from "./Button.vue";
import LoadIcon from "@/basic/Icon.vue";

/** Inline icons shown by default before the rest moves into the "more" menu. */
const DEFAULT_MAX_INLINE = 3;

/**
 * Row actions for the table manage column.
 *
 * Shows the main actions as icons and collapses the rest into a "more" (three dots)
 * menu, like the study cards. Destructive actions (btn-outline-danger) always come
 * last and are never promoted inline while there is a menu, so delete is never the
 * first icon in a row.
 *
 * Layout options (`layout` prop, usually `options.rowActions` of the table):
 * - `maxInline`: icons kept inline (default 3). One extra action is shown inline
 *   instead of a menu holding a single entry. Use `Infinity` to never collapse.
 * - `inline`: action names to prefer inline, in this order (e.g. the page's main action).
 * - `menuOnly`: action names that always go into the menu.
 */
export default {
  name: "ButtonGroup",
  components: { TableButton, LoadIcon },
  props: {
    buttons: {
      type: Array,
      required: true,
    },
    params: {
      type: Object,
      required: false,
      default: null,
    },
    layout: {
      type: Object,
      required: false,
      default: () => ({}),
    },
  },
  emits: ["action"],
  data() {
    return {
      menuOpen: false,
      menuPos: { top: 0, left: 0, up: false },
    };
  },
  computed: {
    actions() {
      const maxInline = this.layout?.maxInline ?? DEFAULT_MAX_INLINE;
      const preferredNames = this.layout?.inline || [];
      const menuOnly = this.layout?.menuOnly || [];

      const ordered = [
        ...this.buttons.filter((b) => !this.isDanger(b)),
        ...this.buttons.filter((b) => this.isDanger(b)),
      ];
      if (ordered.length <= maxInline + 1) {
        return { inline: ordered, menu: [] };
      }

      const preferred = preferredNames
        .map((name) => ordered.find((b) => b.action === name))
        .filter((b) => b && !this.isDanger(b));
      const fill = ordered.filter(
        (b) => !this.isDanger(b) && !preferred.includes(b) && !menuOnly.includes(b.action)
      );
      const inline = [...preferred, ...fill].slice(0, maxInline);
      return { inline, menu: ordered.filter((b) => !inline.includes(b)) };
    },
  },
  watch: {
    // Row changed underneath (e.g. state update removed every menu entry)
    "actions.menu.length"(length) {
      if (length === 0 && this.menuOpen) this.closeMenu();
    },
  },
  beforeUnmount() {
    this.unbindMenuListeners();
  },
  methods: {
    isDanger(button) {
      return !!button?.options?.specifiers?.["btn-outline-danger"];
    },
    actionEmitter(data) {
      this.$emit("action", data);
    },
    menuAction(button) {
      this.closeMenu(true);
      this.$emit("action", { action: button.action, params: this.params, stats: button.stats });
    },
    toggleMenu() {
      if (this.menuOpen) {
        this.closeMenu();
        return;
      }
      const rect = this.$refs.trigger.getBoundingClientRect();
      this.menuPos = { top: rect.bottom + 6, left: rect.right, up: false };
      this.menuOpen = true;
      this.bindMenuListeners();
      this.$nextTick(() => {
        const menu = this.$refs.menu;
        if (!menu) return;
        // Flip upwards when the menu would run off the bottom of the viewport
        if (rect.bottom + 6 + menu.offsetHeight > window.innerHeight - 8) {
          this.menuPos = { top: rect.top - 6, left: rect.right, up: true };
        }
        menu.querySelector("button")?.focus({ preventScroll: true });
      });
    },
    closeMenu(restoreFocus = false) {
      if (!this.menuOpen) return;
      this.menuOpen = false;
      this.unbindMenuListeners();
      if (restoreFocus) this.$refs.trigger?.focus?.({ preventScroll: true });
    },
    moveFocus(step) {
      const items = [...(this.$refs.menu?.querySelectorAll("button") || [])];
      if (items.length === 0) return;
      const current = items.indexOf(document.activeElement);
      const next = (current + step + items.length) % items.length;
      items[next].focus({ preventScroll: true });
    },
    bindMenuListeners() {
      this.unbindMenuListeners();
      this._onMenuPointer = (e) => {
        if (this.$refs.menu?.contains(e.target) || this.$refs.trigger?.contains(e.target)) return;
        this.closeMenu();
      };
      // The menu is fixed to the viewport, so any scroll would detach it from its row
      this._onMenuViewport = () => this.closeMenu();
      document.addEventListener("pointerdown", this._onMenuPointer, true);
      window.addEventListener("scroll", this._onMenuViewport, true);
      window.addEventListener("resize", this._onMenuViewport);
    },
    unbindMenuListeners() {
      if (!this._onMenuPointer) return;
      document.removeEventListener("pointerdown", this._onMenuPointer, true);
      window.removeEventListener("scroll", this._onMenuViewport, true);
      window.removeEventListener("resize", this._onMenuViewport);
      this._onMenuPointer = null;
      this._onMenuViewport = null;
    },
  },
};
</script>

<style scoped>
.row-actions {
  flex-wrap: nowrap;
  gap: 2px;
}

/* Separate ghost icons (TableButton roots and the "more" trigger); destructive
   ones turn red only on hover. !important beats btn-group's joined corners. */
.row-actions > .btn {
  --bs-btn-color: var(--bs-secondary-color);
  --bs-btn-bg: transparent;
  --bs-btn-border-color: transparent;
  --bs-btn-hover-color: var(--bs-emphasis-color);
  --bs-btn-hover-bg: rgba(var(--bs-secondary-rgb), 0.12);
  --bs-btn-hover-border-color: transparent;
  --bs-btn-active-color: var(--bs-emphasis-color);
  --bs-btn-active-bg: rgba(var(--bs-secondary-rgb), 0.18);
  --bs-btn-active-border-color: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-width: 30px;
  height: 30px;
  padding: 0 0.4rem;
  border-radius: 8px !important;
  transition: background-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
}

.row-actions > .btn:active {
  transform: scale(0.92);
}

.row-actions > .btn-outline-danger {
  --bs-btn-hover-color: var(--bs-danger);
  --bs-btn-hover-bg: rgba(var(--bs-danger-rgb), 0.1);
  --bs-btn-active-color: var(--bs-danger);
  --bs-btn-active-bg: rgba(var(--bs-danger-rgb), 0.16);
}

.row-actions-more.is-open {
  color: var(--bs-emphasis-color);
  background-color: rgba(var(--bs-secondary-rgb), 0.12);
}

.row-actions-menu {
  position: fixed;
  z-index: 1080;
  min-width: 200px;
  max-width: 280px;
  padding: 0.3rem;
  translate: -100% 0;
  transform-origin: top right;
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color-translucent);
  border-radius: 10px;
  box-shadow: var(--care-shadow-2, 0 4px 10px -2px rgb(0 0 0 / 0.15));
}

.row-actions-menu--up {
  translate: -100% -100%;
  transform-origin: bottom right;
}

[data-bs-theme="dark"] .row-actions-menu {
  background: color-mix(in srgb, var(--bs-body-bg) 90%, #ffffff 10%);
  border-color: rgba(255, 255, 255, 0.1);
}

.row-actions-menu-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.45rem 0.6rem;
  font-size: 0.85rem;
  text-align: left;
  white-space: nowrap;
  color: var(--bs-body-color);
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.row-actions-menu-item span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-actions-menu-item :deep(svg) {
  flex: 0 0 auto;
  color: var(--bs-secondary-color);
  transition: color 0.12s ease;
}

.row-actions-menu-item:hover,
.row-actions-menu-item:focus-visible {
  outline: none;
  background: rgba(var(--bs-secondary-rgb), 0.12);
}

.row-actions-menu-item:hover :deep(svg),
.row-actions-menu-item:focus-visible :deep(svg) {
  color: var(--bs-emphasis-color);
}

.row-actions-menu-item--danger,
.row-actions-menu-item--danger :deep(svg),
.row-actions-menu-item--danger:hover :deep(svg),
.row-actions-menu-item--danger:focus-visible :deep(svg) {
  color: var(--bs-danger);
}

.row-actions-menu-item--danger:hover,
.row-actions-menu-item--danger:focus-visible {
  background: rgba(var(--bs-danger-rgb), 0.1);
}

.row-actions-menu-divider {
  height: 1px;
  margin: 0.3rem 0.4rem;
  background: var(--bs-border-color-translucent);
}

.row-actions-menu-enter-active,
.row-actions-menu-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}

.row-actions-menu-enter-from,
.row-actions-menu-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .row-actions-menu-enter-active,
  .row-actions-menu-leave-active,
  .row-actions-menu-item,
  .row-actions-menu-item :deep(svg),
  .row-actions > .btn {
    transition: none;
  }

  .row-actions > .btn:active {
    transform: none;
  }
}
</style>
