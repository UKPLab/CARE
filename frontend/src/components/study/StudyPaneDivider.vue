<template>
  <!-- The line between the two documents of a split; dragging it shares the room differently -->
  <div
      v-if="layout"
      class="pane-divider"
      :class="isSplit('row') ? 'pane-divider-row' : 'pane-divider-column'"
      @pointerdown="startResize"
  />
</template>

<script>
/** Owns the drag lifecycle and document layout of the study's split panes. */
export default {
  name: 'StudyPaneDivider',
  props: {layout: {type: String, default: null}},
  data() { return {stopDragging: null}; },
  beforeUnmount() { this.stopDragging?.(); },
  methods: {
    isSplit(direction) { return !!this.layout?.startsWith(direction); },
startResize(event) {
      this.stopDragging?.();
      const container = document.querySelector(".study-container[data-split]");
      const sideBySide = this.isSplit("row");
      const top = parseFloat(getComputedStyle(container).getPropertyValue("--look-back-top"));
      const divider = event.target;
      const move = (moveEvent) => {
        const box = container.getBoundingClientRect();
        const width = container.clientWidth - parseFloat(getComputedStyle(container).paddingRight);
        const share = sideBySide
          ? (moveEvent.clientX - box.left) / width
          : (moveEvent.clientY - top) / (window.innerHeight - top);
        // Each document keeps at least a fifth of the room
        container.style.setProperty("--split", Math.min(Math.max(share, 0.2), 0.8));
      };
      const previousUserSelect = document.body.style.userSelect;
      const stop = () => {
        divider.removeEventListener("pointermove", move);
        document.body.style.userSelect = previousUserSelect;
        this.stopDragging = null;
      };
      this.stopDragging = stop;
      divider.setPointerCapture(event.pointerId);
      divider.addEventListener("pointermove", move);
      // Fires after pointerup and after pointercancel (a touch or pen gesture the browser takes over)
      divider.addEventListener("lostpointercapture", stop, {once: true});
      document.body.style.userSelect = "none";
    }
  },
};
</script>

<style>

/* Look-back colours follow CARE's buttons: the accent colour in dark mode, Bootstrap's primary in light mode.
   (The accent setting is put on the page in both modes, but only dark mode buttons use it.)
   Also used by LookBackPanel.vue. */
:root {
  --look-back-accent: var(--bs-primary);
  --look-back-on-accent: #fff;
  /* CARE's top bar, the workflow bar under it, and both together (where the documents start) */
  --top-bar-height: 52.5px;
  --strip-height: 52px;
  --look-back-top: 104.5px;
}

html[data-bs-theme="dark"] {
  --look-back-accent: var(--care-accent, var(--bs-primary));
  --look-back-on-accent: var(--care-on-accent, #fff);
}

/* Room for the open strip */
.study-container.pane-open {
  padding-top: var(--strip-height);
}

.study-container.pane-open .vh-100 {
  height: calc(100vh - var(--strip-height)) !important;
}

.study-container.pane-open .min-vh-100 {
  min-height: calc(100vh - var(--strip-height)) !important;
}

/* Name of the step in the bottom left corner of each shown document, clear of its toolbars.
   Its holder sits at the bottom of the pane and has no height, so nothing moves. */
.pane-label-holder {
  position: relative;
  height: 0;
  z-index: 5;
}

.pane-label-holder > .badge {
  position: absolute;
  bottom: 16px;
  left: 54px;
  background-color: var(--look-back-accent);
  color: var(--look-back-on-accent);
}

/* Split: the selected earlier step and the current step share the screen */
.study-container[data-split] {
  display: flex;
}

.study-container[data-split] > .study-pane {
  flex: 1 1 0;
  min-width: 0;
}

/* Side by side, the left document gets the share set by the divider, the right one the rest */
:is(.study-container[data-split="row"] > .study-pane:not(.study-pane ~ .study-pane),
  .study-container[data-split="row-reverse"] > .study-pane ~ .study-pane) {
  flex: 0 0 calc(var(--split, 0.5) * 100%);
}

/* The divider: 6px to grab, centred on the border between the documents */
.pane-divider {
  position: fixed;
  z-index: 11;
  touch-action: none;
}

.pane-divider:hover,
.pane-divider:active {
  background-color: var(--look-back-accent);
}

.pane-divider-row {
  top: var(--look-back-top);
  bottom: 0;
  left: calc(var(--split, 0.5) * (100vw - var(--sidebar-width, 0px)) - 3px);
  width: 6px;
  cursor: col-resize;
}

.pane-divider-column {
  top: calc(var(--look-back-top) + var(--split, 0.5) * (100vh - var(--look-back-top)) - 3px);
  left: 0;
  right: var(--sidebar-width, 0px);
  height: 6px;
  cursor: row-resize;
}

/* In a split, the sidebar leaves its pane and runs down the right edge, next to both panes,
   which share the rest of the width. Each document keeps at least 300px. */
.study-container[data-split] > .study-pane #sidebarContainer {
  position: fixed;
  top: var(--look-back-top);
  right: 0;
  bottom: 0;
  z-index: 10;
  margin-top: 0;
}

.study-container[data-split] {
  padding-right: var(--sidebar-width, 0px);
}

.study-container[data-split] .study-pane #sidebarContainer.sidebar-visible {
  min-width: 0 !important;
  max-width: calc(100% - 300px) !important;
}

.study-container[data-split^="row"] .study-pane #sidebarContainer.sidebar-visible {
  max-width: calc(100% - 600px) !important;
}

/* An earlier step on its own: the current step stays in place but hidden, except its sidebar,
   so the sidebar stays the current step's one */
.study-container[data-split="single"] > .study-pane ~ .study-pane {
  position: fixed;
  inset: 0;
}

/* With !important, because PDF pages set their own visibility */
.study-container[data-split="single"] > .study-pane ~ .study-pane,
.study-container[data-split="single"] > .study-pane ~ .study-pane :not(#sidebarContainer, #sidebarContainer *) {
  visibility: hidden !important;
}

.study-container[data-split="single"] > .study-pane ~ .study-pane #sidebarContainer {
  visibility: visible;
}

/* Flipped: the current step comes first, left or on top */
.study-container[data-split="row-reverse"] {
  flex-direction: row-reverse;
}

/* Stacked: earlier step on top, current step below */
.study-container[data-split="column"] {
  flex-direction: column;
}

.study-container[data-split="column-reverse"] {
  flex-direction: column-reverse;
}

.study-container[data-split^="column"] > .study-pane {
  flex: 0 0 auto;
}

.study-container[data-split^="column"] .vh-100,
.study-container[data-split^="column"] .min-vh-100 {
  height: calc((100vh - var(--look-back-top)) * var(--split, 0.5) + var(--top-bar-height)) !important;
  min-height: 0 !important;
}

/* The lower pane (the second one, or the first one when flipped) does not sit under the top bar,
   so it needs no room for it */
:is(.study-container[data-split="column"] > .study-pane ~ .study-pane,
  .study-container[data-split="column-reverse"] > .study-pane:not(.study-pane ~ .study-pane)) :is(.vh-100, .min-vh-100) {
  height: calc((100vh - var(--look-back-top)) * (1 - var(--split, 0.5))) !important;
}

:is(.study-container[data-split="column"] > .study-pane ~ .study-pane,
  .study-container[data-split="column-reverse"] > .study-pane:not(.study-pane ~ .study-pane)) .top-padding {
  padding-top: 0;
}

/* Stacked, a PDF page keeps half the screen width, so a full-width page does not fill the short pane */
.study-container[data-split^="column"] [id^="pdfContainer-"] {
  max-width: calc(50vw - 100px);
  margin: 0 auto;
}

</style>
