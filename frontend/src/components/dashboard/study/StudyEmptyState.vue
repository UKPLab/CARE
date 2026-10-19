<template>
  <div
    class="study-empty"
    :class="{ 'study-empty--search': searching, 'study-empty--compact': compact }"
    role="status"
    aria-live="polite"
  >
    <svg
      class="study-empty-art"
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
            class="glow-stop-a"
          />
          <stop
            offset="100%"
            class="glow-stop-b"
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

      <!-- Ghost study cards drifting behind the lens -->
      <g class="ghost ghost--back">
        <rect
          x="34"
          y="40"
          width="78"
          height="58"
          rx="9"
          class="ghost-card"
        />
        <rect
          x="44"
          y="52"
          width="26"
          height="7"
          rx="3.5"
          class="ghost-pill"
        />
        <rect
          x="44"
          y="66"
          width="54"
          height="6"
          rx="3"
          class="ghost-line"
        />
        <rect
          x="44"
          y="78"
          width="38"
          height="5"
          rx="2.5"
          class="ghost-line ghost-line--soft"
        />
      </g>
      <g class="ghost ghost--front">
        <rect
          x="104"
          y="30"
          width="84"
          height="62"
          rx="10"
          class="ghost-card"
        />
        <rect
          x="115"
          y="43"
          width="28"
          height="7"
          rx="3.5"
          class="ghost-pill ghost-pill--accent"
        />
        <rect
          x="115"
          y="57"
          width="60"
          height="6"
          rx="3"
          class="ghost-line"
        />
        <rect
          x="115"
          y="69"
          width="44"
          height="5"
          rx="2.5"
          class="ghost-line ghost-line--soft"
        />
      </g>

      <!-- Search: a lens that keeps looking; nothing to find: a sparkling plus -->
      <g
        v-if="searching"
        class="lens"
      >
        <circle
          cx="0"
          cy="0"
          r="22"
          class="lens-glass"
        />
        <circle
          cx="0"
          cy="0"
          r="22"
          class="lens-ring"
        />
        <path
          d="M -8 -10 A 12 12 0 0 1 6 -14"
          class="lens-shine"
        />
        <line
          x1="16"
          y1="16"
          x2="32"
          y2="32"
          class="lens-handle"
        />
        <text
          x="0"
          y="7"
          text-anchor="middle"
          class="lens-mark"
        >?</text>
      </g>
      <g
        v-else
        class="spark"
      >
        <circle
          cx="160"
          cy="108"
          r="17"
          class="spark-disc"
        />
        <path
          d="M 160 100 V 116 M 152 108 H 168"
          class="spark-plus"
        />
        <path
          d="M 186 40 l 2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 z"
          class="spark-star spark-star--a"
        />
        <path
          d="M 30 112 l 1.8 4.2 4.2 1.8 -4.2 1.8 -1.8 4.2 -1.8 -4.2 -4.2 -1.8 4.2 -1.8 z"
          class="spark-star spark-star--b"
        />
      </g>
    </svg>

    <div class="study-empty-title">
      <template v-if="searching && searchText">
        {{ $t('studies.cards.empty.searchTitle') }}
        <span class="study-empty-query">“{{ searchText }}”</span>
      </template>
      <template v-else-if="searching">
        {{ $t('studies.cards.empty.filterTitle') }}
      </template>
      <template v-else>
        {{ $t('studies.cards.emptyTitle') }}
      </template>
    </div>

    <p class="study-empty-hint">
      {{ searching ? $t('studies.cards.empty.searchHint') : $t('studies.cards.emptyHint') }}
    </p>

    <div
      v-if="searching || canCreate"
      class="study-empty-actions"
    >
      <button
        v-if="searching"
        type="button"
        class="study-empty-btn"
        @click="$emit('clear')"
      >
        <LoadIcon
          icon-name="x-circle"
          :size="14"
        />
        {{ $t('studies.cards.empty.clearSearch') }}
      </button>
      <button
        v-if="canCreate"
        type="button"
        class="study-empty-btn"
        :class="{ 'study-empty-btn--primary': !searching }"
        @click="$emit('create')"
      >
        <LoadIcon
          icon-name="plus-lg"
          :size="14"
        />
        {{ $t('studies.cards.empty.create') }}
      </button>
    </div>
  </div>
</template>

<script>
// Self-hosted (bundled by Vite, no third-party font CDN), SIL Open Font License 1.1.
import "@fontsource-variable/inter/opsz.css";
import LoadIcon from "@/basic/Icon.vue";

let instance = 0;

/**
 * Empty state of the Studies dashboard, shared by the card grid and the table body.
 * Tells "nothing matches the search" apart from "no studies yet" and offers the way out.
 *
 * @author Andrii Nikitin
 */
export default {
  name: "StudyEmptyState",
  components: { LoadIcon },
  props: {
    /** The search bar holds text or filter chips. */
    searching: {
      type: Boolean,
      required: false,
      default: false,
    },
    searchText: {
      type: String,
      required: false,
      default: "",
    },
    canCreate: {
      type: Boolean,
      required: false,
      default: false,
    },
    /** Tighter spacing, for the table body row. */
    compact: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  emits: ["clear", "create"],
  data() {
    instance += 1;
    return {
      uid: `study-empty-${instance}`,
    };
  },
};
</script>

<style scoped>
.study-empty {
  --se-accent-rgb: var(--bs-primary-rgb);
  --se-violet-rgb: 111, 92, 230;
  --se-ease: cubic-bezier(0.22, 1, 0.36, 1);

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 2.5rem 1rem 2.75rem;
  text-align: center;
  font-family: "Inter Variable", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif;
  font-optical-sizing: auto;
  font-feature-settings: "cv01", "cv11", "ss03";
  color: var(--bs-secondary-color);
  animation: se-in 0.55s var(--se-ease) both;
}

[data-bs-theme="dark"] .study-empty {
  --se-violet-rgb: 167, 151, 255;
}

.study-empty--compact {
  padding: 1.75rem 1rem 2rem;
}

/* ---------- Illustration ---------- */

.study-empty-art {
  width: 200px;
  height: auto;
  margin-bottom: 0.5rem;
  overflow: visible;
}

.study-empty--compact .study-empty-art {
  width: 170px;
}

.glow-stop-a {
  stop-color: rgb(var(--se-violet-rgb));
  stop-opacity: 0.16;
}

.glow-stop-b {
  stop-color: rgb(var(--se-violet-rgb));
  stop-opacity: 0;
}

.ghost-card {
  fill: var(--bs-body-bg);
  stroke: rgba(var(--bs-secondary-rgb), 0.25);
  stroke-width: 1.2;
}

[data-bs-theme="dark"] .ghost-card {
  fill: color-mix(in srgb, var(--bs-body-bg) 88%, #ffffff 12%);
  stroke: rgba(255, 255, 255, 0.12);
}

.ghost-pill {
  fill: rgba(var(--bs-secondary-rgb), 0.22);
}

.ghost-pill--accent {
  fill: rgba(var(--se-violet-rgb), 0.35);
}

.ghost-line {
  fill: rgba(var(--bs-secondary-rgb), 0.2);
}

.ghost-line--soft {
  fill: rgba(var(--bs-secondary-rgb), 0.12);
}

.ghost {
  transform-box: fill-box;
  transform-origin: center;
}

.ghost--back {
  opacity: 0.75;
  animation: se-float 6s ease-in-out infinite;
}

.ghost--front {
  animation: se-float 6s ease-in-out -3s infinite;
}

/* Lens wanders over the cards, as if still looking. */
.lens {
  animation: se-search 5.5s ease-in-out infinite;
}

.lens-glass {
  fill: rgba(var(--se-accent-rgb), 0.08);
}

.lens-ring {
  fill: none;
  stroke: rgb(var(--se-accent-rgb));
  stroke-width: 4;
}

.lens-shine {
  fill: none;
  stroke: rgba(255, 255, 255, 0.75);
  stroke-width: 2.5;
  stroke-linecap: round;
}

.lens-handle {
  stroke: rgb(var(--se-accent-rgb));
  stroke-width: 6;
  stroke-linecap: round;
}

.lens-mark {
  font-family: inherit;
  font-size: 20px;
  font-weight: 700;
  fill: rgb(var(--se-accent-rgb));
  animation: se-blink 5.5s ease-in-out infinite;
}

.spark-disc {
  fill: rgb(var(--se-accent-rgb));
  filter: drop-shadow(0 4px 8px rgba(var(--se-accent-rgb), 0.45));
}

.spark-plus {
  stroke: #fff;
  stroke-width: 3;
  stroke-linecap: round;
}

.spark {
  transform-box: view-box;
}

.spark-disc,
.spark-plus {
  transform-box: fill-box;
  transform-origin: center;
  animation: se-pop 3.2s var(--se-ease) infinite;
}

.spark-star {
  fill: rgb(var(--se-violet-rgb));
  transform-box: fill-box;
  transform-origin: center;
}

.spark-star--a {
  animation: se-twinkle 2.6s ease-in-out infinite;
}

.spark-star--b {
  animation: se-twinkle 2.6s ease-in-out -1.3s infinite;
}

/* ---------- Copy ---------- */

.study-empty-title {
  max-width: 34rem;
  font-size: 1.1rem;
  font-weight: 650;
  letter-spacing: -0.015em;
  line-height: 1.35;
  color: var(--bs-emphasis-color);
  overflow-wrap: anywhere;
}

.study-empty-query {
  padding: 0 0.15em;
  color: rgb(var(--se-violet-rgb));
  background: linear-gradient(transparent 62%, rgba(var(--se-violet-rgb), 0.16) 62%);
}

.study-empty-hint {
  max-width: 28rem;
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
}

.study-empty-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.9rem;
}

.study-empty-btn {
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
  transition: border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.15s var(--se-ease);
}

.study-empty-btn:hover {
  color: var(--bs-primary);
  border-color: rgba(var(--bs-primary-rgb), 0.4);
  box-shadow: 0 4px 12px -4px rgba(var(--bs-primary-rgb), 0.3);
}

.study-empty-btn:active {
  transform: scale(0.97);
}

.study-empty-btn:focus-visible {
  outline: 2px solid rgba(var(--bs-primary-rgb), 0.5);
  outline-offset: 2px;
}

.study-empty-btn--primary {
  color: #fff;
  background: var(--bs-primary);
  border-color: var(--bs-primary);
  box-shadow: 0 1px 2px rgba(var(--bs-primary-rgb), 0.3), 0 6px 16px -6px rgba(var(--bs-primary-rgb), 0.55);
}

.study-empty-btn--primary:hover {
  color: #fff;
  filter: brightness(1.06);
}

/* ---------- Motion ---------- */

@keyframes se-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes se-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

@keyframes se-search {
  0% { transform: translate(78px, 66px) rotate(0deg); }
  25% { transform: translate(140px, 56px) rotate(8deg); }
  50% { transform: translate(150px, 82px) rotate(-4deg); }
  75% { transform: translate(92px, 88px) rotate(6deg); }
  100% { transform: translate(78px, 66px) rotate(0deg); }
}

@keyframes se-blink {
  0%, 40%, 60%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}

@keyframes se-pop {
  0%, 100% { transform: scale(1); }
  12% { transform: scale(1.12); }
  24% { transform: scale(0.98); }
  36% { transform: scale(1); }
}

@keyframes se-twinkle {
  0%, 100% { opacity: 0.25; transform: scale(0.7) rotate(0deg); }
  50% { opacity: 1; transform: scale(1.1) rotate(45deg); }
}

@media (prefers-reduced-motion: reduce) {
  .study-empty,
  .ghost,
  .lens,
  .lens-mark,
  .spark-disc,
  .spark-plus,
  .spark-star {
    animation: none !important;
  }

  .lens {
    transform: translate(140px, 66px);
  }
}
</style>
