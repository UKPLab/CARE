<template>
  <Teleport to="#topBarNavItems">
    <li v-if="earlierSteps.length > 0" class="nav-item">
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
    <div
        class="d-flex gap-1"
        role="tablist"
        :aria-label="$t('components.studyRoute.panes.label')"
    >
      <BasicButton
          v-for="tab in tabs"
          :key="tab.step.id"
          class="btn-sm"
          :class="isOnScreen(tab.step) ? 'btn-primary' : 'btn-outline-secondary'"
          role="tab"
          :aria-selected="isOnScreen(tab.step)"
          :title="tab.label"
          :props="{ key: 'studyPane.tab', stepId: tab.step.id }"
          @click="select(tab.step.id)"
      />
    </div>
    <div class="ms-auto d-flex gap-1">
      <div
          v-for="direction in directions"
          :key="direction"
          class="dropdown"
      >
        <BasicButton
            class="btn-sm"
            :class="[isSplit(direction) ? 'btn-primary' : 'btn-outline-secondary', { 'dropdown-toggle': hasChoice }]"
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
 * Tab strip to look back at earlier study steps
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
    // One tab per step in workflow order, named as the workflow names the step
    tabs() {
      return [...this.earlierSteps, this.currentStep].map((step) => ({step, label: this.labels[step.id]}));
    },
    earlierTabs() {
      return this.tabs.filter((tab) => tab.step.id !== this.currentStep.id);
    },
  },
  methods: {
    // Show a single step; this also leaves a split
    select(stepId) {
      this.$emit("update:modelValue", stepId);
      this.$emit("update:layout", null);
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

/* Split: the selected earlier step and the current step share the screen */
.study-container[data-split] {
  display: flex;
}

.study-container[data-split] > .study-pane {
  flex: 1 1 0;
  min-width: 0;
}

/* Side by side, an open sidebar (400px by default) takes its room from both panes, not only from its own */
.study-container[data-split="row"] > .study-pane:has(.sidebar-wrapper.sidebar-visible) {
  flex-basis: 400px;
}

/* In a split, PDF pages shrink to the width of their pane */
.study-container[data-split] .canvasWrapper {
  max-width: 100%;
  height: auto !important;
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

.study-container[data-split="column"] > .study-pane ~ .study-pane .sidebar-container {
  margin-top: 0;
}

/* Stacked: the sidebar leaves the lower pane and runs down the right edge, next to both panes */
.study-container[data-split="column"] > .study-pane #sidebarContainer {
  position: fixed;
  top: 96.5px;
  right: 0;
  bottom: 0;
  z-index: 10;
}

.study-container[data-split="column"]:has(> .study-pane .sidebar-wrapper.sidebar-visible) {
  padding-right: 400px;
}

/* Stacked: a PDF page gets half of the width, like side by side, so more of it fits into the pane */
.study-container[data-split="column"] [id^="pdfContainer-"] {
  max-width: 50%;
  margin: 0 auto;
}
</style>
