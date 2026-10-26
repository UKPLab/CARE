<template>
  <div
    class="table-empty"
    :class="{ 'table-empty--compact': compact }"
    role="status"
    aria-live="polite"
  >
    <!-- Interactive search with no hits: a tiny chat. The user asks, CARE types… and does not care. -->
    <div
      v-if="searching"
      :key="chatKey"
      class="te-chat"
      :class="{ 'te-chat--sent': sent }"
    >
      <div class="te-row te-row--user">
        <div class="te-bubble te-bubble--user">
          <span class="visually-hidden">{{ askText }}</span>
          <span aria-hidden="true"><template
            v-for="part in visibleAskParts"
            :key="part.start"
          ><span
            v-if="part.kind === 'chip'"
            class="te-filter"
          >{{ part.text }}</span><span
            v-else
            :class="{ 'te-query': part.kind === 'query' }"
          >{{ part.text }}</span></template><span
            v-if="!sent"
            class="te-caret"
          /></span>
          <span
            class="te-sent"
            aria-hidden="true"
          >
            <LoadIcon
              icon-name="check2-all"
              :size="13"
            />
          </span>
        </div>
      </div>

      <div class="te-row te-row--bot">
        <span
          class="te-avatar"
          aria-hidden="true"
        >
          <LogoSvg :height="13" />
        </span>
        <div class="te-bot-slot">
          <div
            class="te-bubble te-bubble--typing"
            aria-hidden="true"
          >
            <span class="te-dot" />
            <span class="te-dot" />
            <span class="te-dot" />
          </div>
          <div
            class="te-bubble te-bubble--bot"
            :aria-label="t.chatReplyAria"
          >
            <span aria-hidden="true">{{ t.chatReplyPrefix }}</span>
            <LogoSvg
              class="te-reply-logo"
              :height="17"
              aria-hidden="true"
            />
            <span
              class="te-shrug"
              aria-hidden="true"
            >🤷</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Fallback (no data, no search, or a plain search): a lens wandering over ghost rows -->
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

/** Wording keys under common.emptyState; pages can replace any of them via `texts`. */
const TEXT_KEYS = [
  "searchTitle",
  "filterTitle",
  "searchHint",
  "noDataTitle",
  "noDataHint",
  "noDataHintCreate",
  "chatAskPrefix",
  "chatAskSuffix",
  "chatItems",
  "chatWithFilters",
  "chatReplyPrefix",
  "chatReplyAria",
];

function partLength(part) {
  return part.kind === "chip" ? 1 : part.text.length;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let instance = 0;

/**
 * Empty state for tables and their card views.
 *
 * - `searching`: the interactive search (Search.vue tokens / text) found nothing.
 *   Plays the chat scene and words the result as "nothing matches".
 * - otherwise the fallback: a lens over ghost rows. `filtered` (a plain search or column
 *   filters narrowed the rows) words it as "nothing matches"; without it, as "no data yet".
 *
 * Wording defaults to common.emptyState.*; pass `texts` to make it page-specific
 * (e.g. "No studies match"). An optional primary action (e.g. "Create a study") emits `action`.
 */
export default {
  name: "TableEmptyState",
  components: { LoadIcon, LogoSvg },
  props: {
    /** The interactive search holds text or filter chips (chat scene). */
    searching: {
      type: Boolean,
      required: false,
      default: false,
    },
    /** A plain search or column filter narrowed the rows (lens, "nothing matches" wording). */
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
      chatQuery: this.searchText,
      chatFilters: [...this.filterLabels],
      chatKey: 0,
      typed: 0,
      sent: false,
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
      push("text", `${this.t.chatAskPrefix} `);
      if (this.chatQuery) {
        push("query", `“${this.chatQuery}”`);
      } else {
        push("text", this.t.chatItems);
      }
      if (this.chatFilters.length > 0) {
        push("text", ` ${this.t.chatWithFilters} `);
        this.chatFilters.forEach((label) => push("chip", label));
      }
      push("text", this.t.chatAskSuffix);
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
.table-empty {
  --te-accent-rgb: var(--bs-primary-rgb);
  --te-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --te-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --te-bot-bg: var(--bs-body-bg);
  --te-bot-border: rgba(15, 23, 42, 0.1);

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

[data-bs-theme="dark"] .table-empty {
  --te-bot-bg: color-mix(in srgb, var(--bs-body-bg) 86%, #ffffff 14%);
  --te-bot-border: rgba(255, 255, 255, 0.1);
}

.table-empty--compact {
  padding: 1.5rem 1rem 2rem;
}

/* ======================= Chat scene ======================= */

.te-chat {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  width: min(100%, 23rem);
  margin-bottom: 1rem;
  padding: 1rem 1rem 1.1rem;
  text-align: left;
  border-radius: 18px;
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(var(--te-accent-rgb), 0.08), transparent 60%),
    radial-gradient(120% 90% at 0% 100%, rgba(var(--care-violet-rgb), 0.08), transparent 60%);
  border: 1px solid rgba(var(--bs-secondary-rgb), 0.14);
}

.te-row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}

.te-row--user {
  justify-content: flex-end;
}

.te-bubble {
  position: relative;
  max-width: 85%;
  padding: 0.5rem 0.8rem;
  font-size: 0.875rem;
  line-height: 1.4;
  border-radius: 16px;
  overflow-wrap: anywhere;
}

/* 1. The question pops in from the right. */
.te-bubble--user {
  padding-right: 2rem;
  color: #fff;
  background: linear-gradient(135deg, rgb(var(--te-accent-rgb)), color-mix(in srgb, rgb(var(--te-accent-rgb)) 70%, rgb(var(--care-violet-rgb)) 30%));
  border-bottom-right-radius: 5px;
  box-shadow: 0 6px 16px -8px rgba(var(--te-accent-rgb), 0.7);
  transform-origin: bottom right;
  animation: te-pop 0.45s var(--te-spring) 0.1s both;
}

.te-query {
  font-weight: 700;
}

/* Typewriter caret, gone once the message is sent. */
.te-caret {
  display: inline-block;
  width: 2px;
  height: 1.05em;
  margin-left: 1px;
  vertical-align: -0.18em;
  border-radius: 1px;
  background: rgba(255, 255, 255, 0.9);
  animation: te-caret 0.9s steps(1) infinite;
}

/* Same wording as the search chips: frosted pills that drop into the sentence as it is typed. */
.te-filter {
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
  animation: te-chip-in 0.42s var(--te-spring) both;
}

.te-filter::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 30%, rgba(255, 255, 255, 0.55) 50%, transparent 70%);
  transform: translateX(-120%);
  animation: te-shine 0.7s ease 0.15s both;
  pointer-events: none;
}

.te-sent {
  position: absolute;
  right: 0.6rem;
  bottom: 0.4rem;
  display: inline-flex;
  opacity: 0;
  color: rgba(255, 255, 255, 0.85);
  animation: te-fade 0.25s ease 0.05s forwards;
}

/* CARE's side waits until the question is fully typed and sent. */
.te-chat:not(.te-chat--sent) .te-sent,
.te-chat:not(.te-chat--sent) .te-avatar,
.te-chat:not(.te-chat--sent) .te-bubble--typing,
.te-chat:not(.te-chat--sent) .te-bubble--bot,
.te-chat:not(.te-chat--sent) .te-shrug {
  animation: none;
}

/* 2. CARE thinks about it… */
.te-avatar {
  flex: 0 0 auto;
  display: inline-grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: var(--te-bot-bg);
  border: 1px solid var(--te-bot-border);
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
  opacity: 0;
  animation: te-pop 0.35s var(--te-spring) 0.2s forwards;
}

.te-bot-slot {
  display: grid;
  min-width: 0;
}

.te-bot-slot > .te-bubble {
  grid-area: 1 / 1;
  justify-self: start;
}

.te-bubble--bot,
.te-bubble--typing {
  color: var(--bs-emphasis-color);
  background: var(--te-bot-bg);
  border: 1px solid var(--te-bot-border);
  border-bottom-left-radius: 5px;
  box-shadow: 0 4px 12px -6px rgba(15, 23, 42, 0.18);
  transform-origin: bottom left;
}

.te-bubble--typing {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.7rem 0.85rem;
  opacity: 0;
  animation: te-typing-life 1.5s ease 0.3s forwards;
}

.te-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bs-secondary-color);
  animation: te-bounce 0.9s ease-in-out infinite;
}

.te-dot:nth-child(2) { animation-delay: 0.15s; }
.te-dot:nth-child(3) { animation-delay: 0.3s; }

/* 3. …and does not CARE. */
.te-bubble--bot {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
  /* Short fixed reply: keep it on one line. overflow-wrap: anywhere from .te-bubble let the
     narrow grid slot break it as "I / don' / t". */
  white-space: nowrap;
  overflow-wrap: normal;
  flex-shrink: 0;
  opacity: 0;
  animation:
    te-pop 0.45s var(--te-spring) 1.75s forwards,
    te-wiggle 0.6s ease-in-out 2.3s 1;
}

.te-reply-logo {
  margin-top: -1px;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.12));
}

[data-bs-theme="dark"] .te-reply-logo {
  filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.35));
}

.te-shrug {
  display: inline-block;
  font-size: 1rem;
  transform-origin: 50% 80%;
  animation: te-shrug 1.8s ease-in-out 2.55s infinite;
}

/* ======================= Fallback: lens over ghost rows ======================= */

.te-art {
  width: 200px;
  height: auto;
  margin-bottom: 0.5rem;
  overflow: visible;
}

.table-empty--compact .te-art {
  width: 170px;
}

.te-glow-a { stop-color: rgb(var(--care-violet-rgb)); stop-opacity: 0.16; }
.te-glow-b { stop-color: rgb(var(--care-violet-rgb)); stop-opacity: 0; }

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

.te-ghost {
  transform-box: fill-box;
  transform-origin: center;
}

.te-ghost--back {
  opacity: 0.75;
  animation: te-float 6s ease-in-out infinite;
}

.te-ghost--front {
  animation: te-float 6s ease-in-out -3s infinite;
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

@keyframes te-pop {
  from { opacity: 0; transform: scale(0.6) translateY(6px); }
  to { opacity: 1; transform: none; }
}

@keyframes te-fade {
  to { opacity: 1; }
}

@keyframes te-caret {
  0% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes te-chip-in {
  0% { opacity: 0; transform: translateY(-7px) scale(0.55) rotate(-4deg); }
  60% { opacity: 1; }
  100% { opacity: 1; transform: none; }
}

@keyframes te-shine {
  to { transform: translateX(120%); }
}

/* Typing dots: appear, keep typing, then make room for the answer. */
@keyframes te-typing-life {
  0% { opacity: 0; transform: scale(0.7); }
  15% { opacity: 1; transform: none; }
  85% { opacity: 1; transform: none; }
  100% { opacity: 0; transform: scale(0.85); visibility: hidden; }
}

@keyframes te-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.45; }
  30% { transform: translateY(-4px); opacity: 1; }
}

@keyframes te-wiggle {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-3deg); }
  50% { transform: rotate(2.5deg); }
  75% { transform: rotate(-1.5deg); }
}

@keyframes te-shrug {
  0%, 70%, 100% { transform: translateY(0) rotate(0deg); }
  78% { transform: translateY(-3px) rotate(-8deg); }
  86% { transform: translateY(-3px) rotate(8deg); }
  94% { transform: translateY(0) rotate(0deg); }
}

@keyframes te-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
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

/* Reduced motion: no play-through; the finished conversation and a resting lens. */
@media (prefers-reduced-motion: reduce) {
  .table-empty,
  .te-ghost,
  .te-lens,
  .te-lens-mark,
  .te-dot,
  .te-shrug,
  .te-filter::after {
    animation: none !important;
  }

  .te-lens {
    transform: translate(140px, 66px);
  }

  .te-bubble--user,
  .te-filter,
  .te-sent,
  .te-avatar,
  .te-bubble--bot {
    animation: none !important;
    opacity: 1;
  }

  .te-bubble--typing {
    display: none;
  }
}
</style>
