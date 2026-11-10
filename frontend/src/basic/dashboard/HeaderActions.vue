<template>
  <div class="dashboard-header-actions header-actions">
    <!-- Buttons coming back (or the "..." button appearing) fade in; leaving ones are
         removed at once so they never take space the row no longer has. -->
    <TransitionGroup
      name="header-action"
      :css="animate"
      @leave="leaveNow"
    >
      <BasicButton
        v-for="item in inlineActions"
        :key="item.key"
        class="btn-secondary btn-sm"
        :title="item.title || item.text"
        :text="item.text"
        :icon="item.icon"
        :disabled="item.disabled"
        @click="run(item)"
      />

      <button
        v-if="menuActions.length > 0"
        key="__more"
        ref="trigger"
        type="button"
        class="btn btn-secondary btn-sm header-actions-more"
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
    </TransitionGroup>

    <!-- Separator and the filled main action(s); never collapsed. -->
    <div
      v-if="$slots.default"
      ref="tail"
      class="header-actions-tail"
    >
      <span
        v-if="actions.length > 0"
        class="dashboard-header-sep"
        aria-hidden="true"
      />
      <slot />
    </div>

    <!-- Invisible copy of every button at full size, used to measure what fits. -->
    <div
      class="header-actions-measure"
      aria-hidden="true"
      inert
    >
      <div
        ref="measure"
        class="header-actions-measure-row"
      >
        <BasicButton
          v-for="item in actions"
          :key="item.key"
          class="btn-secondary btn-sm"
          data-measure-action
          tabindex="-1"
          :text="item.text"
          :icon="item.icon"
        />
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          data-measure-more
          tabindex="-1"
        >
          <LoadIcon
            icon-name="three-dots"
            :size="16"
          />
        </button>
      </div>
    </div>

    <!-- Teleported so the card header cannot clip it. Same look as the table row "..." menu. -->
    <Teleport
      v-if="menuActions.length > 0"
      to="body"
    >
      <div
        v-if="menuOpen"
        ref="menu"
        class="row-actions-menu"
        :style="{ top: menuPos.top + 'px', left: menuPos.left + 'px' }"
        role="menu"
        @focusout="onMenuFocusOut"
        @keydown.esc.prevent.stop="closeMenu(true)"
        @keydown.down.prevent="moveFocus(1)"
        @keydown.up.prevent="moveFocus(-1)"
        @keydown.tab="closeMenu(false)"
      >
        <button
          v-for="item in menuActions"
          :key="item.key"
          type="button"
          role="menuitem"
          class="row-actions-menu-item"
          :disabled="item.disabled"
          @click="menuRun(item)"
        >
          <LoadIcon
            v-if="item.icon"
            :icon-name="item.icon"
            :size="15"
          />
          <span>{{ item.text }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import LoadIcon from "@/basic/Icon.vue";
import { focusLeftMenu } from "@/basic/table/helpers/rowActionsLayout.js";
import { viewport } from "@/assets/viewport.js";

/**
 * Header button row for dashboard pages (.dashboard-page cards).
 *
 * Shows the secondary actions as ghost buttons and moves the ones that no longer
 * fit next to the title into a "..." menu, from the right. The default slot holds
 * the filled main action(s); it always stays visible, after a separator.
 *
 * Usage, inside the Card's #headerElements (or ListPage's #headerActions) slot:
 *   <HeaderActions :actions="[{ key, text, icon, title?, disabled?, onClick }]">
 *     <BasicButton class="btn-primary btn-sm" ... />
 *   </HeaderActions>
 *
 * Filter hidden actions out of the array instead of passing a flag.
 *
 * @param {Array} actions - Secondary actions: { key, text, icon, title?, disabled?, onClick }
 */
export default {
  name: "DashboardHeaderActions",
  components: { BasicButton, LoadIcon },
  props: {
    actions: {
      type: Array,
      required: false,
      default: () => [],
    },
  },
  data() {
    return {
      // null: not measured yet, show everything inline.
      inlineCount: null,
      // Off for the first layout, so the page does not open with buttons fading in.
      animate: false,
      menuOpen: false,
      menuPos: { top: 0, left: 0 },
    };
  },
  computed: {
    inlineActions() {
      return this.inlineCount === null ? this.actions : this.actions.slice(0, this.inlineCount);
    },
    menuActions() {
      return this.inlineCount === null ? [] : this.actions.slice(this.inlineCount);
    },
  },
  watch: {
    actions: {
      deep: true,
      handler() {
        this.$nextTick(this.updateLayout);
      },
    },
    "menuActions.length"(length) {
      if (length === 0 && this.menuOpen) this.closeMenu();
    },
  },
  created() {
    // Re-split when crossing the phone breakpoint, even if no observed size changed.
    this.$watch(() => viewport.compact, () => this.$nextTick(this.updateLayout));
  },
  mounted() {
    this.header = this.$el.closest(".card-header") || this.$el.parentElement;
    if (typeof ResizeObserver !== "undefined" && this.header) {
      // Synchronous on purpose: ResizeObserver runs after layout and before paint, and
      // Vue patches the DOM in a microtask right after it, so the new split is painted
      // in the same frame as the resize. Deferring to requestAnimationFrame showed one
      // frame of the old split (overflowing / wrapped header) and made the row jump.
      this.resizeObserver = new ResizeObserver(() => this.updateLayout());
      this.resizeObserver.observe(this.header);
      // Button widths grow when their icons and the web font arrive (after mount),
      // and the title can change (e.g. a count in it). Re-measure on any of those,
      // or the last button ends up past the card edge.
      [this.$refs.measure, this.$refs.tail, this.header.querySelector(".card-title")]
        .filter(Boolean)
        .forEach((el) => this.resizeObserver.observe(el));
    }
    this.updateLayout();
    this.$nextTick(() => {
      requestAnimationFrame(() => {
        this.animate = true;
      });
    });
    // Button widths change once the web font has loaded.
    document.fonts?.ready?.then(() => this.scheduleLayout());
  },
  beforeUnmount() {
    this.resizeObserver?.disconnect();
    this.header?.classList.remove("has-header-actions");
    if (this.layoutFrame) cancelAnimationFrame(this.layoutFrame);
    this.menuOpen = false;
    this.unbindMenuListeners();
  },
  methods: {
    /**
     * Remove a leaving button in the same frame. Without this, Vue would wait for the
     * .btn colour transition (global.css) and the button would overflow the row.
     */
    leaveNow(el, done) {
      done();
    },
    run(item) {
      if (item.disabled) return;
      item.onClick?.();
    },
    menuRun(item) {
      this.closeMenu(true);
      this.run(item);
    },
    scheduleLayout() {
      if (this.layoutFrame) return;
      this.layoutFrame = requestAnimationFrame(() => {
        this.layoutFrame = null;
        this.updateLayout();
      });
    },
    /**
     * Keep as many actions inline as fit next to the title; the rest go into the menu.
     * Widths come from the hidden measure row, so the result does not depend on the
     * current split and cannot oscillate.
     */
    updateLayout() {
      const header = this.header;
      const measure = this.$refs.measure;
      if (!header || !measure || !this.$el) return;

      const widths = [...measure.querySelectorAll("[data-measure-action]")]
        .map((el) => el.getBoundingClientRect().width);
      const moreWidth = measure.querySelector("[data-measure-more]")?.getBoundingClientRect().width || 0;
      const count = widths.length;
      if (count === 0) {
        this.inlineCount = 0;
        header.classList.remove("has-header-actions");
        return;
      }

      const headerStyle = getComputedStyle(header);
      const headerGap = parseFloat(headerStyle.columnGap) || 0;
      const title = header.querySelector(".card-title");
      const titleWidth = title ? title.getBoundingClientRect().width + headerGap : 0;
      // Everything between the header's right edge and this row (e.g. a collapse chevron).
      const outside = this.$el.parentElement !== header
        ? header.getBoundingClientRect().right - parseFloat(headerStyle.paddingRight) - this.$el.getBoundingClientRect().right
        : 0;
      const available = header.clientWidth
        - parseFloat(headerStyle.paddingLeft)
        - parseFloat(headerStyle.paddingRight)
        - titleWidth
        - Math.max(0, outside);

      const gap = parseFloat(getComputedStyle(this.$el).columnGap) || 0;
      const tailWidth = this.$refs.tail ? this.$refs.tail.getBoundingClientRect().width : 0;

      const needed = (inline) => {
        let width = 0;
        for (let i = 0; i < inline; i++) width += widths[i];
        let parts = inline;
        if (inline < count) {
          width += moreWidth;
          parts += 1;
        }
        if (tailWidth) {
          width += tailWidth;
          parts += 1;
        }
        return width + Math.max(0, parts - 1) * gap;
      };

      // Phones: every secondary action goes into "...", only the main action stays.
      let inline = viewport.compact ? 0 : count;
      while (inline > 0 && needed(inline) > available + 0.5) inline--;
      if (this.inlineCount !== inline) this.inlineCount = inline;

      // Title and buttons stay on one line while the row fits; only when even
      // "title + ... + main action" is too wide may the header wrap.
      header.classList.toggle("has-header-actions", needed(inline) <= available + 0.5);
    },
    toggleMenu() {
      if (this.menuOpen) {
        this.closeMenu();
        return;
      }
      const rect = this.$refs.trigger.getBoundingClientRect();
      this.menuPos = { top: rect.bottom + 6, left: rect.right };
      this.menuOpen = true;
      this.bindMenuListeners();
      this.$nextTick(() => {
        this.$refs.menu?.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
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
      const items = [...(this.$refs.menu?.querySelectorAll("button:not(:disabled)") || [])];
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
      // The menu is fixed to the viewport, so scrolling or resizing would detach it.
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
/* Button look comes from .dashboard-page .card-header-actions in global.css. */
/* Two classes so this beats the wrapping rule for .dashboard-header-actions in global.css:
   overflow goes into the "..." menu instead of a second line. */
.dashboard-header-actions.header-actions {
  position: relative;
  flex-wrap: nowrap;
}

.header-actions :deep(.btn) {
  flex: none;
  white-space: nowrap;
}

.header-actions-tail {
  display: flex;
  align-items: center;
  gap: inherit;
}

/* 0x0 clip box: the full-width copy inside must not widen the page (horizontal
   scroll on phones), even though it is invisible. */
.header-actions-measure {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;
  gap: inherit;
}

.header-actions-measure-row {
  display: flex;
  gap: inherit;
  width: max-content;
  white-space: nowrap;
}

.header-actions-more {
  justify-content: center;
}

/* Enter only: a short fade with a small slide from the "..." side. Opacity and
   transform do not change the layout, so the measured split stays valid. */
.header-actions .header-action-enter-active {
  transition: opacity 180ms var(--care-ease, ease), transform 180ms var(--care-ease, ease);
}

.header-actions .header-action-enter-from {
  opacity: 0;
  transform: translateX(6px);
}

/* No move animation: the .btn transform transition would otherwise slide the
   remaining buttons every time the split changes. */
.header-actions .header-action-move {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .header-actions .header-action-enter-active {
    transition: none;
  }
}

.header-actions-more.is-open {
  background-color: var(--dash-ghost-hover, var(--bs-secondary-bg));
  border-color: var(--dash-border, transparent);
  color: var(--bs-emphasis-color);
}

.row-actions-menu-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.row-actions-menu-item:disabled:hover {
  background: transparent;
  color: var(--bs-body-color);
}
</style>

<style src="@/basic/table/row-actions-menu.css"></style>
