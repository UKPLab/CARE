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
  <StudyPaneDivider :layout="layout"/>
</template>

<script>
/**
 * Bar of all workflow steps, from which earlier steps can be looked at read-only
 *
 * @author Ilyas Mohammed
 */
import StudyPaneDivider from "./StudyPaneDivider.vue";
import BasicButton from "@/basic/Button.vue";
import TopBarButton from "@/basic/navigation/TopBarButton.vue";
import LoadIcon from "@/basic/Icon.vue";

export default {
  name: "StudyPaneStrip",
  components: {StudyPaneDivider, BasicButton, TopBarButton, LoadIcon},
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
