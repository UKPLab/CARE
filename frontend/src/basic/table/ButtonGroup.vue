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
      @focusout="onMenuFocusOut"
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
        <div
          v-if="menuOpen"
          ref="menu"
          class="row-actions-menu"
          :class="{ 'row-actions-menu--up': menuPos.up }"
          :style="{ top: menuPos.top + 'px', left: menuPos.left + 'px' }"
          role="menu"
          @focusout="onMenuFocusOut"
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
    </Teleport>
  </div>
</template>

<script>
import TableButton from "./Button.vue";
import LoadIcon from "@/basic/Icon.vue";
import { focusLeftMenu, isDangerButton, splitRowActions } from "./helpers/rowActionsLayout.js";

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
      return splitRowActions(this.buttons, this.layout);
    },
  },
  watch: {
    // Row changed underneath (e.g. state update removed every menu entry)
    "actions.menu.length"(length) {
      if (length === 0 && this.menuOpen) this.closeMenu();
    },
  },
  beforeUnmount() {
    this.menuOpen = false;
    this.unbindMenuListeners();
  },
  methods: {
    isDanger: isDangerButton,
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
    onMenuFocusOut(event) {
      if (!this.menuOpen || !focusLeftMenu(event, this.$refs.menu, this.$refs.trigger)) return;
      this.closeMenu();
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

@media (prefers-reduced-motion: reduce) {
  .row-actions > .btn {
    transition: none;
  }

  .row-actions > .btn:active {
    transform: none;
  }
}
</style>

<style src="./row-actions-menu.css"></style>
