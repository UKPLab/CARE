<template>
  <div
    class="table-empty"
    :class="{ 'table-empty--compact': compact }"
    role="status"
    aria-live="polite"
  >
    <!-- A search with no hits: a lens wandering over ghost rows. -->
    <svg
      v-if="narrowed"
      class="te-art"
      viewBox="0 0 220 150"
      aria-hidden="true"
    >
      <defs>
        <radialGradient
          :id="uid + '-glow'"
          cx="50%"
          cy="55%"
          r="55%"
        >
          <stop
            offset="0%"
            class="te-glow-a"
          />
          <stop
            offset="100%"
            class="te-glow-b"
          />
        </radialGradient>
      </defs>
      <ellipse
        cx="110"
        cy="80"
        rx="100"
        ry="64"
        :fill="'url(#' + uid + '-glow)'"
      />
      <g class="te-ghost te-ghost--back">
        <rect
          x="34"
          y="40"
          width="78"
          height="58"
          rx="9"
          class="te-ghost-card"
        />
        <rect
          x="44"
          y="52"
          width="26"
          height="7"
          rx="3.5"
          class="te-ghost-pill"
        />
        <rect
          x="44"
          y="66"
          width="54"
          height="6"
          rx="3"
          class="te-ghost-line"
        />
        <rect
          x="44"
          y="78"
          width="38"
          height="5"
          rx="2.5"
          class="te-ghost-line te-ghost-line--soft"
        />
      </g>
      <g class="te-ghost te-ghost--front">
        <rect
          x="104"
          y="30"
          width="84"
          height="62"
          rx="10"
          class="te-ghost-card"
        />
        <rect
          x="115"
          y="43"
          width="28"
          height="7"
          rx="3.5"
          class="te-ghost-pill te-ghost-pill--accent"
        />
        <rect
          x="115"
          y="57"
          width="60"
          height="6"
          rx="3"
          class="te-ghost-line"
        />
        <rect
          x="115"
          y="69"
          width="44"
          height="5"
          rx="2.5"
          class="te-ghost-line te-ghost-line--soft"
        />
      </g>
      <g class="te-lens">
        <circle
          cx="0"
          cy="0"
          r="22"
          class="te-lens-glass"
        />
        <circle
          cx="0"
          cy="0"
          r="22"
          class="te-lens-ring"
        />
        <path
          d="M -8 -10 A 12 12 0 0 1 6 -14"
          class="te-lens-shine"
        />
        <line
          x1="16"
          y1="16"
          x2="32"
          y2="32"
          class="te-lens-handle"
        />
        <text
          x="0"
          y="7"
          text-anchor="middle"
          class="te-lens-mark"
        >?</text>
      </g>
    </svg>

    <!-- Nothing here and nobody searched: a tumbleweed rolls through an empty desert. -->
    <svg
      v-else
      class="te-art"
      viewBox="0 0 220 150"
      aria-hidden="true"
    >
      <defs>
        <radialGradient
          :id="uid + '-glow'"
          cx="50%"
          cy="60%"
          r="55%"
        >
          <stop
            offset="0%"
            class="te-glow-a"
          />
          <stop
            offset="100%"
            class="te-glow-b"
          />
        </radialGradient>
      </defs>
      <ellipse
        cx="110"
        cy="88"
        rx="104"
        ry="58"
        :fill="'url(#' + uid + '-glow)'"
      />

      <!-- Sun, cactus and the ground line -->
      <circle
        cx="176"
        cy="40"
        r="11"
        class="te-sun"
      />
      <g class="te-cactus">
        <rect
          x="150"
          y="76"
          width="11"
          height="42"
          rx="5.5"
        />
        <path d="M 150 96 h -6 a 4 4 0 0 1 -4 -4 v -9 a 3.5 3.5 0 0 1 7 0 v 6 h 3 z" />
        <path d="M 161 90 h 5 a 4 4 0 0 0 4 -4 v -8 a 3.5 3.5 0 0 0 -7 0 v 5 h -2 z" />
      </g>
      <path
        d="M 14 118 H 206"
        class="te-ground"
      />
      <path
        d="M 30 124 h 14 M 70 125 h 8 M 120 124 h 18 M 176 125 h 10"
        class="te-ground te-ground--soft"
      />

      <!-- Gusts of wind -->
      <path
        d="M 26 70 h 30"
        class="te-wind te-wind--a"
      />
      <path
        d="M 60 88 h 22"
        class="te-wind te-wind--b"
      />
      <path
        d="M 18 100 h 18"
        class="te-wind te-wind--c"
      />

      <!-- Track (moves across) > hop (bounces) > weed (spins); shadow and dust only move.
           The weed is a loose tangle of crossing twigs with spikes poking out, no closed
           outline, so it reads as dry brush rather than a wheel. -->
      <g class="te-tumble-track">
        <ellipse
          cx="0"
          cy="119"
          rx="14"
          ry="2.4"
          class="te-tumble-shadow"
        />
        <g class="te-dust">
          <circle
            cx="-11"
            cy="117"
            r="2.2"
          />
          <circle
            cx="-16"
            cy="115"
            r="1.4"
          />
          <circle
            cx="9"
            cy="117.5"
            r="1.6"
          />
        </g>
        <g class="te-tumble-hop">
          <g class="te-tumble">
            <!-- Outer tangle: long crossing twigs -->
            <path
              class="te-weed"
              d="M -13 101 Q -3 89 10 95
                 M -11 111 Q 1 97 13 106
                 M -7 92 Q 7 102 -2 117
                 M 5 90 Q -9 104 7 117
                 M -14 106 Q -4 116 11 112
                 M -10 94 Q 3 109 14 100
                 M 12 94 Q -1 100 -8 116
                 M -3 91 Q 13 104 1 118
                 M -13 103 C -6 95 7 113 13 102
                 M -9 113 C -14 100 5 88 9 93"
            />
            <!-- Spikes and forks poking out of the silhouette -->
            <path
              class="te-weed te-weed--twig"
              d="M -13 101 l -5 -2 m 2 1 l -1 -3
                 M 10 95 l 4 -5 m -2 3 l 3 0
                 M 13 106 l 5 1 m -2 0 l 1 3
                 M -2 117 l -2 5
                 M 7 117 l 3 4 m -1 -1 l 3 -1
                 M -14 106 l -5 2
                 M 5 90 l 1 -5 m 0 2 l 3 -2
                 M -10 94 l -3 -4
                 M 14 100 l 4 -2
                 M -8 116 l -4 3"
            />
            <!-- Denser, darker core -->
            <path
              class="te-weed te-weed--core"
              d="M -5 101 q 4 -4 8 0 t -2 7 q -5 2 -6 -3
                 M -2 98 q 6 3 3 9
                 M 3 99 q -6 2 -4 8"
            />
          </g>
        </g>
      </g>
    </svg>

    <div class="te-title">
      <template v-if="title">
        {{ title }}
      </template>
      <template v-else-if="narrowed && searchText">
        {{ t.searchTitle }}
        <span class="te-title-query">“{{ searchText }}”</span>
      </template>
      <template v-else-if="narrowed">
        {{ t.filterTitle }}
      </template>
      <template v-else>
        {{ t.noDataTitle }}
      </template>
    </div>

    <p class="te-hint">
      {{ hint }}
    </p>

    <div
      v-if="(narrowed && clearable) || actionLabel"
      class="te-actions"
    >
      <button
        v-if="narrowed && clearable"
        type="button"
        class="te-btn"
        @click="$emit('clear')"
      >
        <LoadIcon
          icon-name="x-circle"
          :size="14"
        />
        {{ $t('common.clearSearch') }}
      </button>
      <button
        v-if="actionLabel"
        type="button"
        class="te-btn"
        :class="{ 'te-btn--primary': !narrowed }"
        @click="$emit('action')"
      >
        <LoadIcon
          :icon-name="actionIcon"
          :size="14"
        />
        {{ actionLabel }}
      </button>
    </div>
  </div>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";

/** Wording keys under common.emptyState; pages can replace any of them via `texts`. */
const TEXT_KEYS = [
  "searchTitle",
  "filterTitle",
  "searchHint",
  "noDataTitle",
  "noDataHint",
  "noDataHintCreate",
];

let instance = 0;

/**
 * Empty state for tables and their card views.
 *
 * - `searching` or `filtered` found nothing: a lens wandering over ghost rows, "nothing matches".
 * - nothing to show and nobody searched: a tumbleweed rolling through, "no data yet".
 *
 * Wording defaults to common.emptyState.*; pass `texts` to make it page-specific
 * (e.g. "No studies match"). An optional primary action (e.g. "Create a study") emits `action`.
 */
export default {
  name: "TableEmptyState",
  components: { LoadIcon },
  props: {
    /** The interactive search holds text or filter chips. */
    searching: {
      type: Boolean,
      required: false,
      default: false,
    },
    /** A plain search or column filter narrowed the rows. */
    filtered: {
      type: Boolean,
      required: false,
      default: false,
    },
    searchText: {
      type: String,
      required: false,
      default: "",
    },
    /** Active filter chips, worded as in the search bar. */
    filterLabels: {
      type: Array,
      required: false,
      default: () => [],
    },
    /** Override pieces of the wording; keys as in common.emptyState. */
    texts: {
      type: Object,
      required: false,
      default: () => ({}),
    },
    /** Fixed title, replacing the state-dependent one. */
    title: {
      type: String,
      required: false,
      default: "",
    },
    /** Show "Clear search" while narrowed. */
    clearable: {
      type: Boolean,
      required: false,
      default: true,
    },
    actionLabel: {
      type: String,
      required: false,
      default: "",
    },
    actionIcon: {
      type: String,
      required: false,
      default: "plus-lg",
    },
    /** Tighter spacing, for a table body row. */
    compact: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  emits: ["clear", "action"],
  data() {
    instance += 1;
    return {
      uid: `table-empty-${instance}`,
    };
  },
  computed: {
    t() {
      const out = {};
      TEXT_KEYS.forEach((key) => {
        out[key] = this.texts[key] ?? this.$t(`common.emptyState.${key}`);
      });
      return out;
    },
    narrowed() {
      return this.searching || this.filtered;
    },
    /** Search advice while narrowed; otherwise nudge towards the create action if there is one. */
    hint() {
      if (this.narrowed) return this.t.searchHint;
      return this.actionLabel ? this.t.noDataHintCreate : this.t.noDataHint;
    },
  },
};
</script>

<style scoped>
.table-empty {
  --te-accent-rgb: var(--bs-primary-rgb);
  --te-ease: cubic-bezier(0.22, 1, 0.36, 1);

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 2.25rem 1rem 2.75rem;
  text-align: center;
  white-space: normal;
  color: var(--bs-secondary-color);
  animation: te-in 0.55s var(--te-ease) both;
}

.table-empty--compact {
  padding: 1.5rem 1rem 2rem;
}

/* ======================= Search: lens over ghost rows ======================= */

.te-ghost-card {
  fill: var(--bs-body-bg);
  stroke: rgba(var(--bs-secondary-rgb), 0.25);
  stroke-width: 1.2;
}

[data-bs-theme="dark"] .te-ghost-card {
  fill: color-mix(in srgb, var(--bs-body-bg) 88%, #ffffff 12%);
  stroke: rgba(255, 255, 255, 0.12);
}

.te-ghost-pill { fill: rgba(var(--bs-secondary-rgb), 0.22); }
.te-ghost-pill--accent { fill: rgba(var(--care-violet-rgb), 0.35); }
.te-ghost-line { fill: rgba(var(--bs-secondary-rgb), 0.2); }
.te-ghost-line--soft { fill: rgba(var(--bs-secondary-rgb), 0.12); }

.te-ghost--back {
  opacity: 0.75;
}

/* The lens wanders over the rows, as if still looking. */
.te-lens {
  animation: te-search 5.5s ease-in-out infinite;
}

.te-lens-glass {
  fill: rgba(var(--te-accent-rgb), 0.08);
}

.te-lens-ring {
  fill: none;
  stroke: rgb(var(--te-accent-rgb));
  stroke-width: 4;
}

.te-lens-shine {
  fill: none;
  stroke: rgba(255, 255, 255, 0.75);
  stroke-width: 2.5;
  stroke-linecap: round;
}

.te-lens-handle {
  stroke: rgb(var(--te-accent-rgb));
  stroke-width: 6;
  stroke-linecap: round;
}

.te-lens-mark {
  font-family: inherit;
  font-size: 20px;
  font-weight: 700;
  fill: rgb(var(--te-accent-rgb));
  animation: te-blink 5.5s ease-in-out infinite;
}

/* ======================= No data: tumbleweed ======================= */

.te-art {
  --te-weed: #b08d57;
  width: 200px;
  height: auto;
  margin-bottom: 0.5rem;
  overflow: visible;
}

[data-bs-theme="dark"] .te-art {
  --te-weed: #d9c79a;
}

.table-empty--compact .te-art {
  width: 170px;
}

.te-glow-a { stop-color: rgb(var(--care-violet-rgb)); stop-opacity: 0.12; }
.te-glow-b { stop-color: rgb(var(--care-violet-rgb)); stop-opacity: 0; }

.te-sun {
  fill: color-mix(in srgb, var(--te-weed) 35%, transparent);
}

.te-cactus {
  fill: rgba(var(--bs-secondary-rgb), 0.2);
}

.te-ground {
  fill: none;
  stroke: rgba(var(--bs-secondary-rgb), 0.35);
  stroke-width: 1.5;
  stroke-linecap: round;
}

.te-ground--soft {
  stroke: rgba(var(--bs-secondary-rgb), 0.2);
}

.te-wind {
  fill: none;
  stroke: rgba(var(--bs-secondary-rgb), 0.4);
  stroke-width: 1.6;
  stroke-linecap: round;
  opacity: 0;
  animation: te-gust 3.2s ease-in-out infinite;
}

.te-wind--b { animation-delay: 1.1s; }
.te-wind--c { animation-delay: 2.1s; }

/* Across the scene in one go, fading in and out at the edges. */
.te-tumble-track {
  animation: te-roll 7s linear infinite;
}

.te-tumble-shadow {
  fill: rgba(var(--bs-secondary-rgb), 0.22);
  transform-box: fill-box;
  transform-origin: center;
  animation: te-shadow 1.15s ease-in-out infinite;
}

.te-tumble-hop {
  animation: te-hop 1.15s infinite;
}

.te-tumble {
  transform-box: fill-box;
  transform-origin: center;
  animation: te-spin 1.15s linear infinite;
}

.te-weed {
  fill: none;
  stroke: var(--te-weed);
  stroke-width: 1.25;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.te-weed--twig {
  stroke-width: 1.05;
  opacity: 0.85;
}

.te-weed--core {
  stroke: color-mix(in srgb, var(--te-weed) 70%, #000000 30%);
  stroke-width: 1.6;
}

[data-bs-theme="dark"] .te-weed--core {
  stroke: color-mix(in srgb, var(--te-weed) 75%, #ffffff 25%);
}

/* Little puffs kicked up each time the weed lands. */
.te-dust circle {
  fill: rgba(var(--bs-secondary-rgb), 0.3);
  transform-box: fill-box;
  transform-origin: center;
  animation: te-dust 1.15s ease-out infinite;
}

.te-dust circle:nth-child(2) { animation-delay: 0.05s; }
.te-dust circle:nth-child(3) { animation-delay: 0.08s; }

/* ======================= Copy + actions ======================= */

.te-title {
  max-width: 34rem;
  font-size: 1.05rem;
  font-weight: 650;
  letter-spacing: -0.015em;
  line-height: 1.35;
  color: var(--bs-emphasis-color);
  overflow-wrap: anywhere;
}

.te-title-query {
  padding: 0 0.15em;
  color: rgb(var(--care-violet-rgb));
  background: linear-gradient(transparent 62%, rgba(var(--care-violet-rgb), 0.16) 62%);
}

.te-hint {
  max-width: 28rem;
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
}

.te-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.9rem;
}

.te-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.42rem 0.9rem;
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--bs-body-color);
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 9px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  transition: border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.15s var(--te-ease);
}

.te-btn:hover {
  color: var(--care-primary);
  border-color: color-mix(in srgb, var(--care-primary) 40%, transparent);
  box-shadow: 0 4px 12px -4px color-mix(in srgb, var(--care-primary) 30%, transparent);
}

.te-btn:active {
  transform: scale(0.97);
}

.te-btn:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--care-primary) 50%, transparent);
  outline-offset: 2px;
}

.te-btn--primary {
  color: var(--care-on-primary);
  background: var(--care-primary);
  border-color: var(--care-primary);
  box-shadow:
    0 1px 2px color-mix(in srgb, var(--care-primary) 30%, transparent),
    0 6px 16px -6px color-mix(in srgb, var(--care-primary) 55%, transparent);
}

.te-btn--primary:hover {
  color: var(--care-on-primary);
  filter: brightness(1.06);
}

/* ======================= Keyframes ======================= */

@keyframes te-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}

@keyframes te-search {
  0% { transform: translate(78px, 66px) rotate(0deg); }
  25% { transform: translate(140px, 56px) rotate(8deg); }
  50% { transform: translate(150px, 82px) rotate(-4deg); }
  75% { transform: translate(92px, 88px) rotate(6deg); }
  100% { transform: translate(78px, 66px) rotate(0deg); }
}

@keyframes te-blink {
  0%, 40%, 60%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}

@keyframes te-roll {
  0% { transform: translateX(-24px); opacity: 0; }
  8% { opacity: 1; }
  88% { opacity: 1; }
  100% { transform: translateX(244px); opacity: 0; }
}

/* Up fast, a little float at the top, then drop onto the ground. */
@keyframes te-hop {
  0% { transform: translateY(0); animation-timing-function: cubic-bezier(0.2, 0.7, 0.4, 1); }
  45% { transform: translateY(-15px); animation-timing-function: cubic-bezier(0.6, 0, 0.8, 0.3); }
  100% { transform: translateY(0); }
}

@keyframes te-shadow {
  0%, 100% { transform: scaleX(1); opacity: 1; }
  45% { transform: scaleX(0.6); opacity: 0.5; }
}

@keyframes te-spin {
  to { transform: rotate(360deg); }
}

/* Puff right at the landing (start of each hop), then drift up and fade. */
@keyframes te-dust {
  0% { transform: scale(0.4); opacity: 0.9; }
  35% { transform: translate(-3px, -3px) scale(1.4); opacity: 0; }
  100% { transform: scale(0.4); opacity: 0; }
}

@keyframes te-gust {
  0% { transform: translateX(0); opacity: 0; }
  30% { opacity: 1; }
  100% { transform: translateX(34px); opacity: 0; }
}

/* Reduced motion: a resting lens, and the tumbleweed parked mid-scene. */
@media (prefers-reduced-motion: reduce) {
  .table-empty,
  .te-lens,
  .te-lens-mark,
  .te-wind,
  .te-tumble-track,
  .te-tumble-hop,
  .te-tumble,
  .te-tumble-shadow,
  .te-dust circle {
    animation: none !important;
  }

  .te-lens {
    transform: translate(140px, 66px);
  }

  .te-tumble-track {
    transform: translateX(84px);
  }

  .te-dust {
    display: none;
  }
}
</style>
