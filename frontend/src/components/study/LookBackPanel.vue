<template>
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

export default {
  name: "LookBackPanel",
  components: {AnnotationSidebar, Assessment, LoadIcon},
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
}
</script>

<style scoped>
.look-back-header .badge {
  background-color: var(--care-accent, var(--bs-primary));
  color: var(--care-on-accent, #fff);
}
</style>
