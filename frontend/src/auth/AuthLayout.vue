<template>
  <main class="auth-page" :class="{ 'auth-page--split': aside }">
    <div class="auth-stage">
      <div v-if="aside" class="auth-float" aria-hidden="true">
        <span class="auth-blob auth-blob--bubble"></span>
        <span class="auth-blob auth-blob--book"></span>
        <span class="auth-blob auth-blob--pen"></span>
      </div>
      <div class="auth-shell">
        <div class="auth-logo">
          <LogoSvg :height="56" />
        </div>
        <div class="auth-card-wrap" :class="{ 'auth-card-wrap--above': $slots['above-card'] }">
          <div v-if="$slots['above-card']" class="auth-above-card">
            <slot name="above-card" />
          </div>
          <div class="card auth-card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h1 class="card-title">
                {{ title }}
              </h1>
              <slot name="header-action" />
            </div>
            <div class="card-body">
              <slot />
            </div>
          </div>
        </div>
        <footer
          v-if="$slots.footer"
          class="auth-footer"
        >
          <slot name="footer" />
        </footer>
      </div>
    </div>
    <aside v-if="aside" class="auth-aside">
      <LogoSvg class="auth-mark" :width="260" :height="122" />
    </aside>
  </main>
</template>

<script>
/**
 * Shared frame for the signed-out pages: logo, one narrow card, and an optional footer.
 * Field rows written as label/col-md-* pairs are stacked so pages keep their markup.
 *
 * @slot default - Card body
 * @slot header-action - Link or button next to the title
 * @slot above-card - Decoration that sits on the top edge of the card, partly behind it
 * @slot footer - Content under the card
 *
 * @author Mohammad Sherif
 */
import LogoSvg from "@/basic/icon/LogoSvg.vue";

export default {
  name: "AuthLayout",
  components: { LogoSvg },
  props: {
    title: {
      type: String,
      required: true,
    },
    aside: {
      type: Boolean,
      default: false,
    },
  },
};
</script>

<style scoped>
.auth-page {
  height: 100vh;
  overflow-y: auto;
  display: grid;
  justify-items: center;
  align-content: start;
  padding: 8vh 16px 32px;
  background: var(--bs-tertiary-bg);
}

.auth-shell {
  width: 100%;
  max-width: 400px;
  display: grid;
  gap: 20px;
  justify-items: center;
}

.auth-card-wrap {
  position: relative;
  width: 100%;
}

/* Room for the above-card slot (124px tall, 14px of it behind the card) */
.auth-card-wrap--above {
  margin-top: 110px;
}

.auth-above-card {
  position: absolute;
  left: 0;
  right: 0;
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
  width: 100%;
  view-transition-name: auth-card;
}

/* Named separately so the frame snapshot holds only background, border and shadow */
.auth-card > .card-header {
  view-transition-name: auth-card-header;
}

.auth-card > .card-body {
  view-transition-name: auth-card-body;
}

.auth-card .card-title {
  font-size: 1.15rem;
}

.auth-card .card-body {
  padding: 4px 20px 20px;
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

.auth-footer {
  font-size: .75rem;
  text-align: center;
  color: var(--bs-secondary-color);
}

.auth-page--split {
  display: grid;
  grid-template-columns: minmax(520px, 560px) 1fr;
  align-content: start;
  align-items: start;
  justify-items: stretch;
  height: 100vh;
  padding: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.auth-page--split .auth-logo {
  display: none;
}

.auth-stage {
  width: 100%;
  display: grid;
  justify-items: center;
}

.auth-page--split .auth-stage {
  position: relative;
  align-content: center;
  min-height: 100vh;
  overflow: visible;
  border-right: 1px solid var(--bs-border-color);
  background: var(--bs-tertiary-bg);
}

.auth-page--split .auth-shell {
  position: relative;
  z-index: 1;
  align-self: center;
  align-content: center;
  max-width: 400px;
  height: auto;
  padding: 48px 28px;
  overflow: visible;
}

.auth-float {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.auth-blob {
  position: absolute;
  background: color-mix(in srgb, var(--bs-primary) 34%, #fff);
  box-shadow: 0 16px 28px -10px rgba(var(--bs-primary-rgb), .35), 0 4px 10px -4px rgb(var(--care-shadow-rgb) / .16);
}

.auth-blob--bubble {
  top: 36px;
  left: 18px;
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

.auth-blob--book {
  left: 28px;
  bottom: 40px;
  width: 86px;
  height: 112px;
  border-radius: 3px 14px 14px 3px;
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

.auth-blob--pen {
  top: 48px;
  right: 26px;
  width: 16px;
  height: 118px;
  border-radius: 8px;
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

.auth-page--split .auth-card {
  box-shadow: var(--care-shadow-3);
}

.auth-aside {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--care-primary) 14%, transparent), transparent 34%),
    var(--bs-body-bg);
}

.auth-aside::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, color-mix(in srgb, var(--care-primary) 45%, transparent) 1.1px, transparent 1.2px);
  background-size: 22px 22px;
  mask-image: radial-gradient(circle at 50% 46%, #000 0%, transparent 68%);
}

.auth-mark {
  position: relative;
  filter: drop-shadow(0 18px 24px rgb(var(--care-shadow-rgb) / .14));
}

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

html[data-bs-theme="dark"] .auth-mark {
  filter: drop-shadow(0 18px 28px rgb(0 0 0 / .45));
}

html[data-bs-theme="dark"] .auth-aside {
  background:
    radial-gradient(circle at 50% 46%, color-mix(in srgb, var(--care-accent) 18%, transparent), transparent 42%),
    var(--bs-body-bg);
}

html[data-bs-theme="dark"] .auth-aside::before {
  background-image: radial-gradient(circle, color-mix(in srgb, var(--care-accent) 55%, transparent) 1.1px, transparent 1.2px);
}


@media (max-width: 900px) {
  .auth-page--split {
    display: grid;
    grid-template-columns: 1fr;
    height: auto;
    padding: 8vh 16px 32px;
    overflow-y: auto;
  }

  .auth-page--split .auth-logo {
    display: inline-block;
  }

  .auth-page--split .auth-shell {
    height: auto;
    max-height: none;
    padding: 0;
  }

  .auth-page--split .auth-stage {
    height: auto;
    border-right: 0;
    overflow: visible;
  }

  .auth-float,
  .auth-aside {
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
  animation-timing-function: cubic-bezier(.22, 1, .36, 1);
}

::view-transition-old(auth-card) {
  display: none;
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
  animation: auth-content-in .45s .15s cubic-bezier(.22, 1, .36, 1) both;
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
