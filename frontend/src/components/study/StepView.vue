<template>
  <!-- Annotator or Editor of one study step, with the same sidebar tabs for both -->
  <component
      :is="step.stepType === 1 ? 'Annotator' : 'Editor'"
      v-bind="{...paneProps, ...typeProps}"
      :document-id="step.documentId"
      :study-step-id="step.id"
      @update:data="$emit('update:data', {type: step.stepType === 1 ? 'annotator' : 'editor', data: $event})"
  >
    <template v-if="step.configuration?.settings?.configurationId" #additionalSidebars>
      <SidebarTemplate icon="list-check" :number="stepNumber" :title="$t('assessment.title')">
        <template #content>
          <CurrentStepNote v-if="stepNumber"/>
          <Assessment
              :config="step.configuration"
              :study-step-id="step.id"
              @assessment-ready-changed="$emit('assessment-ready-changed', $event)"
              @assessment-advance-past-end="$emit('assessment-advance-past-end', $event)"
              @update:data="$emit('update:data', {type: 'assessment', data: $event})"
          />
        </template>
      </SidebarTemplate>
    </template>
    <template v-for="tab in tabs" :key="tab.key" #[tab.key]>
      <LookBackTab v-bind="tab" :label="labels[tab.step.id]"/>
    </template>
    <template v-for="(slot, slotName) in $slots" :key="slotName" #[slotName]>
      <slot :name="slotName"/>
    </template>
  </component>
</template>

<script>
/**
 * The Annotator or Editor of one Annotator (1) or Editor (2) study step in Study.vue, with its sidebar tabs: the
 * step's own assessment, if it has one, and the read-only tabs of earlier steps. Both step types share this, so the
 * tabs are written once.
 *
 * @author Ilyas Mohammed
 */
import Annotator from "@/components/annotator/Annotator.vue";
import Editor from "@/components/editor/Editor.vue";
import SidebarTemplate from "@/basic/sidebar/SidebarTemplate.vue";
import Assessment from "@/components/study/Assessment.vue";
import CurrentStepNote from "@/components/study/CurrentStepNote.vue";
import LookBackTab from "@/components/study/LookBackTab.vue";

export default {
  name: "StepView",
  components: {Annotator, Editor, SidebarTemplate, Assessment, CurrentStepNote, LookBackTab},
  inject: {
    orderedStudySteps: {
      type: Array,
      required: true,
    },
  },
  props: {
    step: {
      type: Object,
      required: true,
    },
    // The props of the step's Annotator or Editor from the look-back (see helpers/lookBack.js, paneProps)
    paneProps: {
      type: Object,
      required: true,
    },
    // The step's look-back sidebar tabs (see helpers/lookBack.js, buildTabsByStep)
    tabs: {
      type: Array,
      required: true,
    },
    // Step id mapped to the step's name, as on the workflow bar
    labels: {
      type: Object,
      required: true,
    },
  },
  emits: ["update:data", "assessment-ready-changed", "assessment-advance-past-end", "error"],
  computed: {
    // A step that can look back numbers its own sidebar tabs too, so they read like the workflow bar
    stepNumber() {
      return this.tabs.length ? this.orderedStudySteps.indexOf(this.step) + 1 : null;
    },
    // The props only one of the two takes
    typeProps() {
      return this.step.stepType === 1
        ? {stepNumber: this.stepNumber, onError: (event) => this.$emit("error", event)}
        : {withoutHistory: true};
    },
  },
}
</script>
