<template>
  <!-- One wrapper, so the whole tab is logged as on screen or not -->
  <div v-observe-visibility="{callback: visibilityChanged, throttle: 300}">
    <!-- Which earlier step this tab shows, in the style of the label on that step's document -->
    <div class="look-back-header d-flex align-items-center gap-2 px-2 pt-2">
      <span class="badge">{{ label }}</span>
      <span class="small text-secondary d-flex align-items-center gap-1">
        <LoadIcon icon-name="lock-fill" :size="12"/>
        {{ $t('common.readOnly') }}
      </span>
    </div>
    <AnnotationSidebar v-if="type === 'annotations'"/>
    <Assessment
        v-else-if="type === 'assessment'"
        :config="step.configuration"
        :study-step-id="step.id"
    />
  </div>
</template>

<script>
/**
 * Sidebar tab that shows an earlier study step's sidebar content read-only in the current step
 *
 * @author Ilyas Mohammed
 */
import AnnotationSidebar from "@/components/annotator/sidebar/Sidebar.vue";
import Assessment from "@/components/study/Assessment.vue";
import LoadIcon from "@/basic/Icon.vue";
import {computed} from "vue";
import {ObserveVisibility} from "vue3-observe-visibility";

export default {
  name: "LookBackPanel",
  components: {AnnotationSidebar, Assessment, LoadIcon},
  directives: {ObserveVisibility},
  provide() {
    // The content takes its document and step from here, so it shows the earlier step and cannot be edited
    return {
      documentId: computed(() => this.step.documentId),
      studyStepId: computed(() => this.step.id),
      readOnly: true,
      showAllDocumentAnnotations: computed(() => this.step.configuration?.settings?.showAllDocumentAnnotations ?? false),
    };
  },
  inject: {
    acceptStats: {
      default: () => false
    },
    studySessionId: {
      type: Number,
      required: false,
      default: null,
    },
    currentStudyStep: {
      type: Object,
      required: false,
      default: null,
    },
  },
  props: {
    step: {
      type: Object,
      required: true,
    },
    // "annotations" or "assessment"
    type: {
      type: String,
      required: true,
    },
    // The step's name, as on the workflow bar and on its document
    label: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      isVisible: false,
    };
  },
  methods: {
    // Logged like pdfPageVisibilityChange: the time between visible and hidden is how long the tab was on screen
    visibilityChanged(isVisible) {
      if (isVisible === this.isVisible) {
        return;
      }
      this.isVisible = isVisible;
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "lookBackPanelVisibilityChange",
          data: {
            documentId: this.step.documentId,
            stepId: this.step.id,
            type: this.type,
            isVisible: isVisible,
            studySessionId: this.studySessionId,
            studyStepId: this.currentStudyStep?.id,
          }
        });
      }
    },
  },
}
</script>

<style scoped>
.look-back-header .badge {
  background-color: var(--care-accent, var(--bs-primary));
  color: var(--care-on-accent, #fff);
}
</style>
