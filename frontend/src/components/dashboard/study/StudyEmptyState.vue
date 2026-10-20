<template>
  <div
    class="study-empty"
    :class="{ 'study-empty--search': searching, 'study-empty--compact': compact }"
    role="status"
    aria-live="polite"
  >
    <!-- Search with no hits: a tiny chat. The user asks, CARE types… and does not care. -->
    <div
      v-if="searching"
      :key="chatKey"
      class="se-chat"
      :class="{ 'se-chat--sent': sent }"
    >
      <div class="se-row se-row--user">
        <div class="se-bubble se-bubble--user">
          <span class="visually-hidden">{{ askText }}</span>
          <span aria-hidden="true"><template
            v-for="part in visibleAskParts"
            :key="part.start"
          ><span
            v-if="part.kind === 'chip'"
            class="se-filter"
          >{{ part.text }}</span><span
            v-else
            :class="{ 'se-query': part.kind === 'query' }"
          >{{ part.text }}</span></template><span
            v-if="!sent"
            class="se-caret"
          /></span>
          <span
            class="se-sent"
            aria-hidden="true"
          >
            <LoadIcon
              icon-name="check2-all"
              :size="13"
            />
          </span>
        </div>
      </div>

      <div class="se-row se-row--bot">
        <span
          class="se-avatar"
          aria-hidden="true"
        >
          <LogoSvg :height="13" />
        </span>
        <div class="se-bot-slot">
          <div
            class="se-bubble se-bubble--typing"
            aria-hidden="true"
          >
            <span class="se-dot" />
            <span class="se-dot" />
            <span class="se-dot" />
          </div>
          <div
            class="se-bubble se-bubble--bot"
            :aria-label="$t('studies.cards.empty.chatReplyAria')"
          >
            <span aria-hidden="true">{{ $t('studies.cards.empty.chatReplyPrefix') }}</span>
            <LogoSvg
              class="se-reply-logo"
              :height="17"
              aria-hidden="true"
            />
            <span
              class="se-shrug"
              aria-hidden="true"
            >🤷</span>
          </div>
        </div>
      </div>
    </div>

    <!-- No studies at all: ghost cards and a sparkling plus -->
    <svg
      v-else
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
      <g class="spark">
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
import LogoSvg from "@/basic/icon/LogoSvg.vue";

/** Typing pause before the chat replays with the new query. */
const CHAT_SETTLE_MS = 450;
/** Typewriter for the question: start delay, per character, pause on a chip, cap for the text part. */
const TYPE_START_MS = 300;
const TYPE_CHAR_MS = 32;
const TYPE_CHIP_MS = 220;
const TYPE_TEXT_BUDGET_MS = 2000;
/** Beat between the last character and "sent". */
const SEND_PAUSE_MS = 280;

function partLength(part) {
  return part.kind === "chip" ? 1 : part.text.length;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let instance = 0;

/**
 * Empty state of the Studies dashboard, shared by the card grid and the table body.
 * Tells "nothing matches the search" apart from "no studies yet" and offers the way out.
 *
 * @author Andrii Nikitin
 */
export default {
  name: "StudyEmptyState",
  components: { LoadIcon, LogoSvg },
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
    /** Active filter chips, worded as in the search bar. */
    filterLabels: {
      type: Array,
      required: false,
      default: () => [],
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
      chatQuery: this.searchText,
      chatFilters: [...this.filterLabels],
      chatKey: 0,
      typed: 0,
      sent: false,
    };
  },
  computed: {
    askSignature() {
      return JSON.stringify([this.searchText, this.filterLabels]);
    },
    /** The question as typewriter units: text runs (per character) and chips (whole). */
    askParts() {
      const parts = [];
      let start = 0;
      const push = (kind, text) => {
        parts.push({ kind, text, start });
        start += partLength({ kind, text });
      };
      push("text", `${this.$t("studies.cards.empty.chatAskPrefix")} `);
      if (this.chatQuery) {
        push("query", `“${this.chatQuery}”`);
      } else {
        push("text", this.$t("studies.cards.empty.chatStudies"));
      }
      if (this.chatFilters.length > 0) {
        push("text", ` ${this.$t("studies.cards.empty.chatWithFilters")} `);
        this.chatFilters.forEach((label) => push("chip", label));
      }
      push("text", this.$t("studies.cards.empty.chatAskSuffix"));
      return parts;
    },
    askLength() {
      return this.askParts.reduce((sum, part) => sum + partLength(part), 0);
    },
    askText() {
      return this.askParts
        .map((part, index) => (part.kind === "chip" && this.askParts[index + 1]?.kind === "chip" ? `${part.text}, ` : part.text))
        .join("");
    },
    visibleAskParts() {
      return this.askParts
        .map((part) => {
          if (part.kind === "chip") return this.typed > part.start ? part : null;
          return { ...part, text: part.text.slice(0, Math.max(0, this.typed - part.start)) };
        })
        .filter((part) => part && part.text);
    },
  },
  watch: {
    searching(on) {
      if (!on) return;
      this.chatQuery = this.searchText;
      this.chatFilters = [...this.filterLabels];
      this.startTyping();
    },
    chatKey() {
      this.startTyping();
    },
    // The text changes per keystroke; replay the chat once the user pauses.
    askSignature() {
      clearTimeout(this._chatTimer);
      this._chatTimer = setTimeout(() => {
        if (this.askSignature === JSON.stringify([this.chatQuery, this.chatFilters])) return;
        this.chatQuery = this.searchText;
        this.chatFilters = [...this.filterLabels];
        this.chatKey += 1;
      }, CHAT_SETTLE_MS);
    },
  },
  mounted() {
    if (this.searching) this.startTyping();
  },
  beforeUnmount() {
    clearTimeout(this._chatTimer);
    clearTimeout(this._typeTimer);
  },
  methods: {
    /** Types the question out, then marks it sent so CARE's side of the scene starts. */
    startTyping() {
      clearTimeout(this._typeTimer);
      this.typed = 0;
      this.sent = false;
      if (prefersReducedMotion()) {
        this.typed = this.askLength;
        this.sent = true;
        return;
      }
      const chars = this.askParts
        .filter((part) => part.kind !== "chip")
        .reduce((sum, part) => sum + part.text.length, 0);
      const charMs = Math.min(TYPE_CHAR_MS, TYPE_TEXT_BUDGET_MS / Math.max(chars, 1));
      const step = () => {
        if (this.typed >= this.askLength) {
          this._typeTimer = setTimeout(() => { this.sent = true; }, SEND_PAUSE_MS);
          return;
        }
        const part = this.askParts.find((p) => this.typed >= p.start && this.typed < p.start + partLength(p));
        this.typed += 1;
        const delay = part.kind === "chip" ? TYPE_CHIP_MS : charMs * (0.6 + Math.random() * 0.8);
        this._typeTimer = setTimeout(step, delay);
      };
      this._typeTimer = setTimeout(step, TYPE_START_MS);
    },
  },
};
</script>

<style scoped>
.study-empty {
  --se-accent-rgb: var(--bs-primary-rgb);
  --se-violet-rgb: 111, 92, 230;
  --se-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --se-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --se-bot-bg: var(--bs-body-bg);
  --se-bot-border: rgba(15, 23, 42, 0.1);

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 2.25rem 1rem 2.75rem;
  text-align: center;
  font-family: "Inter Variable", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif;
  font-optical-sizing: auto;
  font-feature-settings: "cv01", "cv11", "ss03";
  color: var(--bs-secondary-color);
  animation: se-in 0.55s var(--se-ease) both;
}

[data-bs-theme="dark"] .study-empty {
  --se-violet-rgb: 167, 151, 255;
  --se-bot-bg: color-mix(in srgb, var(--bs-body-bg) 86%, #ffffff 14%);
  --se-bot-border: rgba(255, 255, 255, 0.1);
}

.study-empty--compact {
  padding: 1.5rem 1rem 2rem;
}

/* ======================= Chat scene ======================= */

.se-chat {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  width: min(100%, 23rem);
  margin-bottom: 1rem;
  padding: 1rem 1rem 1.1rem;
  text-align: left;
  border-radius: 18px;
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(var(--se-accent-rgb), 0.08), transparent 60%),
    radial-gradient(120% 90% at 0% 100%, rgba(var(--se-violet-rgb), 0.08), transparent 60%);
  border: 1px solid rgba(var(--bs-secondary-rgb), 0.14);
}

.se-row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}

.se-row--user {
  justify-content: flex-end;
}

.se-bubble {
  position: relative;
  max-width: 85%;
  padding: 0.5rem 0.8rem;
  font-size: 0.875rem;
  line-height: 1.4;
  border-radius: 16px;
  overflow-wrap: anywhere;
}

/* 1. The question pops in from the right. */
.se-bubble--user {
  padding-right: 2rem;
  color: #fff;
  background: linear-gradient(135deg, rgb(var(--se-accent-rgb)), color-mix(in srgb, rgb(var(--se-accent-rgb)) 70%, rgb(var(--se-violet-rgb)) 30%));
  border-bottom-right-radius: 5px;
  box-shadow: 0 6px 16px -8px rgba(var(--se-accent-rgb), 0.7);
  transform-origin: bottom right;
  animation: se-pop 0.45s var(--se-spring) 0.1s both;
}

.se-query {
  font-weight: 700;
}

/* Typewriter caret, gone once the message is sent. */
.se-caret {
  display: inline-block;
  width: 2px;
  height: 1.05em;
  margin-left: 1px;
  vertical-align: -0.18em;
  border-radius: 1px;
  background: rgba(255, 255, 255, 0.9);
  animation: se-caret 0.9s steps(1) infinite;
}

/* Same wording as the search chips: frosted pills that drop into the sentence as it is typed. */
.se-filter {
  position: relative;
  display: inline-block;
  margin: 0.12rem 0.2rem 0.12rem 0;
  padding: 0.05rem 0.5rem;
  overflow: hidden;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.45;
  white-space: nowrap;
  color: #fff;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 999px;
  /* overflow: hidden (for the shine) moves an inline-block's baseline to its bottom margin
     edge, which pushed the trailing "?" below the chip text. Centre the chip on the line. */
  vertical-align: middle;
  transform-origin: left center;
  animation: se-chip-in 0.42s var(--se-spring) both;
}

.se-filter::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 30%, rgba(255, 255, 255, 0.55) 50%, transparent 70%);
  transform: translateX(-120%);
  animation: se-shine 0.7s ease 0.15s both;
  pointer-events: none;
}

.se-sent {
  position: absolute;
  right: 0.6rem;
  bottom: 0.4rem;
  display: inline-flex;
  opacity: 0;
  color: rgba(255, 255, 255, 0.85);
  animation: se-fade 0.25s ease 0.05s forwards;
}

/* CARE's side waits until the question is fully typed and sent. */
.se-chat:not(.se-chat--sent) .se-sent,
.se-chat:not(.se-chat--sent) .se-avatar,
.se-chat:not(.se-chat--sent) .se-bubble--typing,
.se-chat:not(.se-chat--sent) .se-bubble--bot,
.se-chat:not(.se-chat--sent) .se-shrug {
  animation: none;
}

/* 2. CARE thinks about it… */
.se-avatar {
  flex: 0 0 auto;
  display: inline-grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: var(--se-bot-bg);
  border: 1px solid var(--se-bot-border);
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
  opacity: 0;
  animation: se-pop 0.35s var(--se-spring) 0.2s forwards;
}

.se-bot-slot {
  display: grid;
  min-width: 0;
}

.se-bot-slot > .se-bubble {
  grid-area: 1 / 1;
  justify-self: start;
}

.se-bubble--bot,
.se-bubble--typing {
  color: var(--bs-emphasis-color);
  background: var(--se-bot-bg);
  border: 1px solid var(--se-bot-border);
  border-bottom-left-radius: 5px;
  box-shadow: 0 4px 12px -6px rgba(15, 23, 42, 0.18);
  transform-origin: bottom left;
}

.se-bubble--typing {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.7rem 0.85rem;
  opacity: 0;
  animation: se-typing-life 1.5s ease 0.3s forwards;
}

.se-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bs-secondary-color);
  animation: se-bounce 0.9s ease-in-out infinite;
}

.se-dot:nth-child(2) { animation-delay: 0.15s; }
.se-dot:nth-child(3) { animation-delay: 0.3s; }

/* 3. …and does not CARE. */
.se-bubble--bot {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
  /* Short fixed reply: keep it on one line. overflow-wrap: anywhere from .se-bubble let the
     narrow grid slot break it as "I / don' / t". */
  white-space: nowrap;
  overflow-wrap: normal;
  flex-shrink: 0;
  opacity: 0;
  animation:
    se-pop 0.45s var(--se-spring) 1.75s forwards,
    se-wiggle 0.6s ease-in-out 2.3s 1;
}

.se-reply-logo {
  margin-top: -1px;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.12));
}

[data-bs-theme="dark"] .se-reply-logo {
  filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.35));
}

.se-shrug {
  display: inline-block;
  font-size: 1rem;
  transform-origin: 50% 80%;
  animation: se-shrug 1.8s ease-in-out 2.55s infinite;
}

/* ======================= No studies: illustration ======================= */

.study-empty-art {
  width: 200px;
  height: auto;
  margin-bottom: 0.5rem;
  overflow: visible;
}

.study-empty--compact .study-empty-art {
  width: 170px;
}

.glow-stop-a { stop-color: rgb(var(--se-violet-rgb)); stop-opacity: 0.16; }
.glow-stop-b { stop-color: rgb(var(--se-violet-rgb)); stop-opacity: 0; }

.ghost-card {
  fill: var(--bs-body-bg);
  stroke: rgba(var(--bs-secondary-rgb), 0.25);
  stroke-width: 1.2;
}

[data-bs-theme="dark"] .ghost-card {
  fill: color-mix(in srgb, var(--bs-body-bg) 88%, #ffffff 12%);
  stroke: rgba(255, 255, 255, 0.12);
}

.ghost-pill { fill: rgba(var(--bs-secondary-rgb), 0.22); }
.ghost-pill--accent { fill: rgba(var(--se-violet-rgb), 0.35); }
.ghost-line { fill: rgba(var(--bs-secondary-rgb), 0.2); }
.ghost-line--soft { fill: rgba(var(--bs-secondary-rgb), 0.12); }

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

.spark-disc {
  fill: rgb(var(--se-accent-rgb));
  filter: drop-shadow(0 4px 8px rgba(var(--se-accent-rgb), 0.45));
}

.spark-plus {
  stroke: #fff;
  stroke-width: 3;
  stroke-linecap: round;
}

.spark-disc,
.spark-plus {
  transform-box: fill-box;
  transform-origin: center;
  animation: se-heartbeat 3.2s var(--se-ease) infinite;
}

.spark-star {
  fill: rgb(var(--se-violet-rgb));
  transform-box: fill-box;
  transform-origin: center;
}

.spark-star--a { animation: se-twinkle 2.6s ease-in-out infinite; }
.spark-star--b { animation: se-twinkle 2.6s ease-in-out -1.3s infinite; }

/* ======================= Copy + actions ======================= */

.study-empty-title {
  max-width: 34rem;
  font-size: 1.05rem;
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

/* ======================= Keyframes ======================= */

@keyframes se-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}

@keyframes se-pop {
  from { opacity: 0; transform: scale(0.6) translateY(6px); }
  to { opacity: 1; transform: none; }
}

@keyframes se-fade {
  to { opacity: 1; }
}

@keyframes se-caret {
  0% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes se-chip-in {
  0% { opacity: 0; transform: translateY(-7px) scale(0.55) rotate(-4deg); }
  60% { opacity: 1; }
  100% { opacity: 1; transform: none; }
}

@keyframes se-shine {
  to { transform: translateX(120%); }
}

/* Typing dots: appear, keep typing, then make room for the answer. */
@keyframes se-typing-life {
  0% { opacity: 0; transform: scale(0.7); }
  15% { opacity: 1; transform: none; }
  85% { opacity: 1; transform: none; }
  100% { opacity: 0; transform: scale(0.85); visibility: hidden; }
}

@keyframes se-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.45; }
  30% { transform: translateY(-4px); opacity: 1; }
}

@keyframes se-wiggle {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-3deg); }
  50% { transform: rotate(2.5deg); }
  75% { transform: rotate(-1.5deg); }
}

@keyframes se-shrug {
  0%, 70%, 100% { transform: translateY(0) rotate(0deg); }
  78% { transform: translateY(-3px) rotate(-8deg); }
  86% { transform: translateY(-3px) rotate(8deg); }
  94% { transform: translateY(0) rotate(0deg); }
}

@keyframes se-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

@keyframes se-heartbeat {
  0%, 100% { transform: scale(1); }
  12% { transform: scale(1.12); }
  24% { transform: scale(0.98); }
  36% { transform: scale(1); }
}

@keyframes se-twinkle {
  0%, 100% { opacity: 0.25; transform: scale(0.7) rotate(0deg); }
  50% { opacity: 1; transform: scale(1.1) rotate(45deg); }
}

/* Reduced motion: skip the play-through and show the finished conversation. */
@media (prefers-reduced-motion: reduce) {
  .study-empty,
  .ghost,
  .spark-disc,
  .spark-plus,
  .spark-star,
  .se-dot,
  .se-shrug,
  .se-filter::after {
    animation: none !important;
  }

  .se-bubble--user,
  .se-filter,
  .se-sent,
  .se-avatar,
  .se-bubble--bot {
    animation: none !important;
    opacity: 1;
  }

  .se-bubble--typing {
    display: none;
  }
}
</style>
