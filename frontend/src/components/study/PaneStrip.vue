<template>
  <Teleport to="#topBarNavItems">
    <li class="nav-item">
      <TopBarButton
          class="btn rounded-circle"
          :title="isOpen ? $t('components.studyRoute.panes.hideStrip') : $t('components.studyRoute.panes.showStrip')"
          :props="{ key: 'studyPane.strip', open: !isOpen }"
          :aria-expanded="isOpen"
          @click="select(isOpen ? null : currentStep.id)"
      >
        <LoadIcon icon-name="window-split" :size="18"/>
      </TopBarButton>
    </li>
  </Teleport>
  <div
      v-if="isOpen"
      class="pane-strip bg-body-tertiary border-bottom d-flex align-items-center px-3"
  >
    <span class="fw-semibold text-nowrap me-3">{{ $t('components.studyRoute.panes.workflow') }}</span>
    <ol
        class="d-flex align-items-center gap-2 list-unstyled mb-0 p-1 overflow-auto"
        :aria-label="$t('components.studyRoute.panes.label')"
    >
      <li
          v-for="(step, index) in steps"
          :key="step.id"
          class="d-flex align-items-center gap-3"
      >
        <LoadIcon v-if="index > 0" icon-name="arrow-right" :size="14" class="text-body-tertiary"/>
        <!-- The current step and the steps it can look back at can be opened -->
        <BasicButton
            v-if="canOpen(step)"
             class="btn-sm text-nowrap d-inline-flex align-items-center gap-1"
            :class="isOnScreen(step) ? 'btn-primary' : 'btn-outline-secondary'"
            :aria-current="step.id === currentStep.id ? 'step' : null"
            :title="labels[step.id]"
            :props="{ key: 'studyPane.tab', stepId: step.id }"
            @click="select(step.id)"
        >
          <span class="fw-semibold">{{ index + 1 }}</span>
          <LoadIcon :icon-name="stepIcons[step.stepType] || 'question-circle'" :size="14"/>
          <LoadIcon v-if="index < currentIndex" icon-name="check-circle-fill" :size="12"/>
        </BasicButton>
        <!-- Other steps cannot be opened: finished ones have a tick, later ones are greyed out.
             Each step shows its number and icon; its name is the tooltip and the label on its document. -->
        <span
            v-else
            class="btn btn-sm text-nowrap d-inline-flex align-items-center gap-1 border"
            :class="{ 'text-body-tertiary': index > currentIndex }"
            :title="labels[step.id]"
        >
          <span class="fw-semibold">{{ index + 1 }}</span>
          <LoadIcon :icon-name="stepIcons[step.stepType] || 'question-circle'" :size="14"/>
          <LoadIcon v-if="index < currentIndex" icon-name="check-circle-fill" :size="12"/>
        </span>
      </li>
    </ol>
    <div v-if="earlierSteps.length > 0" class="ms-auto d-flex gap-1">
      <!-- Swaps the two documents of a split -->
      <BasicButton
          v-if="layout"
          class="btn-sm btn-outline-secondary"
          :title="$t('components.studyRoute.panes.flip')"
          :props="{ key: 'studyPane.flip', from: layout }"
          @click="flip"
      >
        <LoadIcon :icon-name="isSplit('row') ? 'arrow-left-right' : 'arrow-down-up'" :size="16"/>
      </BasicButton>
      <div
          v-for="direction in directions"
          :key="direction"
          class="dropdown"
      >
        <BasicButton
            class="btn-sm btn-outline-secondary"
            :class="{ 'dropdown-toggle': hasChoice }"
            :aria-pressed="isSplit(direction)"
            :data-bs-toggle="hasChoice ? 'dropdown' : null"
            :aria-expanded="hasChoice ? 'false' : null"
            :title="splitTitle(direction)"
            :props="{ key: 'studyPane.split', direction, from: layout }"
            @click="onSplitClick(direction)"
        >
          <LoadIcon :icon-name="splitIcons[direction]" :size="16"/>
        </BasicButton>
        <ul v-if="hasChoice" class="dropdown-menu dropdown-menu-end">
          <li v-for="step in earlierSteps" :key="step.id">
            <BasicButton
                class="dropdown-item"
                :aria-current="isSplit(direction) && modelValue === step.id ? 'true' : null"
                :title="labels[step.id]"
                :props="{ key: 'studyPane.split', direction, from: layout, stepId: step.id }"
                @click="split(direction, step.id)"
            />
          </li>
        </ul>
      </div>
    </div>
  </div>
  <!-- The line between the two documents of a split; dragging it shares the room differently -->
  <div
      v-if="layout"
      class="pane-divider"
      :class="isSplit('row') ? 'pane-divider-row' : 'pane-divider-column'"
      @pointerdown="startResize"
  />
</template>

<script>
/**
 * Bar of all workflow steps, from which earlier steps can be looked at read-only
 *
 * @author Ilyas Mohammed
 */
import BasicButton from "@/basic/Button.vue";
import TopBarButton from "@/basic/navigation/TopBarButton.vue";
import LoadIcon from "@/basic/Icon.vue";

export default {
  name: "StudyPaneStrip",
  components: {BasicButton, TopBarButton, LoadIcon},
  props: {
    modelValue: {
      type: Number,
      required: false,
      default: null,
    },
    layout: {
      type: String,
      required: false,
      default: null,
    },
    // All steps of the study, in workflow order
    steps: {
      type: Array,
      required: true,
    },
    currentStep: {
      type: Object,
      required: true,
    },
    earlierSteps: {
      type: Array,
      required: true,
    },
    labels: {
      type: Object,
      required: true,
    },
  },
  emits: ["update:modelValue", "update:layout"],
  data() {
    return {
      // Split layouts, named after the CSS flex-direction they use; a flipped split adds "-reverse"
      directions: ["row", "column"],
      splitIcons: {row: "layout-split", column: "view-stacked"},
      // Icon of each step type (1 Annotator, 2 Editor, 3 Modal), as in the workflow editor
      stepIcons: {1: "pencil-square", 2: "file-text", 3: "window"},
    };
  },
  computed: {
    isOpen() {
      return this.modelValue !== null;
    },
    // With more than one earlier step, the split buttons open a menu to pick the step
    hasChoice() {
      return this.earlierSteps.length > 1;
    },
    currentIndex() {
      return this.steps.findIndex((step) => step.id === this.currentStep.id);
    },
  },
  watch: {
    layout: "watchSidebar",
    modelValue: "watchSidebar",
  },
  beforeUnmount() {
    this.sidebarObserver?.disconnect();
  },
  methods: {
    // While an earlier step is shown, the panes leave room for the current step's sidebar on the right,
    // as wide as it is dragged
    watchSidebar() {
      this.sidebarObserver?.disconnect();
      this.$nextTick(() => {
        const container = document.querySelector(".study-container[data-split]");
        const sidebar = container?.querySelector(".study-pane #sidebarContainer");
        if (!sidebar) {
          return;
        }
        this.sidebarObserver = new ResizeObserver(() => {
          container.style.setProperty("--sidebar-width", `${sidebar.offsetWidth}px`);
        });
        this.sidebarObserver.observe(sidebar);
      });
    },
    // Show a single step; this also leaves a split
    select(stepId) {
      this.$emit("update:modelValue", stepId);
      this.$emit("update:layout", null);
    },
    canOpen(step) {
      return step.id === this.currentStep.id || this.earlierSteps.some((earlier) => earlier.id === step.id);
    },
    isOnScreen(step) {
      return this.modelValue === step.id || (this.layout !== null && step.id === this.currentStep.id);
    },
    isSplit(direction) {
      return !!this.layout?.startsWith(direction);
    },
    splitTitle(direction) {
      return this.$t(`components.studyRoute.panes.split.${direction}`);
    },
    onSplitClick(direction) {
      // With a menu, the menu entries do the work
      if (!this.hasChoice) {
        this.split(direction, this.earlierSteps[0].id);
      }
    },
    // Show an earlier step left of the current one; picking the same split again closes it
    split(direction, stepId) {
      if (this.modelValue === stepId && this.isSplit(direction)) {
        this.select(this.currentStep.id);
        return;
      }
      this.$emit("update:modelValue", stepId);
      // Switching between side by side and stacked keeps a flipped split flipped
      this.$emit("update:layout", this.layout?.endsWith("-reverse") ? `${direction}-reverse` : direction);
    },
    // The share of the first document (left, or on top) is kept as --split on the study container
    startResize(event) {
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
      const stop = () => {
        divider.removeEventListener("pointermove", move);
        document.body.style.userSelect = "";
      };
      divider.setPointerCapture(event.pointerId);
      divider.addEventListener("pointermove", move);
      divider.addEventListener("pointerup", stop, {once: true});
      document.body.style.userSelect = "none";
    },
    flip() {
      const flipped = this.layout.endsWith("-reverse");
      this.$emit("update:layout", flipped ? this.layout.replace("-reverse", "") : `${this.layout}-reverse`);
    },
  },
}
</script>

<style scoped>
.pane-strip {
  position: fixed;
  top: var(--top-bar-height);
  left: 0;
  right: 0;
  height: var(--strip-height);
  padding-top: 4px;
  z-index: 1020;
}

/* An active split button is marked by aria-pressed, not by a class: changing its class would break its menu.
   It and the chosen menu entry get the colours of an active tab (btn-primary). */
.pane-strip .btn[aria-pressed="true"],
.pane-strip .dropdown-item[aria-current="true"] {
  background-color: var(--look-back-accent);
  border-color: var(--look-back-accent);
  color: var(--look-back-on-accent);
}

/* The step the student is on keeps a ring, also while an earlier step is shown.
   The list has a little padding so its scrolling does not cut the ring off. */
.pane-strip .btn[aria-current="step"] {
  outline: 2px solid var(--look-back-accent);
  outline-offset: 2px;
}

/* A step that cannot be opened does not look clickable */
.pane-strip span.btn {
  cursor: default;
}

/* A long workflow scrolls sideways inside the bar instead of pushing the split buttons away */
.pane-strip > ol {
  min-width: 0;
}

/* A button whose menu is open is not lit up, so only the active split is */
.pane-strip .btn.show:not([aria-pressed="true"]) {
  background-color: transparent;
  border-color: var(--bs-btn-border-color);
  color: var(--bs-btn-color);
}
</style>

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
