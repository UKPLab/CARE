<template>
  <!-- A trigger click must not also act on what contains it (table row, card). -->
  <span
    ref="root"
    class="popup-menu-anchor"
    @click.capture="noteClick"
    @click.stop
    @keydown="onKeydown"
    @focusout="onFocusOut"
  >
    <slot
      name="trigger"
      :open="open"
      :toggle="toggle"
    >
      <BasicButton
        :class="triggerClass"
        :title="triggerTitle"
        :aria-label="triggerTitle"
        aria-haspopup="menu"
        :aria-expanded="open"
        @click="toggle"
      >
        <LoadIcon
          :icon-name="icon"
          :size="16"
        />
      </BasicButton>
    </slot>

    <Teleport
      :to="teleportTarget"
      :disabled="!teleport"
    >
      <div
        v-if="open || $slots.default"
        v-show="open"
        ref="menu"
        class="care-menu"
        :class="[menuClass, { 'is-up': up }]"
        :style="{ top: pos.top + 'px', left: pos.left + 'px' }"
        role="menu"
        @click="onMenuClick"
        @keydown="onKeydown"
        @focusout="onFocusOut"
      >
        <slot>
          <template
            v-for="(item, index) in items"
            :key="item.key"
          >
            <div
              v-if="item.danger && index > 0 && !items[index - 1].danger"
              class="popup-menu-divider"
              role="separator"
            />
            <button
              type="button"
              role="menuitem"
              class="popup-menu-item"
              :class="{ 'popup-menu-item--danger': item.danger }"
              :disabled="item.disabled"
              @click="select(item)"
            >
              <LoadIcon
                v-if="item.icon"
                :icon-name="item.icon"
                :size="15"
              />
              <span>{{ item.label }}</span>
            </button>
          </template>
        </slot>
      </div>
    </Teleport>
  </span>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import LoadIcon from "@/basic/Icon.vue";
import { bindPopupListeners, focusLeftMenu, nextEnabledIndex, popupTeleportTarget } from "@/basic/form/listbox";

/** Distance kept between the menu and the viewport edges. */
const VIEWPORT_MARGIN = 8;

/** The one open menu in the app; opening another closes it. */
let openMenu = null;

/**
 * "..." button with a popup action menu (table rows, card footers, dashboard headers).
 *
 * Usage:
 * <BasicPopupMenu
 *   :items="[{ key: 'edit', label: 'Edit', icon: 'pencil' }, { key: 'delete', label: 'Delete', icon: 'trash', danger: true }]"
 *   @select="onAction"
 * />
 *
 * Items: { key, label, icon?, danger?, disabled? }. Danger items belong at the end; a divider
 * separates them from the rest. `select` emits the clicked item, so extra fields come back too.
 * Instead of items, the default slot can hold custom menu content (kept mounted while closed,
 * and any click in it closes the menu).
 *
 * Slot `trigger` ({ open, toggle }) replaces the default BasicButton trigger.
 *
 * The menu is fixed to the viewport: it opens below (or above, see `placement`) and flips
 * when there is no room, and closes on outside press, scroll, resize, Escape and Tab.
 * Keyboard: arrows / Home / End move over enabled items; opening by keyboard focuses the first.
 *
 * @param {Array} items - Menu entries, see above
 * @param {String} icon - Trigger icon
 * @param {String} title - Trigger tooltip and aria-label (default: "More actions")
 * @param {String} triggerClass - Classes for the trigger next to .btn; replaces the default .btn-icon
 * @param {String} menuClass - Own class of the menu box next to the shared .care-menu; replaces the default .popup-menu look
 * @param {String} placement - Preferred side, "bottom" or "top"
 * @param {Boolean} teleport - Move the menu to <body>; off keeps it next to the trigger in the DOM
 * @emits select - The clicked item
 */
export default {
  name: "BasicPopupMenu",
  components: { BasicButton, LoadIcon },
  props: {
    items: {
      type: Array,
      required: false,
      default: () => [],
    },
    icon: {
      type: String,
      required: false,
      default: "three-dots",
    },
    title: {
      type: String,
      required: false,
      default: null,
    },
    triggerClass: {
      type: String,
      required: false,
      default: "btn-icon",
    },
    menuClass: {
      type: String,
      required: false,
      default: "popup-menu",
    },
    placement: {
      type: String,
      required: false,
      default: "bottom",
      validator: (value) => ["bottom", "top"].includes(value),
    },
    teleport: {
      type: Boolean,
      required: false,
      default: true,
    },
  },
  emits: ["select"],
  data() {
    return {
      open: false,
      up: false,
      pos: { top: 0, left: 0 },
      teleportTarget: "body",
      openedByKeyboard: false,
    };
  },
  computed: {
    triggerTitle() {
      return this.title || this.$t("common.moreActions");
    },
  },
  mounted() {
    this.teleportTarget = popupTeleportTarget(this.$el);
  },
  beforeUnmount() {
    this.close(false);
  },
  methods: {
    /**
     * Remember whether the trigger was activated by keyboard (clicks from Enter/Space have no detail).
     * @param {MouseEvent} event
     * @returns {void}
     */
    noteClick(event) {
      this.openedByKeyboard = event.detail === 0;
    },
    /**
     * Open or close the menu.
     * @returns {void}
     */
    toggle() {
      if (this.open) {
        this.close(false);
        return;
      }
      if (openMenu && openMenu !== this) {
        openMenu.close(false);
      }
      openMenu = this;
      this.open = true;
      this.unbindPopup = bindPopupListeners({
        isInside: (target) => this.$refs.root?.contains(target) || this.$refs.menu?.contains(target),
        onOutside: () => this.close(false),
        // Fixed to the viewport, so any scroll or resize would detach it from its trigger.
        onReposition: () => this.close(false),
      });
      this.$nextTick(() => {
        this.place();
        if (this.openedByKeyboard) {
          this.focusItem("Home");
        }
      });
    },
    /**
     * Close the menu.
     * @param {boolean} restoreFocus Move focus back to the trigger.
     * @returns {void}
     */
    close(restoreFocus) {
      if (!this.open) {
        return;
      }
      this.open = false;
      this.unbindPopup?.();
      this.unbindPopup = null;
      if (openMenu === this) {
        openMenu = null;
      }
      if (restoreFocus) {
        this.$refs.root?.firstElementChild?.focus({ preventScroll: true });
      }
    },
    /**
     * Position the rendered menu at the trigger's right edge, on the preferred side unless only
     * the other side has room. The gap to the trigger is the menu's margin (CSS).
     * Not listbox.js placePopup: that one aligns a field-wide, height-capped list to the field's left edge.
     * @returns {void}
     */
    place() {
      const menu = this.$refs.menu;
      const trigger = this.$refs.root?.firstElementChild;
      if (!menu || !trigger) {
        return;
      }
      const rect = trigger.getBoundingClientRect();
      const width = menu.offsetWidth;
      const height = menu.offsetHeight;
      const needed = height + 2 * VIEWPORT_MARGIN;
      const roomBelow = window.innerHeight - rect.bottom;
      const roomAbove = rect.top;
      this.up = this.placement === "top"
        ? roomAbove >= needed || roomAbove > roomBelow
        : roomBelow < needed && roomAbove > roomBelow;
      this.pos = {
        top: this.up ? Math.max(VIEWPORT_MARGIN, rect.top - height) : rect.bottom,
        left: Math.max(VIEWPORT_MARGIN, Math.min(rect.right - width, window.innerWidth - VIEWPORT_MARGIN - width)),
      };
    },
    /**
     * Focus a menu entry relative to the focused one, skipping disabled entries.
     * @param {string} key ArrowDown, ArrowUp, Home or End.
     * @returns {void}
     */
    focusItem(key) {
      const items = [...(this.$refs.menu?.querySelectorAll("button") || [])];
      const current = items.indexOf(document.activeElement);
      const index = {
        ArrowDown: () => nextEnabledIndex(items, current, 1),
        ArrowUp: () => nextEnabledIndex(items, current === -1 ? items.length : current, -1),
        Home: () => nextEnabledIndex(items, -1, 1),
        End: () => nextEnabledIndex(items, items.length, -1),
      }[key]();
      items[index]?.focus({ preventScroll: true });
    },
    /**
     * Keys on the trigger or in the open menu.
     * @param {KeyboardEvent} event
     * @returns {void}
     */
    onKeydown(event) {
      if (!this.open) {
        return;
      }
      // A menu that is not teleported sits inside the anchor, so its keys arrive here twice.
      if (event.currentTarget === this.$refs.root && this.$refs.menu?.contains(event.target)) {
        return;
      }
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        this.focusItem(event.key);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        this.close(true);
      } else if (event.key === "Tab") {
        this.close(false);
      }
    },
    /**
     * Close once focus has left both the trigger and the menu.
     * @param {FocusEvent} event
     * @returns {void}
     */
    onFocusOut(event) {
      if (this.open && focusLeftMenu(event, this.$refs.menu, this.$refs.root)) {
        this.close(false);
      }
    },
    /**
     * Custom slot content has no select event, so any click in it closes the menu.
     * @returns {void}
     */
    onMenuClick() {
      if (this.$slots.default) {
        this.close(false);
      }
    },
    /**
     * @param {Object} item The clicked entry.
     * @returns {void}
     */
    select(item) {
      this.close(true);
      this.$emit("select", item);
    },
  },
};
</script>

<style scoped>
.popup-menu-anchor {
  display: inline-flex;
  flex: none;
}

.popup-menu {
  min-width: 13rem;
  margin-top: 6px;
  padding: 0.35rem;
}

.popup-menu.is-up {
  margin-top: -6px;
}

[data-bs-theme="dark"] .popup-menu {
  background: color-mix(in srgb, var(--bs-body-bg) 92%, white);
}

.popup-menu-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.45rem 0.65rem;
  font-size: 0.85rem;
  font-weight: 500;
  text-align: left;
  white-space: nowrap;
  color: var(--bs-body-color);
  background: transparent;
  border: 0;
  border-radius: var(--care-radius-md);
  cursor: pointer;
  transition: background-color var(--care-dur-fast) var(--care-ease), color var(--care-dur-fast) var(--care-ease);
}

.popup-menu-item span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.popup-menu-item svg {
  flex: 0 0 auto;
  color: var(--bs-secondary-color);
  transition: color var(--care-dur-fast) var(--care-ease);
}

.popup-menu-item:hover,
.popup-menu-item:focus-visible {
  outline: none;
  background: var(--care-hover);
  color: var(--bs-emphasis-color);
}

.popup-menu-item:hover svg,
.popup-menu-item:focus-visible svg {
  color: var(--bs-emphasis-color);
}

.popup-menu-item--danger,
.popup-menu-item--danger svg,
.popup-menu-item--danger:hover,
.popup-menu-item--danger:focus-visible,
.popup-menu-item--danger:hover svg,
.popup-menu-item--danger:focus-visible svg {
  color: var(--bs-danger);
}

.popup-menu-item--danger:hover,
.popup-menu-item--danger:focus-visible {
  background: var(--care-hover-danger);
}

.popup-menu-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.popup-menu-item:disabled:hover {
  background: transparent;
  color: var(--bs-body-color);
}

.popup-menu-divider {
  height: 1px;
  margin: 0.3rem 0.4rem;
  background: var(--bs-border-color-translucent);
}

@media (prefers-reduced-motion: reduce) {
  .popup-menu-item,
  .popup-menu-item svg {
    transition: none;
  }
}
</style>
