<template>
  <div class="p-3">
    <div class="alert alert-warning mb-3">
      {{ $t('assignments.metadata.preview.warning') }}
    </div>
    <div class="card">
      <div class="card-body bg-body-tertiary">
        <div><strong>{{ $t('assignments.metadata.preview.targetType') }}</strong> {{ targetTypeLabel }}</div>
        <div><strong>{{ $t('assignments.metadata.preview.assignment') }}</strong> {{ assignmentLabel }}</div>
        <div>
          <strong>{{ $t('assignments.metadata.preview.primaryKeyMapping') }}</strong>
          {{ primaryKeyMapping.sourceField || "-" }} -> {{ primaryKeyMapping.targetField || "-" }}
        </div>
        <div><strong>{{ $t('assignments.metadata.preview.mappedFields') }}</strong> {{ selectedMappingsCount }}</div>
        <div><strong>{{ $t('assignments.metadata.preview.willMatchRows') }}</strong> {{ preview.matchedRowCount }}</div>
        <div><strong>{{ $t('assignments.metadata.preview.rowsWithoutMatch') }}</strong> {{ preview.unmatchedRowCount }}</div>
        <div><strong>{{ $t('assignments.metadata.preview.willSkipWithoutDocuments') }}</strong> {{ preview.skippedRowCount }}</div>
        <div><strong>{{ $t('assignments.metadata.preview.documentsAffected') }}</strong> {{ preview.documentCount }}</div>
        <div><strong>{{ $t('assignments.metadata.preview.willWriteEntries') }}</strong> {{ preview.metadataEntryCount }}</div>
        <div><strong>{{ $t('assignments.metadata.preview.willOverwriteEntries') }}</strong> {{ preview.overwrittenEntryCount }}</div>
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
