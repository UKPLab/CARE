<template>
  <div class="p-3">
    <div class="alert alert-warning mb-3">
      This import affects only the selected assignment. Existing metadata entries with the same `metaKey` will be overwritten.
    </div>
    <div class="card">
      <div class="card-body bg-light">
        <div><strong>Target type:</strong> {{ targetTypeLabel }}</div>
        <div><strong>Assignment:</strong> {{ assignmentLabel }}</div>
        <div>
          <strong>Primary key mapping:</strong>
          {{ primaryKeyMapping.sourceField || "-" }} -> {{ primaryKeyMapping.targetField || "-" }}
        </div>
        <div><strong>Mapped metadata fields:</strong> {{ selectedMappingsCount }}</div>
        <div><strong>Will match rows:</strong> {{ preview.matchedRowCount }}</div>
        <div><strong>Rows without submission match:</strong> {{ preview.unmatchedRowCount }}</div>
        <div><strong>Will skip matched rows without documents:</strong> {{ preview.skippedRowCount }}</div>
        <div><strong>Documents affected:</strong> {{ preview.documentCount }}</div>
        <div><strong>Will write metadata entries:</strong> {{ preview.metadataEntryCount }}</div>
        <div><strong>Will overwrite existing metadata entries:</strong> {{ preview.overwrittenEntryCount }}</div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * Fourth step of the metadata import flow: review the import preview summary.
 *
 * @author Linyin Huang
 */
export default {
  name: "StepPreview",
  props: {
    targetTypeLabel: {
      type: String,
      required: true,
    },
    assignmentLabel: {
      type: String,
      required: true,
    },
    primaryKeyMapping: {
      type: Object,
      required: true,
    },
    selectedMappingsCount: {
      type: Number,
      default: 0,
    },
    preview: {
      type: Object,
      required: true,
    },
  },
};
</script>
