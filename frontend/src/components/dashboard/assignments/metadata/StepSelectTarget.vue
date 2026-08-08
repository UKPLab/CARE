<template>
  <div class="p-3">
    <div class="mb-3">
      <label class="form-label">{{ $t('assignments.metadata.target.typeLabel') }}</label>
      <select
        :value="targetType"
        class="form-select"
        @change="$emit('update:targetType', $event.target.value)"
      >
        <option value="assignment">{{ $t('common.assignment') }}</option>
      </select>
    </div>
    <div class="mb-3">
      <label class="form-label">{{ $t('common.assignment') }}</label>
      <select
        :value="selectedAssignmentId"
        class="form-select"
        @change="$emit('update:selectedAssignmentId', Number($event.target.value))"
      >
        <option
          v-for="assignmentOption in visibleAssignments"
          :key="assignmentOption.id"
          :value="assignmentOption.id"
        >
          {{ assignmentOption.name || $t('assignments.metadata.fallback.assignmentLabel', { id: assignmentOption.id }) }}
        </option>
      </select>
    </div>
    <div class="small text-muted">
      {{ $t('assignments.metadata.target.help') }}
    </div>
  </div>
</template>

<script>
/**
 * Second step of the metadata import flow: choose the assignment target.
 *
 * @author Linyin Huang
 */
export default {
  name: "StepSelectTarget",
  props: {
    targetType: {
      type: String,
      default: "assignment",
    },
    selectedAssignmentId: {
      type: Number,
      default: 0,
    },
    visibleAssignments: {
      type: Array,
      default: () => [],
    },
  },
  emits: ["update:targetType", "update:selectedAssignmentId"],
};
</script>
