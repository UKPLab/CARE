<template>
  <AnnotationSidebar v-if="type === 'annotations'"/>
  <Assessment
      v-else-if="type === 'assessment'"
      :config="step.configuration"
      :study-step-id="step.id"
  />
</template>

<script>
/**
 * Sidebar tab that shows an earlier study step's sidebar content read-only in the current step
 *
 * @author Ilyas Mohammed
 */
import AnnotationSidebar from "@/components/annotator/sidebar/Sidebar.vue";
import Assessment from "@/components/study/Assessment.vue";
import {computed} from "vue";

export default {
  name: "LookBackPanel",
  components: {AnnotationSidebar, Assessment},
  provide() {
    // The content takes its document and step from here, so it shows the earlier step and cannot be edited
    return {
      documentId: computed(() => this.step.documentId),
      studyStepId: computed(() => this.step.id),
      readOnly: true,
      showAllDocumentAnnotations: computed(() => this.step.configuration?.settings?.showAllDocumentAnnotations ?? false),
    };
  },
  props: {
    step: {
      type: Object,
      required: true,
    },
    // "annotations", "assessment" or "empty"
    type: {
      type: String,
      required: true,
    },
  },
}
</script>
