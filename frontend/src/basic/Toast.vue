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
        :ref="(el) => setToastRef(toast.id, el)"
        class="care-toast"
        :class="[`care-toast--${toast.kind}`, { 'is-ghost': toast.ghost }]"
        :role="toast.kind === 'danger' || toast.kind === 'warning' ? 'alert' : 'status'"
        :style="{ '--care-toast-duration': `${toast.delay}ms` }"
      >
        <div class="care-toast__icon" aria-hidden="true">
          <!-- success: circle + drawn check mark -->
          <svg v-if="toast.kind === 'success'" viewBox="0 0 52 52">
            <circle class="ring" cx="26" cy="26" r="23" />
            <path class="mark" d="M15 27 l7.5 7.5 L37.5 19" />
          </svg>
          <!-- danger: circle + drawn cross, then shake -->
          <svg v-else-if="toast.kind === 'danger'" viewBox="0 0 52 52">
            <circle class="ring" cx="26" cy="26" r="23" />
            <path class="mark" d="M18 18 L34 34" />
            <path class="mark mark--2" d="M34 18 L18 34" />
          </svg>
          <!-- warning: triangle + exclamation, then wiggle -->
          <svg v-else-if="toast.kind === 'warning'" viewBox="0 0 52 52">
            <path class="ring" d="M26 5 L48 45 H4 Z" stroke-linejoin="round" />
            <path class="mark" d="M26 19 V31" />
            <circle class="dot" cx="26" cy="38" r="2.2" />
          </svg>
          <!-- info / everything else: circle + "i", pop -->
          <svg v-else viewBox="0 0 52 52">
            <circle class="ring" cx="26" cy="26" r="23" />
            <circle class="dot" cx="26" cy="16.5" r="2.4" />
            <path class="mark" d="M26 23 V37" />
          </svg>
        </div>

        <div class="care-toast__content">
          <div v-if="toast.title" class="care-toast__title">{{ toast.title }}</div>
          <div v-if="toast.body" class="care-toast__body">{{ toast.body }}</div>
        </div>

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
 *  }
 *
 * Toasts disappear automatically and do not block the page: clicks and scrolling go
 * through to the elements behind them. Only the close button is interactive. When the
 * cursor is over a toast it fades out so the content behind stays visible.
 *
 *  @author Dennis Zyska
 */

const MAX_TOASTS = 5;

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
    this.toastEls = new Map();
    this.rafPending = false;
    this.lastPointer = null;
  },
  mounted() {
    this.eventBus.on('toast', this.makeToast);
    document.addEventListener('mousemove', this.onPointerMove, {passive: true});
    document.addEventListener('mouseleave', this.onPointerLeave);
  },
  beforeUnmount() {
    this.eventBus.off('toast', this.makeToast);
    document.removeEventListener('mousemove', this.onPointerMove);
    document.removeEventListener('mouseleave', this.onPointerLeave);
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

      const delay = Number.isFinite(Number(data.delay)) ? Number(data.delay) : 5000;
      const toast = {
        id: ++this.toastCount,
        title,
        body,
        kind: this.resolveKind(data.variant),
        delay: delay > 0 ? delay : 0,
        ghost: false,
      };

      this.toasts.push(toast);
      // Drop the oldest toasts so the stack never grows over the page
      while (this.toasts.length > MAX_TOASTS) {
        this.dismiss(this.toasts[0].id);
      }

      if (toast.delay > 0) {
        this.timers.set(toast.id, setTimeout(() => this.dismiss(toast.id), toast.delay));
      }
    },
    dismiss(id) {
      const timer = this.timers.get(id);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(id);
      }
      this.toastEls.delete(id);
      this.toasts = this.toasts.filter((t) => t.id !== id);
    },
    setToastRef(id, el) {
      if (el) {
        this.toastEls.set(id, el);
      } else {
        this.toastEls.delete(id);
      }
    },
    onPointerMove(event) {
      // Toasts use pointer-events: none, so hover is detected by hit-testing their rects
      this.lastPointer = {x: event.clientX, y: event.clientY};
      if (this.rafPending || this.toasts.length === 0) return;
      this.rafPending = true;
      requestAnimationFrame(() => {
        this.rafPending = false;
        this.updateGhosts();
      });
    },
    onPointerLeave() {
      this.lastPointer = null;
      this.updateGhosts();
    },
    updateGhosts() {
      const p = this.lastPointer;
      this.toasts.forEach((toast) => {
        const el = this.toastEls.get(toast.id);
        let inside = false;
        if (p && el) {
          const r = el.getBoundingClientRect();
          inside = p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
          // Keep the toast readable when the user is aiming at the close button
          const btn = el.querySelector('.care-toast__close');
          if (inside && btn) {
            const b = btn.getBoundingClientRect();
            if (p.x >= b.left - 6 && p.x <= b.right + 6 && p.y >= b.top - 6 && p.y <= b.bottom + 6) {
              inside = false;
            }
          }
        }
        if (toast.ghost !== inside) {
          toast.ghost = inside;
        }
      });
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
  /* The stack never blocks the page */
  pointer-events: none;
}

.care-toast {
  --care-toast-color: var(--bs-info);
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 12px 12px 14px 18px;
  overflow: hidden;
  color: var(--bs-body-color);
  /* Soft tint from the left instead of a hard coloured border */
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--care-toast-color) 12%, transparent) 0%, transparent 45%),
    color-mix(in srgb, var(--bs-body-bg) 82%, transparent);
  backdrop-filter: blur(12px) saturate(140%);
  -webkit-backdrop-filter: blur(12px) saturate(140%);
  border: 1px solid color-mix(in srgb, var(--care-toast-color) 30%, var(--bs-border-color-translucent));
  border-radius: var(--bs-border-radius-lg, .75rem);
  box-shadow: var(--care-shadow-3, 0 12px 24px -6px rgb(0 0 0 / .2));
  /* Clicks, scrolling and selection go through to the page behind */
  pointer-events: none;
  user-select: none;
  transition: opacity 180ms ease, transform 180ms ease;
}

/* Inset rounded accent bar with a soft glow */
.care-toast::before {
  content: "";
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 6px;
  width: 3px;
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    var(--care-toast-color),
    color-mix(in srgb, var(--care-toast-color) 45%, transparent)
  );
  box-shadow: 0 0 8px color-mix(in srgb, var(--care-toast-color) 55%, transparent);
}

.care-toast.is-ghost {
  opacity: .18;
}

.care-toast--success { --care-toast-color: var(--bs-success); }
.care-toast--danger  { --care-toast-color: var(--bs-danger); }
.care-toast--warning { --care-toast-color: var(--bs-warning); }
.care-toast--info    { --care-toast-color: var(--bs-info); }

/* ---------- Icon ---------- */
.care-toast__icon {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  margin-top: 1px;
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

.care-toast__icon .mark {
  stroke-dasharray: 40;
  stroke-dashoffset: 40;
  animation: care-draw 320ms ease-out 420ms forwards;
}

.care-toast__icon .mark--2 {
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
.care-toast__content {
  flex: 1 1 auto;
  min-width: 0;
  padding-top: 2px;
}

.care-toast__title {
  font-weight: 600;
  font-size: .95rem;
  line-height: 1.3;
}

.care-toast__body {
  margin-top: 2px;
  font-size: .875rem;
  line-height: 1.4;
  color: var(--bs-secondary-color);
  overflow-wrap: anywhere;
}

.care-toast__title + .care-toast__body {
  margin-top: 4px;
}

/* ---------- Close ---------- */
.care-toast__close {
  flex: 0 0 auto;
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
  /* The only interactive part of the toast */
  pointer-events: auto;
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
  opacity: .45;
  transform-origin: left center;
  animation: care-progress var(--care-toast-duration) linear forwards;
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
  .care-toast__icon .mark,
  .care-toast__icon .dot {
    animation: none !important;
    stroke-dashoffset: 0;
    transform: none;
  }
}
</style>
