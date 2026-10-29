<template>
  <!-- Marks the current step's own sidebar tab, next to the read-only tabs of earlier steps -->
  <div class="small text-secondary d-flex align-items-center gap-1 px-2 pt-2">
    <LoadIcon icon-name="pencil-fill" :size="12"/>
    {{ $t('components.studyRoute.panes.currentStep') }}
  </div>
</template>

<script>
/**
 * Note at the top of the current step's own sidebar tab, used by Study.vue for Annotator and Editor steps
 *
 * @author Ilyas Mohammed
 */
import LoadIcon from "@/basic/Icon.vue";

export default {
  name: "CurrentStepNote",
  components: {LoadIcon},
}
</script>