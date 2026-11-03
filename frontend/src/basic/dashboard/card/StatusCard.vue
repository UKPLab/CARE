<template>
  <article
    class="status-card"
    :class="cardClasses"
    :style="{ '--i': index }"
    :aria-hidden="skeleton ? 'true' : null"
  >
    <template v-if="skeleton">
      <div class="status-card-skeleton status-card-skeleton--pill" />
      <div class="status-card-skeleton status-card-skeleton--title" />
      <div class="status-card-skeleton status-card-skeleton--meta" />
      <div class="status-card-skeleton status-card-skeleton--block" />
      <div class="status-card-skeleton status-card-skeleton--footer" />
    </template>

    <template v-else>
      <header class="status-card-head">
        <span
          v-if="stateLabel"
          class="status-card-pill"
        >
          <LoadIcon
            v-if="locked"
            class="status-card-lock"
            icon-name="lock-fill"
            :size="10"
          />
          <span
            v-else
            class="status-card-dot"
          />
          {{ stateLabel }}
        </span>
        <span class="status-card-head-end">
          <slot name="badges" />
          <span
            v-if="itemId !== null && itemId !== undefined && itemId !== ''"
            class="status-card-id"
          >#{{ itemId }}</span>
        </span>
      </header>

      <component
        :is="titleClickable ? 'button' : 'h3'"
        v-if="title"
        class="status-card-title"
        :type="titleClickable ? 'button' : null"
        :title="title"
        :aria-expanded="titleClickable && controls ? String(expanded) : null"
        :aria-controls="titleClickable && controls ? controls : null"
        @click="titleClickable && $emit('title-click')"
      >
        {{ title }}
      </component>

      <div
        v-if="meta.length > 0 || $slots.meta"
        class="status-card-meta"
      >
        <span
          v-for="item in meta"
          :key="item.key || item.icon + item.text"
          class="status-card-meta-item"
          :title="item.title || null"
        >
          <LoadIcon
            v-if="item.icon"
            :icon-name="item.icon"
            :size="12"
          />
          {{ item.text }}
        </span>
        <slot name="meta" />
      </div>

      <div
        v-if="progress"
        class="status-card-progress"
      >
        <div class="status-card-progress-head">
          <span class="status-card-progress-label">{{ progress.label }}</span>
          <span class="status-card-progress-count">
            <strong>{{ progress.value }}</strong>
            <span
              v-if="progress.suffix"
              class="status-card-progress-suffix"
            >{{ progress.suffix }}</span>
          </span>
        </div>
        <div
          class="status-card-bar"
          :class="{ 'status-card-bar--unbounded': progress.unbounded }"
        >
          <span
            class="status-card-bar-fill"
            :style="{ width: (progress.percent || 0) + '%' }"
          />
        </div>
        <slot name="progress-hint" />
      </div>

      <div
        v-if="timeline"
        class="status-card-timeline"
        :class="'status-card-timeline--' + (timeline.tone || 'muted')"
        :title="timeline.exact || null"
      >
        <LoadIcon
          :icon-name="timeline.icon"
          :size="13"
        />
        <span class="status-card-timeline-label">{{ timeline.label }}</span>
        <span
          v-if="timeline.relative"
          class="status-card-timeline-relative"
        >{{ timeline.relative }}</span>
      </div>

      <slot />

      <footer
        v-if="$slots.footer"
        class="status-card-foot"
      >
        <slot name="footer" />
      </footer>

      <div
        v-if="$slots.details"
        :id="controls || null"
        class="status-card-details"
      >
        <slot name="details" />
      </div>
    </template>
  </article>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";

const TONES = ["neutral", "primary", "success", "warning", "danger", "violet"];

/**
 * The one card for dashboard items with a status: studies (Studies dashboard), the
 * viewer's studies (My Sessions), assignments (Submissions) and study sessions.
 *
 * The card draws everything that looks the same everywhere: status pill, #id, title,
 * meta line, counter with bar, date line, footer, live-update states and the loading
 * skeleton. Pages only map their own status to a `tone` and fill the slots.
 *
 * Colours, shadows and radius come from the --care-card-* tokens in global.css, so both
 * themes follow. Change the card here, not in the pages.
 *
 * Footer building blocks for the `footer` slot (styled by this file):
 *   .status-card-primary            filled main action (add --ghost for a quiet one)
 *   .status-card-nudge              icon inside the main action that moves right on hover
 *   .status-card-chevron            icon that turns over while the card is expanded
 *   .status-card-actions            right-aligned group of icon buttons
 *   .status-card-icon-btn           icon button (add --danger, or .is-open while its menu is open)
 * Grid for a list of cards: .status-card-grid (+ --list, --compact, .is-refreshing).
 *
 * @slot badges        small icons before the #id in the header
 * @slot meta          extra items at the end of the meta line
 * @slot progress-hint line under the counter bar (use .status-card-hint)
 * @slot default       anything between the date line and the footer
 * @slot footer        actions
 * @slot details       content shown inside the card under the footer (e.g. a table)
 *
 * @author Andrii Nikitin
 */
export default {
  name: "StatusCard",
  components: { LoadIcon },
  props: {
    /** Colour of the edge, wash and pill: neutral, primary, success, warning, danger or violet. */
    tone: {
      type: String,
      required: false,
      default: "neutral",
      validator: (value) => TONES.includes(value),
    },
    /** Text of the status pill; no pill without it. */
    stateLabel: {
      type: String,
      required: false,
      default: "",
    },
    /** Closed for good: lock in the pill, hatched wash and a tinted title. */
    locked: {
      type: Boolean,
      required: false,
      default: false,
    },
    /** Happening now: the pill dot pulses. */
    live: {
      type: Boolean,
      required: false,
      default: false,
    },
    /** Over: the title is muted. */
    dimmed: {
      type: Boolean,
      required: false,
      default: false,
    },
    itemId: {
      type: [Number, String],
      required: false,
      default: null,
    },
    title: {
      type: String,
      required: false,
      default: "",
    },
    /** The title is a button and emits `title-click`. */
    titleClickable: {
      type: Boolean,
      required: false,
      default: false,
    },
    /** Expanded look (marked, not lifted) and aria-expanded on the title. */
    expanded: {
      type: Boolean,
      required: false,
      default: false,
    },
    /** Id of the region the card expands (aria-controls; also the id of the details slot). */
    controls: {
      type: String,
      required: false,
      default: null,
    },
    /** Meta line: [{ key?, icon?, text, title? }]. */
    meta: {
      type: Array,
      required: false,
      default: () => [],
    },
    /** Counter with a bar: { label, value, suffix?, percent, unbounded? }. */
    progress: {
      type: Object,
      required: false,
      default: null,
    },
    /** Date line: { icon, tone: running|pending|soon|muted, label, relative?, exact? }. */
    timeline: {
      type: Object,
      required: false,
      default: null,
    },
    /** Smaller card for use inside another card or panel. */
    compact: {
      type: Boolean,
      required: false,
      default: false,
    },
    /** Position in the list, staggers the entrance animation. */
    index: {
      type: Number,
      required: false,
      default: 0,
    },
    /** Live update flags of a BackendTable row: { entering, updated, deleting, placeholder }. */
    liveState: {
      type: Object,
      required: false,
      default: () => ({}),
    },
    /** Placeholder shape while the first page loads. */
    skeleton: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  emits: ["title-click"],
  computed: {
    cardClasses() {
      const s = this.liveState || {};
      return {
        ["status-card--" + this.tone]: true,
        "status-card--locked": this.locked,
        "status-card--live": this.live,
        "status-card--dimmed": this.dimmed,
        "status-card--compact": this.compact,
        "status-card--skeleton": this.skeleton,
        "status-card--entering": s.entering,
        "status-card--updated": s.updated,
        "status-card--deleting": s.deleting,
        "status-card--placeholder": s.placeholder,
        "is-open": this.expanded,
      };
    },
  },
};
</script>

<!-- Not scoped: the footer classes must reach the buttons pages put into the slots.
     Every rule is prefixed with .status-card so nothing leaks. -->
<style>
/* ---------- Grid ---------- */

.status-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: 1rem;
  align-items: start;
  transition: opacity 0.3s ease, filter 0.3s ease;
}

.status-card-grid--list {
  grid-template-columns: 1fr;
}

.status-card-grid--compact {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr));
  gap: 0.75rem;
}

/* A page request is visibly slow: dim the current cards until it answers. */
.status-card-grid.is-refreshing {
  opacity: 0.55;
  filter: saturate(0.7);
  pointer-events: none;
}

/* ---------- Card ---------- */

.status-card {
  --care-card-accent: var(--bs-secondary);

  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 0;
  padding: 0.85rem 1rem 0.75rem;
  overflow: hidden;
  isolation: isolate;
  background: var(--care-card-surface);
  border: 1px solid var(--care-card-border);
  border-radius: var(--care-card-radius);
  box-shadow: var(--care-card-shadow);
  /* backwards, not both: a held end frame would block the hover lift below. */
  animation: status-card-in 0.5s var(--care-card-ease) backwards;
  animation-delay: calc(min(var(--i, 0), 12) * 35ms);
  top: 0;
  transition:
    top 0.35s var(--care-card-ease),
    transform 0.35s var(--care-card-ease),
    box-shadow 0.35s var(--care-card-ease),
    border-color 0.35s var(--care-card-ease),
    opacity 0.4s ease;
}

.status-card--primary { --care-card-accent: var(--care-primary); }
.status-card--success { --care-card-accent: var(--bs-success); }
.status-card--warning { --care-card-accent: var(--bs-warning); }
.status-card--danger { --care-card-accent: var(--bs-danger); }
.status-card--violet { --care-card-accent: rgb(var(--care-violet-rgb)); }

/* Soft wash of the status colour from the top edge. */
.status-card::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 4.5rem;
  background: radial-gradient(120% 100% at 0% 0%, color-mix(in srgb, var(--care-card-accent) 11%, transparent), transparent 70%);
  pointer-events: none;
  z-index: -1;
  opacity: 0.8;
  transition: opacity 0.35s ease;
}

/* Status edge on the left. */
.status-card::after {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--care-card-accent);
  opacity: 0.85;
}

/* Lift with `top`, not `transform`: a transform runs on the compositor at
   sub-pixel offsets and the text snaps back to the pixel grid when it ends,
   so the card visibly drops and twitches at the end of the lift. `top` is
   pixel-snapped on every frame, so there is nothing to snap at the end. */
.status-card:hover {
  top: -3px;
  box-shadow: var(--care-card-shadow-hover);
  border-color: color-mix(in srgb, var(--care-card-accent) 35%, transparent);
}

.status-card:hover::before {
  opacity: 1;
}

/* Expanded: marked, not moved, since it may hold a whole table. */
.status-card.is-open,
.status-card.is-open:hover {
  top: 0;
  border-color: color-mix(in srgb, var(--care-card-accent) 45%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--care-card-accent) 25%, transparent), var(--care-card-shadow);
}

/* Locked = sealed: hatched wash, a fading edge and a lock in the pill. */
.status-card--locked::before {
  background:
    repeating-linear-gradient(-45deg, color-mix(in srgb, var(--care-card-accent) 7%, transparent) 0 1px, transparent 1px 9px),
    radial-gradient(120% 100% at 0% 0%, color-mix(in srgb, var(--care-card-accent) 16%, transparent), transparent 70%);
  -webkit-mask-image: linear-gradient(180deg, #000 30%, transparent);
  mask-image: linear-gradient(180deg, #000 30%, transparent);
}

.status-card--locked::after {
  background: linear-gradient(180deg, var(--care-card-accent), color-mix(in srgb, var(--care-card-accent) 25%, transparent));
}

.status-card--locked .status-card-title {
  color: color-mix(in srgb, var(--care-card-text) 78%, var(--care-card-accent) 22%);
}

.status-card--dimmed .status-card-title {
  color: var(--care-card-muted);
}

/* ---------- Head ---------- */

.status-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.status-card-head-end {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  min-width: 0;
  margin-left: auto;
}

.status-card-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.6rem 0.2rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--care-card-accent);
  background: color-mix(in srgb, var(--care-card-accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--care-card-accent) 22%, transparent);
  border-radius: 999px;
}

/* Bootstrap's yellow is too light for text on a light pill. */
.status-card--warning .status-card-pill {
  color: color-mix(in srgb, var(--bs-warning) 70%, var(--bs-emphasis-color) 30%);
}

.status-card-dot {
  position: relative;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.status-card--live .status-card-dot::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: currentColor;
  animation: status-card-pulse 2.2s ease-out infinite;
}

.status-card-lock {
  transition: transform 0.35s var(--care-card-ease);
}

.status-card--locked:hover .status-card-lock {
  transform: rotate(-12deg) scale(1.1);
}

.status-card-id {
  margin-left: 0.3rem;
  font-family: var(--bs-font-monospace);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--care-card-muted);
  opacity: 0.8;
}

/* ---------- Title + meta ---------- */

.status-card-title {
  display: block;
  max-width: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: inherit;
  font-size: 1.02rem;
  font-weight: 650;
  line-height: 1.3;
  letter-spacing: -0.012em;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--care-card-text);
  background: none;
  border: 0;
}

button.status-card-title {
  cursor: pointer;
  transition: color 0.2s ease;
}

button.status-card-title:hover {
  color: var(--care-primary);
}

.status-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.9rem;
  margin-top: -0.3rem;
  font-size: 0.78rem;
  color: var(--care-card-muted);
}

.status-card-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
}

/* ---------- Counter + bar ---------- */

.status-card-progress {
  padding: 0.5rem 0.7rem 0.55rem;
  background: var(--care-card-surface-raised);
  border: 1px solid var(--care-card-border);
  border-radius: 10px;
}

.status-card-progress-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.3rem;
}

.status-card-progress-label {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--care-card-muted);
}

.status-card-progress-count {
  font-variant-numeric: tabular-nums;
  color: var(--care-card-text);
}

.status-card-progress-count strong {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.status-card-progress-suffix {
  margin-left: 0.3rem;
  font-size: 0.8rem;
  color: var(--care-card-muted);
}

.status-card-bar {
  position: relative;
  height: 5px;
  overflow: hidden;
  background: rgba(var(--bs-secondary-rgb), 0.15);
  border-radius: 999px;
}

.status-card-bar-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: linear-gradient(90deg, color-mix(in srgb, var(--care-card-accent) 65%, transparent), var(--care-card-accent));
  border-radius: inherit;
  transition: width 0.8s var(--care-card-ease);
  animation: status-card-bar-in 0.9s var(--care-card-ease) backwards;
  animation-delay: calc(min(var(--i, 0), 12) * 35ms + 150ms);
}

/* No upper limit: a calm striped track instead of a fake percentage. */
.status-card-bar--unbounded .status-card-bar-fill {
  opacity: 0.45;
  background: repeating-linear-gradient(
    -45deg,
    color-mix(in srgb, var(--care-card-accent) 55%, transparent) 0 6px,
    color-mix(in srgb, var(--care-card-accent) 25%, transparent) 6px 12px
  );
}

.status-card-hint {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.35rem;
  font-size: 0.72rem;
  color: var(--care-card-muted);
  cursor: help;
}

/* ---------- Date line ---------- */

.status-card-timeline {
  --status-card-tl: var(--bs-secondary);
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  padding: 0.3rem 0.55rem;
  font-size: 0.76rem;
  font-weight: 500;
  color: var(--care-card-muted);
  background: color-mix(in srgb, var(--status-card-tl) 7%, transparent);
  border: 1px solid color-mix(in srgb, var(--status-card-tl) 14%, transparent);
  border-radius: 8px;
  cursor: default;
}

.status-card-timeline svg {
  flex: 0 0 auto;
  color: var(--status-card-tl);
}

.status-card-timeline-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-card-timeline-relative {
  flex: 0 0 auto;
  margin-left: auto;
  padding-left: 0.4rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--status-card-tl);
}

.status-card-timeline--running { --status-card-tl: var(--bs-success); color: var(--care-card-text); }
.status-card-timeline--pending { --status-card-tl: var(--bs-info); color: var(--care-card-text); }
.status-card-timeline--muted { --status-card-tl: var(--bs-secondary); }

/* Closing within three days: amber, with a slow breathing glow. */
.status-card-timeline--soon {
  --status-card-tl: var(--bs-warning);
  color: var(--care-card-text);
  animation: status-card-soon 2.8s ease-in-out infinite;
}

.status-card-timeline--soon .status-card-timeline-relative {
  color: color-mix(in srgb, var(--bs-warning) 70%, var(--care-card-text) 30%);
}

/* ---------- Footer ---------- */

.status-card-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.65rem;
  border-top: 1px solid var(--care-card-border);
}

.status-card-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.38rem 0.85rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--care-on-primary);
  background: var(--care-primary);
  border: 1px solid transparent;
  border-radius: 8px;
  box-shadow:
    0 1px 2px color-mix(in srgb, var(--care-primary) 30%, transparent),
    0 4px 12px -4px color-mix(in srgb, var(--care-primary) 50%, transparent);
  transition: transform 0.2s var(--care-card-ease), box-shadow 0.2s ease, filter 0.2s ease, background-color 0.2s ease;
}

.status-card-primary:hover {
  filter: brightness(1.08);
  box-shadow:
    0 1px 2px color-mix(in srgb, var(--care-primary) 30%, transparent),
    0 8px 18px -6px color-mix(in srgb, var(--care-primary) 60%, transparent);
}

[data-bs-theme="dark"] .status-card-primary:hover {
  filter: none;
  background: var(--care-accent-hover);
}

.status-card-primary:active {
  transform: scale(0.97);
}

/* Quiet main action (read-only, e.g. inspect a finished session). */
.status-card-primary--ghost,
[data-bs-theme="dark"] .status-card-primary--ghost {
  color: var(--care-card-text);
  background: transparent;
  border-color: var(--care-card-border);
  box-shadow: none;
}

.status-card-primary--ghost:hover,
[data-bs-theme="dark"] .status-card-primary--ghost:hover {
  filter: none;
  background: rgba(var(--bs-secondary-rgb), 0.14);
  box-shadow: none;
}

.status-card-nudge {
  transition: transform 0.25s var(--care-card-ease);
}

.status-card-primary:hover .status-card-nudge {
  transform: translateX(3px);
}

.status-card-chevron {
  transition: transform 0.3s var(--care-card-ease);
}

.status-card.is-open .status-card-chevron {
  transform: rotate(180deg);
}

.status-card-actions {
  display: flex;
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: 0.15rem;
  margin-left: auto;
}

.status-card-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  color: var(--care-card-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, transform 0.2s var(--care-card-ease);
}

.status-card-icon-btn:hover {
  color: var(--care-card-text);
  background: rgba(var(--bs-secondary-rgb), 0.12);
  border-color: var(--care-card-border);
}

.status-card-icon-btn:active {
  transform: scale(0.92);
}

.status-card-icon-btn--danger:hover {
  color: var(--bs-danger);
  background: rgba(var(--bs-danger-rgb), 0.1);
  border-color: rgba(var(--bs-danger-rgb), 0.25);
}

.status-card-icon-btn.is-open {
  color: var(--care-primary);
  background: color-mix(in srgb, var(--care-primary) 10%, transparent);
  border-color: color-mix(in srgb, var(--care-primary) 25%, transparent);
}

button.status-card-title:focus-visible,
.status-card-primary:focus-visible,
.status-card-icon-btn:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--care-primary) 55%, transparent);
  outline-offset: 2px;
  border-radius: 6px;
}

/* ---------- Details (content inside the expanded card) ---------- */

.status-card-details {
  min-width: 0;
  padding-top: 0.35rem;
  border-top: 1px solid var(--care-card-border);
}

/* ---------- Compact (inside another card or panel) ---------- */

.status-card--compact {
  gap: 0.5rem;
  padding: 0.7rem 0.85rem 0.6rem 1rem;
  background: var(--care-card-surface-raised);
  border-radius: 12px;
  box-shadow: none;
  animation-duration: 0.4s;
  animation-delay: calc(min(var(--i, 0), 10) * 30ms);
}

.status-card--compact::before {
  display: none;
}

.status-card--compact:hover {
  top: -2px;
  box-shadow: 0 8px 20px -12px rgb(var(--care-shadow-rgb) / 0.35);
}

.status-card--compact .status-card-pill {
  padding: 0.15rem 0.55rem 0.15rem 0.45rem;
  font-size: 0.7rem;
}

.status-card--compact .status-card-meta {
  margin-top: 0;
}

.status-card--compact .status-card-foot {
  min-height: 2rem;
  padding-top: 0.5rem;
}

.status-card--compact .status-card-primary {
  padding: 0.3rem 0.75rem;
  font-size: 0.8rem;
  box-shadow: none;
}

.status-card--compact .status-card-icon-btn {
  width: 1.9rem;
  height: 1.9rem;
}

/* ---------- Live update states (same flags as BackendTable rows) ---------- */

.status-card--entering {
  animation: status-card-enter 0.9s var(--care-card-ease) both;
}

.status-card--updated {
  animation: status-card-updated 1.4s ease-out both;
}

.status-card--deleting {
  pointer-events: none;
  animation: status-card-delete 0.75s var(--care-card-ease) forwards;
}

.status-card--placeholder {
  pointer-events: none;
  opacity: 0.45;
}

/* ---------- Skeleton ---------- */

.status-card--skeleton {
  gap: 0.75rem;
}

.status-card--skeleton::before,
.status-card--skeleton::after {
  display: none;
}

.status-card-skeleton {
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    rgba(var(--bs-secondary-rgb), 0.1) 0%,
    rgba(var(--bs-secondary-rgb), 0.2) 40%,
    rgba(var(--bs-secondary-rgb), 0.1) 80%
  );
  background-size: 300% 100%;
  animation: status-card-shimmer 1.6s ease-in-out infinite;
}

.status-card-skeleton--pill { width: 34%; height: 1.15rem; border-radius: 999px; }
.status-card-skeleton--title { width: 78%; height: 1.25rem; }
.status-card-skeleton--meta { width: 45%; height: 0.8rem; }
.status-card-skeleton--block { width: 100%; height: 3.6rem; border-radius: 10px; }
.status-card-skeleton--footer { width: 100%; height: 2rem; margin-top: 0.4rem; }

/* ---------- Keyframes ---------- */

@keyframes status-card-in {
  from { opacity: 0; transform: translateY(10px) scale(0.985); }
  to { opacity: 1; transform: none; }
}

@keyframes status-card-enter {
  0% {
    opacity: 0;
    transform: translateY(-8px) scale(0.97);
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--care-primary) 0%, transparent);
  }
  40% {
    opacity: 1;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--care-primary) 35%, transparent);
  }
  100% {
    transform: none;
    box-shadow: var(--care-card-shadow);
  }
}

@keyframes status-card-updated {
  0% { box-shadow: 0 0 0 0 rgba(var(--bs-info-rgb), 0); }
  25% { box-shadow: 0 0 0 3px rgba(var(--bs-info-rgb), 0.4); }
  100% { box-shadow: var(--care-card-shadow); }
}

@keyframes status-card-delete {
  0% {
    opacity: 1;
    transform: none;
    box-shadow: 0 0 0 0 rgba(var(--bs-danger-rgb), 0);
  }
  30% {
    box-shadow: 0 0 0 3px rgba(var(--bs-danger-rgb), 0.35);
  }
  100% {
    opacity: 0;
    transform: scale(0.94);
    filter: blur(1px);
  }
}

@keyframes status-card-bar-in {
  from { transform: scaleX(0); transform-origin: left; }
  to { transform: scaleX(1); transform-origin: left; }
}

@keyframes status-card-soon {
  0%, 100% { box-shadow: 0 0 0 0 rgba(var(--bs-warning-rgb), 0); }
  50% { box-shadow: 0 0 0 3px rgba(var(--bs-warning-rgb), 0.16); }
}

@keyframes status-card-pulse {
  0% { transform: scale(1); opacity: 0.7; }
  80%, 100% { transform: scale(3); opacity: 0; }
}

@keyframes status-card-shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: 0 0; }
}

@media (prefers-reduced-motion: reduce) {
  .status-card,
  .status-card-bar-fill,
  .status-card-skeleton,
  .status-card-timeline--soon,
  .status-card--live .status-card-dot::after {
    animation: none !important;
  }

  .status-card,
  .status-card-grid,
  .status-card-primary,
  .status-card-icon-btn,
  .status-card-chevron,
  .status-card-nudge,
  .status-card-lock {
    transition: none;
  }

  .status-card:hover {
    top: 0;
  }
}
</style>
