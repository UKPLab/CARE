<template>
    <div
        ref="criterionHeader"
        class="d-flex justify-content-between align-items-center py-2"
        style="cursor: pointer"
        role="button"
        tabindex="0"
        :aria-expanded="isExpanded"
        :aria-controls="panelId"
        @click="$emit('toggle')"
        @keydown.enter.exact.prevent="$emit('toggle')"
        @keydown.space.exact.prevent="$emit('toggle')"
    >
      <div class="d-flex align-items-center">
        <span class="criterion-icon me-2">
          <LoadIcon
              :icon-name="isExpanded ? 'chevron-up' : 'chevron-down'"
              :size="16"
          />
        </span>
        <span class="criterion-name">
          {{ criterion.name || $t('assessment.criteria.unnamedCriterion') }}
        </span>
      </div>

      <div class="d-flex align-items-center">
        <!-- Info icon -->
        <span
            v-if="criterion.description || criterion.scoring"
            class="info-icon me-2"
            style="cursor: help;"
            @click.stop="$emit('toggle-info-panel-pin', criterion)"
            @mouseenter="$emit('open-info-panel', criterion)"
            @mouseleave="$emit('close-info-panel')"
        >
          <LoadIcon icon-name="info-circle" :size="14"/>
        </span>

        <!-- Score badge -->
        <span
            class="badge"
            :class="(readOnly || isSaved) ? 'bg-success' : 'bg-secondary'"
        >
          {{ displayScore }} P
        </span>
      </div>
    </div>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";
export default {
  name: 'AssessmentCriterionHeader',
  components: {LoadIcon},
  props: {
    criterion: {type: Object, required: true},
    isExpanded: {type: Boolean, default: false},
    panelId: {type: String, required: true},
    displayScore: {type: Number, default: 0},
    readOnly: {type: Boolean, default: false},
    isSaved: {type: Boolean, default: false},
  },
  emits: ['toggle', 'toggle-info-panel-pin', 'open-info-panel', 'close-info-panel'],
  methods: {focus() { this.$refs.criterionHeader?.focus(); }},
};
</script>

<style scoped>
.criterion-icon {
  color: var(--bs-secondary-color);
  transition: transform 0.2s ease;
}

.criterion-name {
  font-weight: 400;
  color: var(--bs-body-color, #333);
}

.info-icon {
  color: var(--bs-secondary-color);
  transition: color 0.2s ease;
}

.info-icon:hover {
  color: var(--care-primary);
}
</style>
