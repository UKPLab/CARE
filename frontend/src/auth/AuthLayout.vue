<template>
  <main class="auth-page" :style="clockStyle">
    <!-- Desk objects around the centered box -->
    <div class="auth-scene" aria-hidden="true">
      <span class="auth-blob auth-blob--bubble"></span>
      <span class="auth-blob auth-blob--book"></span>
      <span class="auth-blob auth-blob--pen"></span>
      <span class="auth-blob auth-blob--note"></span>
      <span class="auth-spark auth-spark--1"></span>
      <span class="auth-spark auth-spark--2"></span>
      <span class="auth-spark auth-spark--3"></span>
    </div>

    <div class="auth-stage">
      <div class="auth-shell">
        <div class="auth-card-wrap">
          <div v-if="$slots['above-card']" class="auth-above-card">
            <slot name="above-card" />
          </div>
          <div class="card auth-card">
            <div class="auth-card-main">
              <LogoSvg class="auth-mobile-logo" :height="44" />
              <div class="card-header d-flex justify-content-between align-items-center">
                <h1 class="card-title">
                  {{ title }}
                </h1>
                <slot name="header-action" />
              </div>
              <div class="card-body">
                <slot />
              </div>
              <!-- Always rendered: fills the space under the form, its content sits at the bottom -->
              <div class="auth-card-foot">
                <slot name="card-footer" />
              </div>
            </div>
            <div class="auth-card-brand" :class="{ 'auth-card-brand--intro': intro }">
              <span class="auth-brand-glow auth-brand-glow--primary" aria-hidden="true"></span>
              <span class="auth-brand-glow auth-brand-glow--accent" aria-hidden="true"></span>
              <span class="auth-brand-ring" aria-hidden="true"></span>
              <!-- Same element in both modes: the page switch morphs it from the big
                   centered logo to the small one in the corner and back -->
              <LogoSvg
                class="auth-brand-logo"
                aria-hidden="true"
                :width="intro ? null : 240"
                :height="intro ? 38 : null"
              />
              <div v-if="intro" class="auth-intro">
                <h2 class="auth-intro-title">{{ $t('auth.registerIntro.title') }}</h2>
                <p class="auth-intro-subtitle">{{ $t('auth.registerIntro.subtitle') }}</p>
                <ol class="auth-intro-steps">
                  <li
                    v-for="(step, index) in introSteps"
                    :key="step.key"
                    class="auth-intro-step"
                    :style="{ '--i': index }"
                  >
                    <span class="auth-intro-icon" aria-hidden="true">
                      <LoadIcon :icon-name="step.icon" :size="17" />
                    </span>
                    <span class="auth-intro-text">
                      <strong>{{ $t(`auth.registerIntro.steps.${step.key}.title`) }}</strong>
                      <span>{{ $t(`auth.registerIntro.steps.${step.key}.text`) }}</span>
                    </span>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <AppFooter class="auth-page-footer" />
  </main>
</template>

<script>
/**
 * Shared frame for the signed-out pages: one wide box in the middle of the page
 * (form on the left, logo with dot grid and glow on the right), desk objects
 * around it and the app footer at the bottom of the page.
 * Field rows written as label/col-md-* pairs are stacked so pages keep their markup.
 *
 * With `intro` the right half shows a short platform intro instead of the big logo.
 * On a page switch the logo morphs between both places (see auth-brand-logo below).
 *
 * @slot default - Card body
 * @slot header-action - Link or button next to the title
 * @slot above-card - Decoration that sits on the top edge of the form half, partly behind it
 * @slot card-footer - Small links and notes at the very bottom of the form half (e.g. docs, feedback, version)
 *
 * @author Mohammad Sherif
 */
import LogoSvg from "@/basic/icon/LogoSvg.vue";
import AppFooter from "@/basic/navigation/AppFooter.vue";
import LoadIcon from "@/basic/Icon.vue";

export default {
  name: "AuthLayout",
  components: { LogoSvg, AppFooter, LoadIcon },
  props: {
    title: {
      type: String,
      required: true,
    },
    /** Right half shows a short platform intro (register) instead of the big logo */
    intro: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    return {
      /**
       * Every auth page mounts its own layout, so the decoration animations would restart
       * at zero on each page switch and the objects would jump. A negative delay of the time
       * since page load puts all of them on one shared timeline: the new page continues
       * exactly where the old one was.
       */
      clockStyle: { "--auth-clock": `${-(performance.now() / 1000).toFixed(3)}s` },
      /** The core workflow of the platform, shown in the intro. Kept generic on purpose. */
      introSteps: [
        { key: "read", icon: "book" },
        { key: "annotate", icon: "highlighter" },
        { key: "write", icon: "pencil-square" },
        { key: "assess", icon: "clipboard-check" },
      ],
    };
  },
};
</script>

<style scoped>
.auth-page {
  --auth-glow-warm: color-mix(in srgb, #ffd966 55%, transparent);
  /* Share of the box taken by the form half (columns 1fr : 1.05fr) */
  --auth-form-share: 48.78%;
  position: relative;
  display: grid;
  grid-template-rows: 1fr auto;
  height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
  background:
    radial-gradient(ellipse at 50% 40%, color-mix(in srgb, var(--care-primary) 7%, transparent), transparent 60%),
    var(--bs-tertiary-bg);
}

html[data-bs-theme="dark"] .auth-page {
  --auth-glow-warm: rgba(var(--care-violet-rgb), .32);
}

/* The box top sits at the same place on every page, whatever the page puts above
   (mascot) or below (links) the box, so switching pages never moves it. The top
   offset centers the 540px box on tall screens and always leaves room for the
   above-card slot (124px tall, 14px of it behind the box). */
.auth-stage {
  position: relative;
  z-index: 1;
  display: grid;
  justify-items: center;
  align-content: start;
  padding: max(120px, calc(50vh - 300px)) 24px 24px;
}

.auth-shell {
  display: grid;
  gap: 14px;
  width: 100%;
  max-width: 980px;
}

.auth-card-wrap {
  position: relative;
  width: 100%;
}



/* Centered over the form half */
.auth-above-card {
  position: absolute;
  left: 0;
  right: calc(100% - var(--auth-form-share));
  bottom: calc(100% - 14px);
  z-index: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

/* The slot gets its own transition layer only when leaving its page ("back").
   Elements that exist only in the new state are layered above everything else,
   so on arrival the slot stays unnamed: it is part of the page snapshot, which
   lies under the card, and rises from behind it. When leaving, it is in the old
   state, where layers follow paint order, so it stays under the card as well. */
html[data-auth-direction="back"] .auth-above-card {
  view-transition-name: auth-mascot;
}

.auth-card {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
  width: 100%;
  min-height: 540px;
  overflow: hidden;
  border-radius: 22px; /* rounder than the scale on purpose: the welcome card */
  border-color: color-mix(in srgb, var(--care-primary) 12%, var(--bs-border-color));
  /* --care-primary follows the theme: blue glow in light, accent in dark */
  box-shadow:
    var(--care-shadow-3),
    0 40px 80px -40px color-mix(in srgb, var(--care-primary) 35%, transparent);
  view-transition-name: auth-card;
}

html[data-bs-theme="dark"] .auth-card {
  box-shadow:
    var(--care-shadow-3),
    0 40px 80px -40px color-mix(in srgb, var(--care-primary) 16%, transparent);
}

/* Named separately so the frame snapshot holds only background, border and shadow */
.auth-card-main > .card-header {
  view-transition-name: auth-card-header;
}

.auth-card-main > .card-body {
  view-transition-name: auth-card-body;
}

/* Header pinned to the top of the half, so the title and the header action stay in
   the same place on every page whatever the body height. .auth-card-foot takes the
   rest and puts its content at the very bottom. */
.auth-card-main {
  display: flex;
  flex-direction: column;
  padding: 52px 52px 22px;
}

.auth-card-foot {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 2px;
  padding-top: 24px;
  font-size: .75rem;
  text-align: center;
  color: var(--bs-secondary-color);
}

.auth-card .card-header {
  padding: 0 0 20px;
  background: transparent;
  border-bottom: 0;
}

.auth-card .card-title {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 600;
  letter-spacing: -.01em;
}

.auth-card .card-body {
  padding: 0;
}

.auth-card :deep([class*="col-md-"]) {
  flex: 0 0 100%;
  width: 100%;
  margin-left: 0;
  text-align: start;
}

.auth-card :deep(.col-form-label) {
  padding-bottom: .25rem;
  font-size: .875rem;
  font-weight: 500;
}

.auth-card :deep(.form-control) {
  padding: .6rem .85rem;
  border-radius: var(--care-radius-md);
}

.auth-card :deep(.btn-primary) {
  padding-block: .6rem;
  border-radius: var(--care-radius-md);
}

/* LogoSvg sets display inline, so the hide needs !important */
.auth-mobile-logo {
  display: none !important;
}

/* ---------- Right half: dot grid, two soft glows and a slow ring behind the logo ---------- */

.auth-card-brand {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-left: 1px solid var(--bs-border-color);
  background:
    linear-gradient(155deg, color-mix(in srgb, var(--care-primary) 7%, var(--bs-body-bg)), var(--bs-body-bg) 65%);
}

.auth-card-brand::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background-image: radial-gradient(circle, color-mix(in srgb, var(--care-primary) 45%, transparent) 1.1px, transparent 1.2px);
  background-size: 22px 22px;
  mask-image: radial-gradient(circle at 50% 50%, #000 0%, transparent 72%);
}

.auth-brand-glow {
  position: absolute;
  z-index: -1;
  border-radius: 50%;
  filter: blur(46px);
  animation: auth-glow-drift 14s ease-in-out infinite alternate;
  animation-delay: var(--auth-clock, 0s);
}

.auth-brand-glow--primary {
  width: 340px;
  height: 340px;
  top: calc(50% - 210px);
  left: calc(50% - 200px);
  background: color-mix(in srgb, var(--care-primary) 30%, transparent);
}

.auth-brand-glow--accent {
  width: 240px;
  height: 240px;
  top: calc(50% - 40px);
  left: calc(50% - 20px);
  background: var(--auth-glow-warm);
  animation-duration: 18s;
  animation-direction: alternate-reverse;
}

.auth-brand-ring {
  position: absolute;
  z-index: -1;
  top: calc(50% - 165px);
  left: calc(50% - 165px);
  width: 330px;
  height: 330px;
  border-radius: 50%;
  border: 1px dashed color-mix(in srgb, var(--care-primary) 28%, transparent);
  animation: auth-ring-spin 60s linear infinite;
  animation-delay: var(--auth-clock, 0s);
}

.auth-brand-ring::after {
  content: "";
  position: absolute;
  inset: -46px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--care-primary) 12%, transparent);
}

/* Small dot that travels on the dashed ring */
.auth-brand-ring::before {
  content: "";
  position: absolute;
  top: -5px;
  left: calc(50% - 5px);
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--care-primary);
  box-shadow: 0 0 12px 2px color-mix(in srgb, var(--care-primary) 55%, transparent);
}

.auth-brand-logo {
  position: relative;
  max-width: 70%;
  height: auto;
  filter: drop-shadow(0 18px 24px rgb(var(--care-shadow-rgb) / .16));
}

html[data-bs-theme="dark"] .auth-brand-logo {
  filter: drop-shadow(0 18px 28px rgb(0 0 0 / .5));
}

/* Own layer on page switches: the browser morphs it between the big centered
   logo (login) and the small one in the corner (register intro). */
.auth-brand-logo {
  view-transition-name: auth-brand-logo;
}

/* ---------- Intro mode (register): logo in the corner, platform intro below ---------- */

.auth-card-brand--intro {
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  padding: 40px 44px 36px;
}

/* Explicit size: the logo keeps the aspect of the big one, so the morph is a clean scale */
.auth-card-brand--intro .auth-brand-logo {
  align-self: flex-start;
  width: 81px;
  height: 38px;
  max-width: none;
  filter: drop-shadow(0 6px 10px rgb(var(--care-shadow-rgb) / .14));
}

/* The ring around the big logo widens into a ripple behind the intro... */
.auth-card-brand--intro .auth-brand-ring {
  animation:
    auth-ring-spin 60s linear infinite,
    auth-ring-expand 1.1s var(--care-ease) both;
  animation-delay: var(--auth-clock, 0s), 0s;
}

/* ...and closes around the logo again when going back to the login */
html[data-auth-direction="back"] .auth-card-brand:not(.auth-card-brand--intro) .auth-brand-ring {
  animation:
    auth-ring-spin 60s linear infinite,
    auth-ring-settle .55s var(--care-ease) both;
  animation-delay: var(--auth-clock, 0s), 0s;
}

.auth-intro {
  margin-block: auto;
  padding-top: 28px;
  view-transition-name: auth-brand-intro;
}

.auth-intro-title {
  margin: 0 0 10px;
  font-size: 1.85rem;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -.02em;
  /* Slow light sweep through the headline */
  background: linear-gradient(
    100deg,
    var(--bs-emphasis-color) 0%,
    var(--bs-emphasis-color) 30%,
    var(--care-primary) 50%,
    rgb(var(--care-violet-rgb)) 62%,
    var(--bs-emphasis-color) 80%
  );
  background-size: 260% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation:
    auth-intro-in .8s var(--care-ease) both,
    auth-title-shine 7s ease-in-out infinite alternate;
  animation-delay: .18s, var(--auth-clock, 0s);
}

.auth-intro-subtitle {
  margin: 0 0 28px;
  font-size: .98rem;
  color: var(--bs-secondary-color);
  animation: auth-intro-in .8s .28s var(--care-ease) both;
}

/* Workflow: four steps with icon, name and one line of text */
.auth-intro-steps {
  position: relative;
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.auth-intro-step {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  animation: auth-intro-in .7s var(--care-ease) both;
  animation-delay: calc(.4s + var(--i) * .1s);
}

.auth-intro-icon {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  border-radius: var(--care-radius-lg);
  border: 1px solid color-mix(in srgb, var(--care-primary) 22%, var(--bs-border-color));
  background: var(--bs-body-bg);
  color: var(--care-primary);
  box-shadow: 0 6px 14px -8px rgb(var(--care-shadow-rgb) / .35);
}

.auth-intro-text {
  display: grid;
  line-height: 1.3;
}

.auth-intro-text strong {
  font-size: .92rem;
  font-weight: 600;
  color: var(--bs-emphasis-color);
}

.auth-intro-text span {
  font-size: .8rem;
  color: var(--bs-secondary-color);
}

/* ---------- Desk objects outside the box ---------- */

.auth-scene {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  /* Own layer in the page switch: shown live, no cross-fade with the old screenshot */
  view-transition-name: auth-scene;
}

.auth-blob {
  position: absolute;
  background: color-mix(in srgb, var(--bs-primary) 34%, #fff);
  box-shadow: 0 16px 28px -10px rgba(var(--bs-primary-rgb), .35), 0 4px 10px -4px rgb(var(--care-shadow-rgb) / .16);
}

/* Speech bubble */
.auth-blob--bubble {
  top: 9vh;
  left: 5vw;
  width: 156px;
  height: 104px;
  border-radius: 32px;
  transform: rotate(-8deg);
}

.auth-blob--bubble::after {
  content: "";
  position: absolute;
  left: 28px;
  bottom: -11px;
  width: 28px;
  height: 28px;
  background: inherit;
  border-radius: 4px;
  transform: rotate(32deg);
}

/* Notebook */
.auth-blob--book {
  bottom: 14vh;
  left: 8vw;
  width: 86px;
  height: 112px;
  border-radius: 3px var(--care-radius-xl) var(--care-radius-xl) 3px;
  transform: rotate(-8deg);
}

.auth-blob--book::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 12px;
  border-radius: 3px 0 0 3px;
  background: color-mix(in srgb, var(--bs-primary) 62%, #fff);
}

.auth-blob--book::after {
  content: "";
  position: absolute;
  top: 22px;
  right: 14px;
  left: 24px;
  height: 7px;
  background: color-mix(in srgb, var(--bs-primary) 48%, #fff);
  box-shadow: 0 16px 0 color-mix(in srgb, var(--bs-primary) 48%, #fff), 0 32px 0 color-mix(in srgb, var(--bs-primary) 48%, #fff);
  border-radius: 2px;
}

/* Pen */
.auth-blob--pen {
  top: 10vh;
  right: 8vw;
  width: 16px;
  height: 118px;
  border-radius: var(--care-radius-md);
  transform: rotate(32deg);
  background: color-mix(in srgb, var(--bs-primary) 48%, #fff);
}

.auth-blob--pen::before {
  content: "";
  position: absolute;
  left: 50%;
  bottom: -14px;
  transform: translateX(-50%);
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 16px solid color-mix(in srgb, var(--bs-primary) 70%, #1e3a5f);
}

.auth-blob--pen::after {
  content: "";
  position: absolute;
  top: 18px;
  left: -1px;
  right: -1px;
  height: 7px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--bs-primary) 78%, #1e3a5f);
}

/* Sticky note with a folded corner and three lines */
.auth-blob--note {
  right: 6vw;
  bottom: 12vh;
  width: 104px;
  height: 104px;
  border-radius: var(--care-radius-sm) var(--care-radius-sm) 22px var(--care-radius-sm);
  transform: rotate(7deg);
  background: color-mix(in srgb, #ffd966 70%, #fff);
  box-shadow: 0 16px 28px -10px rgba(204, 160, 30, .4), 0 4px 10px -4px rgb(var(--care-shadow-rgb) / .16);
}

.auth-blob--note::before {
  content: "";
  position: absolute;
  top: 24px;
  left: 16px;
  right: 18px;
  height: 6px;
  border-radius: 2px;
  background: color-mix(in srgb, #c9a227 45%, #fff);
  box-shadow:
    0 16px 0 color-mix(in srgb, #c9a227 45%, #fff),
    0 32px 0 color-mix(in srgb, #c9a227 45%, #fff);
}

.auth-blob--note::after {
  content: "";
  position: absolute;
  right: 0;
  bottom: 0;
  width: 22px;
  height: 22px;
  border-radius: var(--care-radius-sm) 0 22px 0;
  background: color-mix(in srgb, #c9a227 40%, #fff);
}

/* Four-point sparkles */
.auth-spark {
  position: absolute;
  width: 18px;
  height: 18px;
  background: color-mix(in srgb, var(--care-primary) 55%, #fff);
  clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%);
  opacity: .7;
}

.auth-spark--1 {
  top: 30vh;
  left: 16vw;
}

.auth-spark--2 {
  top: 6vh;
  left: 52vw;
  width: 12px;
  height: 12px;
}

.auth-spark--3 {
  right: 17vw;
  bottom: 30vh;
  width: 14px;
  height: 14px;
}

/* ---------- Dark theme ---------- */

html[data-bs-theme="dark"] .auth-blob {
  background: color-mix(in srgb, var(--care-accent) 32%, var(--bs-body-bg));
  box-shadow: 0 18px 32px -12px rgb(0 0 0 / .7);
}

html[data-bs-theme="dark"] .auth-blob--book::before,
html[data-bs-theme="dark"] .auth-blob--book::after,
html[data-bs-theme="dark"] .auth-blob--pen,
html[data-bs-theme="dark"] .auth-blob--pen::after {
  background: color-mix(in srgb, var(--care-accent) 55%, var(--bs-body-bg));
}

html[data-bs-theme="dark"] .auth-blob--book::after {
  box-shadow:
    0 16px 0 color-mix(in srgb, var(--care-accent) 55%, var(--bs-body-bg)),
    0 32px 0 color-mix(in srgb, var(--care-accent) 55%, var(--bs-body-bg));
}

html[data-bs-theme="dark"] .auth-blob--pen::before {
  border-top-color: color-mix(in srgb, var(--care-accent) 70%, #3a3424);
}

html[data-bs-theme="dark"] .auth-blob--note {
  background: color-mix(in srgb, var(--care-accent) 45%, var(--bs-body-bg));
}

html[data-bs-theme="dark"] .auth-blob--note::before,
html[data-bs-theme="dark"] .auth-blob--note::after {
  background: color-mix(in srgb, var(--care-accent) 70%, var(--bs-body-bg));
}

html[data-bs-theme="dark"] .auth-blob--note::before {
  box-shadow:
    0 16px 0 color-mix(in srgb, var(--care-accent) 70%, var(--bs-body-bg)),
    0 32px 0 color-mix(in srgb, var(--care-accent) 70%, var(--bs-body-bg));
}

html[data-bs-theme="dark"] .auth-spark {
  background: color-mix(in srgb, var(--care-accent) 70%, transparent);
}

/* ---------- Footer ---------- */

.auth-page-footer {
  position: relative;
  z-index: 1;
  padding: 8px 16px 16px;
}

/* ---------- Motion ---------- */

@keyframes auth-glow-drift {
  to {
    translate: 30px 24px;
    scale: 1.12;
  }
}

@keyframes auth-ring-spin {
  to {
    rotate: 360deg;
  }
}

@keyframes auth-ring-expand {
  from {
    scale: 1;
    opacity: 1;
  }
  to {
    scale: 2.15;
    opacity: .45;
  }
}

@keyframes auth-ring-settle {
  from {
    scale: 2.15;
    opacity: .45;
  }
  to {
    scale: 1;
    opacity: 1;
  }
}

@keyframes auth-intro-in {
  from {
    opacity: 0;
    translate: 0 16px;
    filter: blur(6px);
  }
}

@keyframes auth-title-shine {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: 0 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-brand-glow,
  .auth-brand-ring,
  .auth-card-brand--intro .auth-brand-ring,
  .auth-intro-title,
  .auth-intro-subtitle,
  .auth-intro-step {
    animation: none !important;
  }

  .auth-card-brand--intro .auth-brand-ring {
    scale: 2.15;
    opacity: .45;
  }
}

/* ---------- Smaller screens ---------- */

/* Less room next to the box: objects move to the corners */
@media (max-width: 1240px) {
  .auth-blob--bubble,
  .auth-blob--pen {
    top: 2vh;
  }

  .auth-blob--book,
  .auth-blob--note {
    bottom: 2vh;
  }
}

/* Phones: no room for two halves, the form stays in the box with a small logo on top */
@media (max-width: 760px) {
  .auth-stage {
    padding: 120px 16px 16px;
  }

  .auth-shell {
    max-width: 440px;
  }

  .auth-card {
    grid-template-columns: 1fr;
    min-height: 0;
    border-radius: var(--care-radius-2xl);
  }

  .auth-card-main {
    padding: 28px 24px;
  }

  .auth-card .card-title {
    font-size: 1.3rem;
  }

  .auth-above-card {
    right: 0;
  }

  .auth-mobile-logo {
    display: block !important;
    margin: 0 auto 20px;
  }

  .auth-card-brand,
  .auth-scene {
    display: none;
  }
}
</style>

<style>
/* View Transition between auth pages (see auth/authTransition.js). Must be global,
   the pseudo-elements live on the document root.
   - auth-card: the empty frame. Only the new snapshot is shown, stretched to the
     animated size, so the shadow moves with the card instead of being clipped or
     cross-faded.
   - auth-card-header: same layout on both pages, short cross-fade of the title.
   - auth-card-body: old content leaves quickly, new content slides in after it. */
html {
  --auth-shift-out: -24px;
  --auth-shift-in: 24px;
}

html[data-auth-direction="back"] {
  --auth-shift-out: 24px;
  --auth-shift-in: -24px;
}

::view-transition-group(auth-card),
::view-transition-group(auth-card-header),
::view-transition-group(auth-card-body) {
  animation-duration: .55s;
  animation-timing-function: var(--care-ease);
}

::view-transition-old(auth-card) {
  display: none;
}

/* Decoration around the box: same place and phase on both pages, so only the live
   new state is shown and nothing moves or fades during the switch. */
::view-transition-old(auth-scene) {
  display: none;
}

::view-transition-new(auth-scene),
::view-transition-group(auth-scene) {
  animation: none;
}

/* auth-brand-logo: big centered logo (login) <-> small logo in the corner (register).
   Both snapshots have the same aspect, so the morph reads as one logo flying and scaling. */
::view-transition-group(auth-brand-logo) {
  animation-duration: .75s;
  animation-timing-function: cubic-bezier(.65, 0, .2, 1);
}

::view-transition-old(auth-brand-logo),
::view-transition-new(auth-brand-logo) {
  height: 100%;
  animation-duration: .75s;
}

/* auth-brand-intro: arriving, the intro is shown live and its parts come in one after
   another (animations in the scoped styles). Leaving, it fades out softly while the
   logo flies back to the center. */
::view-transition-new(auth-brand-intro) {
  animation: none;
}

::view-transition-old(auth-brand-intro) {
  animation: auth-intro-out .35s cubic-bezier(.4, 0, 1, 1) both;
}

@keyframes auth-intro-out {
  to {
    opacity: 0;
    transform: translateY(10px);
    filter: blur(6px);
  }
}

::view-transition-new(auth-card) {
  height: 100%;
  animation: none;
}

::view-transition-old(auth-card-header),
::view-transition-new(auth-card-header) {
  animation-duration: .3s;
}

::view-transition-old(auth-card-body) {
  animation: auth-content-out .2s cubic-bezier(.4, 0, 1, 1) both;
}

::view-transition-new(auth-card-body) {
  animation: auth-content-in .45s .15s var(--care-ease) both;
}

/* auth-mascot: the above-card slot (scientist on the register page) while leaving.
   It sits under the card layer and slides down behind the card. */
::view-transition-old(auth-mascot) {
  animation: auth-mascot-hide .45s cubic-bezier(.55, 0, .75, .2) both;
}

@keyframes auth-mascot-hide {
  0% {
    transform: translateY(0);
  }
  25% {
    transform: translateY(-6px);
  }
  80% {
    opacity: 1;
  }
  100% {
    transform: translateY(130px);
    opacity: 0;
  }
}

@keyframes auth-content-out {
  to {
    opacity: 0;
    transform: translateX(var(--auth-shift-out));
  }
}

@keyframes auth-content-in {
  from {
    opacity: 0;
    transform: translateX(var(--auth-shift-in));
  }
}
</style>
