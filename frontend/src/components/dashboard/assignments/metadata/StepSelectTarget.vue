<template>
  <div class="p-3">
    <div class="mb-3">
      <label class="form-label">Target type</label>
      <select
        :value="targetType"
        class="form-select"
        @change="$emit('update:targetType', $event.target.value)"
      >
        <option value="assignment">Assignment</option>
      </select>
    </div>
    <div class="mb-3">
      <label class="form-label">Assignment</label>
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
          {{ assignmentOption.name || `Assignment #${assignmentOption.id}` }}
        </option>
      </select>
    </div>
    <div class="small text-muted">
      Metadata will be written to documents belonging to submissions in the selected assignment.
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
