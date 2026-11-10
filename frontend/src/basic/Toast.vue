<template>
  <div
    class="care-toaster"
    aria-live="polite"
    aria-atomic="false"
  >
    <TransitionGroup name="care-toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="care-toast"
        :class="[`care-toast--${toast.kind}`, { 'is-paused': toast.paused, 'care-toast--no-title': !toast.title }]"
        :role="toast.kind === 'danger' || toast.kind === 'warning' ? 'alert' : 'status'"
        :style="{ '--care-toast-duration': `${toast.delay}ms` }"
        @mouseenter="onPointerEnter(toast)"
        @mouseleave="onPointerLeave(toast, $event)"
        @focusin="onFocusIn(toast)"
        @focusout="onFocusOut(toast, $event)"
        @pointerdown.stop
        @click.stop
      >
        <div class="care-toast__icon" aria-hidden="true">
          <!-- success: circle + drawn check mark -->
          <svg v-if="toast.kind === 'success'" viewBox="0 0 52 52">
            <circle class="ring" cx="26" cy="26" r="23" />
            <path class="glyph" d="M15 27 l7.5 7.5 L37.5 19" />
          </svg>
          <!-- danger: circle + drawn cross, then shake -->
          <svg v-else-if="toast.kind === 'danger'" viewBox="0 0 52 52">
            <circle class="ring" cx="26" cy="26" r="23" />
            <path class="glyph" d="M18 18 L34 34" />
            <path class="glyph glyph--2" d="M34 18 L18 34" />
          </svg>
          <!-- warning: triangle + exclamation, then wiggle -->
          <svg v-else-if="toast.kind === 'warning'" viewBox="0 0 52 52">
            <path class="ring" d="M26 5 L48 45 H4 Z" stroke-linejoin="round" />
            <path class="glyph" d="M26 19 V31" />
            <circle class="dot" cx="26" cy="38" r="2.2" />
          </svg>
          <!-- info / everything else: circle + "i", pop -->
          <svg v-else viewBox="0 0 52 52">
            <circle class="ring" cx="26" cy="26" r="23" />
            <circle class="dot" cx="26" cy="16.5" r="2.4" />
            <path class="glyph" d="M26 23 V37" />
          </svg>
        </div>

        <!-- Grid layout: icon + title + close in the header row, body and "show more" below at full width. -->
        <div
          v-if="toast.title"
          :ref="(el) => { if (!toast.hasBody) this.setClipEl(toast.id, el); }"
          class="care-toast__title"
          :class="{
            'is-clamped': toast.overflows && !toast.expanded && !toast.hasBody,
            'is-expanded': toast.overflows && toast.expanded && !toast.hasBody,
          }"
        >{{ toast.title }}</div>
        <div
          v-if="toast.hasBody"
          :ref="(el) => this.setClipEl(toast.id, el)"
          class="care-toast__body"
          :class="{
            'has-list': toast.items.length > 0,
            'is-clamped': toast.overflows && !toast.expanded,
            'is-expanded': toast.overflows && toast.expanded,
          }"
        >
          <div v-if="toast.body" class="care-toast__text">{{ toast.body }}</div>
          <!-- Enumerations (e.g. missing criteria): one entry per line. -->
          <template v-if="toast.items.length">
            <div v-if="toast.itemsTitle" class="care-toast__list-title">{{ toast.itemsTitle }}</div>
            <ul class="care-toast__list">
              <li
                v-for="(item, index) in toast.items"
                :key="index"
              >{{ item }}</li>
            </ul>
          </template>
        </div>
        <button
          v-if="toast.overflows && !toast.expanded"
          type="button"
          class="care-toast__more"
          @click="expandToast(toast)"
        >
          {{ $t('common.showMore') }}
        </button>

        <button
          type="button"
          class="care-toast__close"
          :aria-label="$t('common.close')"
          :title="$t('common.close')"
          @click="dismiss(toast.id)"
        >
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>

        <div v-if="toast.delay > 0" class="care-toast__progress" aria-hidden="true"></div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script>
/**
 * Toast Component
 *
 * This component shows a message in the dashboard, there are two ways to display a message:
 * From backend through websocket:
 * socket.emit("toast", <toastObject>);
 *
 * or from any vue component in frontend through eventBus:
 * this.eventBus.emit('toast', <toastObject>);
 *
 * Example toast object: (must have a message, others are optional)
 * {
 *  message: "This is an example!",
 *  title: "Example",
 *  variant: 'info', // 'primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark'
 *  delay: 5000, //in ms, 0 or less keeps the toast until it is closed manually
 *  items: ["Criterion A", "Criterion B"], // optional, shown as a list with one entry per line
 *  itemsTitle: "Still open ({count}):", // optional heading above the list (text or i18n key, gets {count})
 *  }
 *
 * Toasts disappear automatically. While the pointer or keyboard focus is on a toast
 * the dismiss timer and the progress bar freeze, so the message stays readable.
 * A long message stays clamped to a few lines with a "show more" control. 
 * Once opened, the text stays expanded and scrolls inside the toast.
 *
 *  @author Dennis Zyska, Andrii Nikitin
 */

const MAX_TOASTS = 5;
// About three lines in the toast column. Longer copy stays collapsed.
const COLLAPSE_CHARS = 140;
// Lists longer than this stay collapsed until "show more".
const COLLAPSE_ITEMS = 4;

export default {
  name: "BasicToast",
  sockets: {
    toast: function (data) {
      this.makeToast(data);
    }
  },
  data() {
    return {
      toastCount: 0,
      toasts: [],
    }
  },
  created() {
    // Non-reactive bookkeeping
    this.timers = new Map();
    this.clipEls = new Map();
  },
  mounted() {
    this.eventBus.on('toast', this.makeToast);
  },
  beforeUnmount() {
    this.eventBus.off('toast', this.makeToast);
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
  },
  methods: {
    resolveText(value, params = {}) {
      if (typeof value !== "string") {
        return value || "";
      }
      return this.$te(value) ? this.$t(value, params) : value;
    },
    resolveKind(variant) {
      if (variant === "success" || variant === "danger" || variant === "warning") {
        return variant;
      }
      return "info";
    },
    makeToast(data) {
      if (!data) return;
      const title = data.titleKey !== undefined
        ? this.resolveText(data.titleKey, data.titleParams || {})
        : this.resolveText(data.title, data.titleParams || {});
      const body = data.key !== undefined
        ? this.resolveText(data.key, data.params || {})
        : this.resolveText(data.message, data.params || {});

      const items = Array.isArray(data.items)
        // Items are display labels (e.g. criterion names), not i18n keys.
        ? data.items.filter((item) => item !== null && item !== undefined && item !== "").map(String)
        : [];
      const itemsTitle = items.length
        ? this.resolveText(data.itemsTitle, { count: items.length, ...(data.itemsTitleParams || {}) })
        : "";

      const delay = Number.isFinite(Number(data.delay)) ? Number(data.delay) : 5000;
      const text = `${title || ""}\n${body || ""}`.trim();
      const toast = {
        id: ++this.toastCount,
        title,
        body,
        items,
        itemsTitle,
        hasBody: Boolean(body) || items.length > 0,
        kind: this.resolveKind(data.variant),
        delay: delay > 0 ? delay : 0,
        remainingMs: delay > 0 ? delay : 0,
        paused: false,
        pointerInside: false,
        focusInside: false,
        dismissed: false,
        overflows: text.length > COLLAPSE_CHARS
          || text.split(/\n/).length > 3
          || items.length > COLLAPSE_ITEMS,
        expanded: false,
      };

      this.toasts.push(toast);
      // Drop the oldest toasts so the stack never grows over the page
      while (this.toasts.length > MAX_TOASTS) {
        this.dismiss(this.toasts[0].id);
      }

      if (toast.delay > 0) {
        this.armTimer(toast);
      }
    },
    /**
     * Start the auto-close countdown for one toast.
     * @param {Object} toast
     * @returns {void}
     */
    armTimer(toast) {
      toast.startedAt = Date.now();
      this.timers.set(toast.id, setTimeout(() => this.dismiss(toast.id), toast.remainingMs));
    },
    onPointerEnter(toast) {
      if (toast.dismissed || toast.delay <= 0) return;
      toast.pointerInside = true;
      this.syncPause(toast);
    },
    onPointerLeave(toast, event) {
      if (toast.dismissed || toast.delay <= 0) return;
      toast.pointerInside = false;
      const active = document.activeElement;
      if (active && event.currentTarget.contains(active)) {
        active.blur();
      }
      if (!event.currentTarget.contains(document.activeElement)) {
        toast.focusInside = false;
      }
      this.syncPause(toast);
    },
    onFocusIn(toast) {
      if (toast.dismissed || toast.delay <= 0) return;
      toast.focusInside = true;
      this.syncPause(toast);
    },
    onFocusOut(toast, event) {
      if (toast.dismissed || toast.delay <= 0) return;
      const next = event.relatedTarget;
      if (next && event.currentTarget.contains(next)) return;
      toast.focusInside = false;
      this.syncPause(toast);
    },
    syncPause(toast) {
      if (toast.pointerInside || toast.focusInside) this.pauseTimer(toast);
      else this.resumeTimer(toast);
    },
    /**
     * Freeze the countdown while the pointer or focus is on the toast.
     * @param {Object} toast
     * @returns {void}
     */
    pauseTimer(toast) {
      if (toast.paused) return;
      const timer = this.timers.get(toast.id);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(toast.id);
      }
      const elapsed = Date.now() - toast.startedAt;
      toast.remainingMs = Math.max(0, toast.remainingMs - elapsed);
      toast.paused = true;
    },
    resumeTimer(toast) {
      if (toast.dismissed || !toast.paused) return;
      toast.paused = false;
      if (toast.remainingMs <= 0) {
        this.dismiss(toast.id);
        return;
      }
      this.armTimer(toast);
    },
    setClipEl(id, el) {
      if (el) this.clipEls.set(id, el);
      else this.clipEls.delete(id);
    },
    expandToast(toast) {
      if (toast.expanded) return;
      const el = this.clipEls.get(toast.id);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!el || reduce) {
        toast.expanded = true;
        return;
      }
      const from = el.getBoundingClientRect().height;
      toast.expanded = true;
      this.$nextTick(() => {
        const root = el.closest(".care-toast");
        if (root && !root.contains(document.activeElement)) {
          toast.focusInside = false;
          this.syncPause(toast);
        }
        const cap = window.innerHeight * 0.3;
        if (el._clipDone) el.removeEventListener("transitionend", el._clipDone);
        el.style.height = `${from}px`;
        el.style.overflow = "hidden";
        el.style.transition = "none";
        void el.offsetHeight;
        const to = Math.min(el.scrollHeight, cap);
        el.style.transition = "height 320ms ease";
        el.style.height = `${to}px`;
        const finish = (event) => {
          if (event.propertyName !== "height") return;
          el.style.height = "";
          el.style.overflow = "";
          el.style.transition = "";
          el._clipDone = null;
          el.removeEventListener("transitionend", finish);
        };
        el._clipDone = finish;
        el.addEventListener("transitionend", finish);
      });
    },
    /**
     * Close one toast and clear its timer.
     * @param {number|string} id
     * @returns {void}
     */
    dismiss(id) {
      const timer = this.timers.get(id);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(id);
      }
      const toast = this.toasts.find((t) => t.id === id);
      if (toast) toast.dismissed = true;
      this.toasts = this.toasts.filter((t) => t.id !== id);
    },
  }
}
</script>

<style scoped>
.care-toaster {
  position: fixed;
  top: 12px;
  right: 16px;
  z-index: 1100;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  width: min(380px, calc(100vw - 32px));
  /* The invisible box around the stack does not take clicks. Each toast does. */
  pointer-events: none;
}

.care-toast {
  --care-toast-color: var(--bs-info);
  position: relative;
  /* Header row: icon, title, close. Body and "show more" span the full width below. */
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-areas:
    "icon title close"
    "body body  body"
    "more more  more";
  align-items: center;
  column-gap: 10px;
  width: 100%;
  padding: 12px 12px 14px 14px;
  overflow: hidden;
  color: var(--bs-body-color);
  /* Soft tint from the left instead of a hard coloured border */
  background:
    linear-gradient(90deg, var(--_toast-wash) 0%, transparent 45%),
    var(--_toast-bg);
  backdrop-filter: var(--_toast-blur);
  -webkit-backdrop-filter: var(--_toast-blur);
  border: 1px solid var(--_toast-border);
  border-radius: var(--bs-border-radius-lg, .75rem);
  box-shadow: var(--_toast-shadow);
  pointer-events: auto;
  transition: opacity 180ms ease, transform 180ms ease;

  /* Flat tinted surface in both themes. A translucent wash let the page show through. */
  --_toast-bg: color-mix(in srgb, var(--bs-body-bg) 94%, var(--care-toast-color) 6%);
  --_toast-wash: transparent;
  --_toast-border: color-mix(in srgb, var(--care-toast-color) 28%, var(--bs-border-color));
  --_toast-shadow: 0 1px 2px rgb(var(--care-shadow-rgb) / .08), 0 6px 16px -6px rgb(var(--care-shadow-rgb) / .16);
  --_toast-blur: none;
}

/* Same surface as light. The light shadow disappears on a dark page, so this one is black. */
[data-bs-theme="dark"] .care-toast {
  --_toast-shadow: 0 1px 2px rgb(0 0 0 / .45), 0 6px 16px -6px rgb(0 0 0 / .55);
}

.care-toast--success { --care-toast-color: var(--bs-success); }
.care-toast--danger  { --care-toast-color: var(--bs-danger); }
.care-toast--warning { --care-toast-color: var(--bs-warning); }
.care-toast--info    { --care-toast-color: var(--bs-info); }

/* ---------- Icon ---------- */
/* Without a title the message takes the title's place next to the icon. */
.care-toast--no-title {
  grid-template-areas:
    "icon body close"
    ".    more .";
}

.care-toast__icon {
  grid-area: icon;
  width: 24px;
  height: 24px;
  color: var(--care-toast-color);
}

.care-toast__icon svg {
  width: 100%;
  height: 100%;
  overflow: visible;
  fill: none;
  stroke: currentColor;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.care-toast__icon .ring {
  stroke-dasharray: 160;
  stroke-dashoffset: 160;
  animation: care-draw 500ms var(--care-ease, ease-out) forwards;
}

/* Not "mark": Bootstrap's .mark sets a dark text colour, and currentColor would pick it up. */
.care-toast__icon .glyph {
  stroke-dasharray: 40;
  stroke-dashoffset: 40;
  animation: care-draw 320ms ease-out 420ms forwards;
}

.care-toast__icon .glyph--2 {
  animation-delay: 560ms;
}

.care-toast__icon .dot {
  fill: currentColor;
  stroke: none;
  transform-box: fill-box;
  transform-origin: center;
  transform: scale(0);
  animation: care-pop 260ms cubic-bezier(.3, 1.6, .5, 1) 650ms forwards;
}

/* success: check is drawn, then the icon bounces once */
.care-toast--success .care-toast__icon svg {
  animation: care-bounce 420ms cubic-bezier(.3, 1.6, .5, 1) 720ms both;
}

/* danger: cross is drawn, then a short horizontal shake */
.care-toast--danger .care-toast__icon svg {
  animation: care-shake 420ms ease-in-out 880ms both;
}

/* warning: triangle is drawn, then it wiggles like a bell */
.care-toast--warning .care-toast__icon svg {
  transform-origin: 50% 15%;
  animation: care-wiggle 700ms ease-in-out 900ms both;
}

/* info: icon pops in */
.care-toast--info .care-toast__icon svg {
  animation: care-pop 360ms cubic-bezier(.3, 1.6, .5, 1) both;
}

/* ---------- Text ---------- */
.care-toast__title {
  grid-area: title;
  min-width: 0;
  font-weight: 600;
  font-size: .95rem;
  line-height: 1.3;
}

.care-toast__body {
  grid-area: body;
  min-width: 0;
  font-size: .875rem;
  line-height: 1.4;
  color: var(--bs-secondary-color);
  overflow-wrap: anywhere;
}

.care-toast__title.is-clamped,
.care-toast__body.is-clamped,
.care-toast__title.is-expanded,
.care-toast__body.is-expanded {
  overflow: hidden;
}

.care-toast__title.is-clamped,
.care-toast__body.is-clamped {
  -webkit-mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 1.35em), rgb(0 0 0 / 28%) 100%);
  mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 1.35em), rgb(0 0 0 / 28%) 100%);
}

.care-toast__title.is-clamped {
  max-height: calc(1.3em * 2.85);
}

.care-toast__body.is-clamped {
  max-height: calc(1.4em * 3.85);
}

/* Room for the sentence, the list heading and the first few entries. */
.care-toast__body.has-list.is-clamped {
  max-height: calc(1.4em * 7.85);
}

/* ---------- List (e.g. missing criteria) ---------- */
.care-toast__text + .care-toast__list-title,
.care-toast__text + .care-toast__list {
  margin-top: 8px;
}

.care-toast__list-title {
  font-weight: 600;
  color: var(--bs-body-color);
}

.care-toast__list {
  margin: 2px 0 0;
  padding: 0;
  list-style: none;
}

.care-toast__list li {
  position: relative;
  padding: 1px 0 1px 14px;
}

/* Small dot in the toast colour instead of the default bullet. */
.care-toast__list li::before {
  content: "";
  position: absolute;
  left: 2px;
  top: calc(.7em - 2px);
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--care-toast-color);
}

.care-toast__title.is-expanded,
.care-toast__body.is-expanded {
  max-height: 30vh;
  overflow-y: auto;
  /* Setting scrollbar-width switches off overlay scrollbars, so the bar gets
     its own column. The gutter and padding keep the text clear of the thumb. */
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--bs-secondary-rgb), .35) transparent;
  scrollbar-gutter: stable;
  padding-right: 6px;
}

.care-toast__title + .care-toast__body {
  margin-top: 8px;
}

.care-toast__more {
  grid-area: more;
  justify-self: start;
  display: inline-flex;
  margin-top: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--care-toast-color);
  font-size: .8125rem;
  font-weight: 600;
  line-height: 1.3;
  cursor: pointer;
}

.care-toast__more:hover {
  text-decoration: underline;
}

.care-toast__more:focus-visible {
  outline: none;
  box-shadow: var(--care-focus-ring, 0 0 0 3px rgb(13 110 253 / .35));
  border-radius: 4px;
}

/* ---------- Close ---------- */
.care-toast__close {
  grid-area: close;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  font-size: .75rem;
  color: var(--bs-secondary-color);
  background: transparent;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.care-toast__close:hover {
  color: var(--bs-body-color);
  background: var(--bs-secondary-bg);
}

.care-toast__close:focus-visible {
  outline: none;
  box-shadow: var(--care-focus-ring, 0 0 0 3px rgb(13 110 253 / .35));
}

/* ---------- Auto-dismiss progress ---------- */
.care-toast__progress {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 5px;
  height: 2px;
  border-radius: 999px;
  background: var(--care-toast-color);
  opacity: .55;
  transform-origin: left center;
  animation: care-progress var(--care-toast-duration) linear forwards;
  transition: opacity 700ms ease;
}

.care-toast__progress::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: #000;
  opacity: 0;
  pointer-events: none;
  transition: opacity 700ms ease;
}

.care-toast.is-paused .care-toast__progress {
  animation-play-state: paused;
}

.care-toast.is-paused .care-toast__progress::after {
  opacity: .38;
}

/* ---------- Enter / leave ---------- */
.care-toast-enter-active {
  transition: opacity 260ms ease, transform 320ms cubic-bezier(.2, .9, .3, 1.2);
}

.care-toast-leave-active {
  position: absolute;
  right: 0;
  transition: opacity 220ms ease, transform 220ms ease;
}

.care-toast-enter-from {
  opacity: 0;
  transform: translateX(40px) scale(.96);
}

.care-toast-leave-to {
  opacity: 0;
  transform: translateX(40px);
}

.care-toast-move {
  transition: transform 260ms ease;
}

/* ---------- Keyframes ---------- */
@keyframes care-draw {
  to { stroke-dashoffset: 0; }
}

@keyframes care-pop {
  0%   { transform: scale(0); }
  100% { transform: scale(1); }
}

@keyframes care-bounce {
  0%, 100% { transform: scale(1); }
  45%      { transform: scale(1.18); }
}

@keyframes care-shake {
  0%, 100% { transform: translateX(0); }
  20%      { transform: translateX(-3px); }
  40%      { transform: translateX(3px); }
  60%      { transform: translateX(-2px); }
  80%      { transform: translateX(2px); }
}

@keyframes care-wiggle {
  0%, 100% { transform: rotate(0); }
  15%      { transform: rotate(-12deg); }
  30%      { transform: rotate(10deg); }
  45%      { transform: rotate(-8deg); }
  60%      { transform: rotate(6deg); }
  75%      { transform: rotate(-3deg); }
}

@keyframes care-progress {
  from { transform: scaleX(1); }
  to   { transform: scaleX(0); }
}

@media (prefers-reduced-motion: reduce) {
  .care-toast,
  .care-toast-enter-active,
  .care-toast-leave-active,
  .care-toast-move {
    transition: opacity 150ms ease;
  }

  .care-toast-enter-from,
  .care-toast-leave-to {
    transform: none;
  }

  .care-toast__icon svg,
  .care-toast__icon .ring,
  .care-toast__icon .glyph,
  .care-toast__icon .dot {
    animation: none !important;
    stroke-dashoffset: 0;
    transform: none;
  }
}
</style>
