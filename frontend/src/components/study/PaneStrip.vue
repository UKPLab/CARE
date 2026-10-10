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
        <LoadIcon icon-name="bar-chart-steps" :size="18"/>
      </TopBarButton>
    </li>
  </Teleport>
  <div
      v-if="isOpen"
      class="pane-strip bg-body-tertiary border-bottom d-flex align-items-center px-3"
  >
    <ol
        class="d-flex align-items-center gap-1 list-unstyled mb-0 overflow-auto"
        :aria-label="$t('components.studyRoute.panes.label')"
    >
      <li
          v-for="(step, index) in steps"
          :key="step.id"
          class="d-flex align-items-center gap-2"
      >
        <LoadIcon v-if="index > 0" icon-name="arrow-right" :size="14" class="text-body-tertiary"/>
        <!-- The current step and the steps it can look back at can be opened -->
        <BasicButton
            v-if="canOpen(step)"
            class="btn-sm text-nowrap d-inline-flex align-items-center gap-1"
            :class="isOnScreen(step) ? 'btn-primary' : 'btn-outline-secondary'"
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
          <li v-for="tab in earlierTabs" :key="tab.step.id">
            <BasicButton
                class="dropdown-item"
                :aria-current="isSplit(direction) && modelValue === tab.step.id ? 'true' : null"
                :title="tab.label"
                :props="{ key: 'studyPane.split', direction, from: layout, stepId: tab.step.id }"
                @click="split(direction, tab.step.id)"
            />
          </li>
        </ul>
      </div>
    </div>
  </div>
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
      // Split layouts, named after the CSS flex-direction they use
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
    earlierTabs() {
      return this.earlierSteps.map((step) => ({step, label: this.labels[step.id]}));
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
      return this.layout === direction;
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
      if (this.modelValue === stepId && this.layout === direction) {
        this.select(this.currentStep.id);
        return;
      }
      this.$emit("update:modelValue", stepId);
      this.$emit("update:layout", direction);
    },
  },
}
</script>

<style scoped>
.pane-strip {
  position: fixed;
  top: 52.5px;
  left: 0;
  right: 0;
  height: 44px;
  padding-top: 4px;
  z-index: 1020;
}

/* An active split button is marked by aria-pressed, not by a class: changing its class would break its menu.
   It and the chosen menu entry get the colours of an active tab (btn-primary). */
.pane-strip .btn[aria-pressed="true"],
.pane-strip .dropdown-item[aria-current="true"] {
  background-color: var(--care-accent, var(--bs-primary));
  border-color: var(--care-accent, var(--bs-primary));
  color: var(--care-on-accent, #fff);
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
/* Room for the open strip */
.study-container.pane-open {
  padding-top: 44px;
}

.study-container.pane-open .vh-100 {
  height: calc(100vh - 44px) !important;
}

.study-container.pane-open .min-vh-100 {
  min-height: calc(100vh - 44px) !important;
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
  background-color: var(--care-accent, var(--bs-primary));
  color: var(--care-on-accent, #fff);
}

/* Split: the selected earlier step and the current step share the screen */
.study-container[data-split] {
  display: flex;
}

.study-container[data-split] > .study-pane {
  flex: 1 1 0;
  min-width: 0;
}

/* In a split, the sidebar leaves its pane and runs down the right edge, next to both panes,
   which share the rest of the width. Each document keeps at least 300px. */
.study-container[data-split] > .study-pane #sidebarContainer {
  position: fixed;
  top: 96.5px;
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

.study-container[data-split="row"] .study-pane #sidebarContainer.sidebar-visible {
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

/* Stacked: earlier step on top, current step below. 52.5px is the top bar, 44px the strip. */
.study-container[data-split="column"] {
  flex-direction: column;
}

.study-container[data-split="column"] > .study-pane {
  flex: 0 0 auto;
}

.study-container[data-split="column"] .vh-100,
.study-container[data-split="column"] .min-vh-100 {
  height: calc((100vh - 96.5px) / 2 + 52.5px) !important;
  min-height: 0 !important;
}

/* The lower pane does not sit under the top bar, so it needs no room for it */
.study-container[data-split="column"] > .study-pane ~ .study-pane .vh-100,
.study-container[data-split="column"] > .study-pane ~ .study-pane .min-vh-100 {
  height: calc((100vh - 96.5px) / 2) !important;
}

.study-container[data-split="column"] > .study-pane ~ .study-pane .top-padding {
  padding-top: 0;
}

/* Stacked, a PDF page keeps half the screen width, so a full-width page does not fill the short pane */
.study-container[data-split="column"] [id^="pdfContainer-"] {
  max-width: calc(50vw - 100px);
  margin: 0 auto;
}
</style>
