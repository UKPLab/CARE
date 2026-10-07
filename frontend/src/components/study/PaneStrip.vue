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
      class="pane-strip bg-body-tertiary border-bottom d-flex align-items-center px-3 gap-1"
      role="tablist"
      :aria-label="$t('components.studyRoute.panes.label')"
  >
    <BasicButton
        v-for="tab in tabs"
        :key="tab.step.id"
        class="btn-sm"
        :class="modelValue === tab.step.id ? 'btn-primary' : 'btn-outline-secondary'"
        role="tab"
        :aria-selected="modelValue === tab.step.id"
        :title="tab.label"
        :props="{ key: 'studyPane.tab', stepId: tab.step.id }"
        @click="select(tab.step.id)"
    />
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
  subscribeTable: ["workflow_step"],
  props: {
    modelValue: {
      type: Number,
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
    orderedSteps: {
      type: Array,
      required: true,
    },
  },
  emits: ["update:modelValue"],
  computed: {
    isOpen() {
      return this.modelValue !== null;
    },
    // One tab per step in workflow order, named after the workflow step; the step number is added to names that occur twice
    tabs() {
      const tabs = [...this.earlierSteps, this.currentStep].map((step) => {
        const workflowStep = this.$store.getters["table/workflow_step/get"](step.workflowStepId);
        const number = this.orderedSteps.findIndex((s) => s.id === step.id) + 1;
        const name = workflowStep?.name || this.$t('components.studyRoute.panes.stepFallback', {number});
        return {step, name, number};
      });
      return tabs.map((tab) => {
        const isDuplicate = tabs.filter((other) => other.name === tab.name).length > 1;
        return {...tab, label: isDuplicate ? `${tab.name} ${tab.number}` : tab.name};
      });
    },
  },
  methods: {
    select(stepId) {
      this.$emit("update:modelValue", stepId);
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
</style>
