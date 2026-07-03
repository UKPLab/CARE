<template>
  <StepperModal
    ref="metadataImportStepper"
    :steps="steps"
    :validation="stepValid"
    submit-text="Close"
    @submit="$refs.metadataImportStepper.close()"
    @step-change="handleStepChange"
  >
    <template #title>
      <span>Import Metadata</span>
    </template>

    <template #step-1>
      <StepUpload
        v-model:rows="rows"
        v-model:source-fields="sourceFields"
        v-model:file-name="fileName"
        v-model:parse-error="parseError"
        @parsed="handleFileParsed"
        @parse-failed="resetMappings"
      />
    </template>

    <template #step-2>
      <StepSelectTarget
        v-model:target-type="targetType"
        v-model:selected-assignment-id="selectedAssignmentId"
        :visible-assignments="visibleAssignments"
      />
    </template>

    <template #step-3>
      <StepMapping
        ref="stepMapping"
        v-model:primary-key-mapping="primaryKeyMapping"
        v-model:metadata-mappings="metadataMappings"
        :source-fields="sourceFields"
        :mapping-validation-messages="mappingValidationMessages"
      />
    </template>

    <template #step-4>
      <StepPreview
        :target-type-label="targetTypeLabel"
        :assignment-label="assignmentLabel"
        :primary-key-mapping="primaryKeyMapping"
        :selected-mappings-count="selectedMappings.length"
        :preview="preview"
      />
    </template>

    <template #step-5>
      <StepResult
        :has-result="hasResult"
        :result="result"
        :import-issues="importIssues"
      />
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import StepUpload from "@/components/dashboard/assignments/metadata/StepUpload.vue";
import StepSelectTarget from "@/components/dashboard/assignments/metadata/StepSelectTarget.vue";
import StepMapping from "@/components/dashboard/assignments/metadata/StepMapping.vue";
import StepPreview from "@/components/dashboard/assignments/metadata/StepPreview.vue";
import StepResult from "@/components/dashboard/assignments/metadata/StepResult.vue";

/**
 * Multi-step modal for importing document metadata.
 *
 * @author Linyin Huang
 */
export default {
  name: "AssignmentMetadataModal",
  components: {
    StepperModal,
    StepUpload,
    StepSelectTarget,
    StepMapping,
    StepPreview,
    StepResult,
  },
  subscribeTable: ["assignment", "submission", "document", "user", "document_metadata"],
  data() {
    return {
      assignmentId: 0,
      selectedAssignmentId: 0,
      targetType: "assignment",
      rows: [],
      sourceFields: [],
      primaryKeyMapping: {
        sourceField: "",
        targetField: "extId",
      },
      metadataMappings: [],
      fileName: "",
      parseError: "",
      preview: {
        matchedRowCount: 0,
        unmatchedRowCount: 0,
        skippedRowCount: 0,
        documentCount: 0,
        metadataEntryCount: 0,
        overwrittenEntryCount: 0,
      },
      result: {},
      lastPreviewSignature: "",
      lastImportedSignature: "",
      isImportRunning: false,
      steps: [
        { title: "Upload" },
        { title: "Target" },
        { title: "Mapping" },
        { title: "Preview" },
        { title: "Result" },
      ],
    };
  },
  computed: {
    canViewAllAssignments() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.assignments.admin.viewAll");
    },
    canEditAssignments() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.assignments.edit");
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    visibleAssignments() {
      if (this.canViewAllAssignments) {
        return this.$store.getters["table/assignment/getAll"] || [];
      }

      return this.$store.getters["table/assignment/getFiltered"](
        (assignment) => assignment.userId === this.userId || this.canEditAssignments
      ) || [];
    },
    selectedAssignment() {
      return this.selectedAssignmentId ? this.$store.getters["table/assignment/get"](this.selectedAssignmentId) : null;
    },
    assignmentLabel() {
      return this.selectedAssignment?.name || `Assignment #${this.selectedAssignmentId}`;
    },
    targetTypeLabel() {
      return this.targetType === "assignment" ? "Assignment" : this.targetType;
    },
    normalizedMetadataMappings() {
      return this.metadataMappings.map((mapping) => ({
        id: mapping.id,
        sourceField: String(mapping.sourceField || "").trim(),
        metaKey: String(mapping.metaKey || "").trim(),
      }));
    },
    selectedMappings() {
      return this.normalizedMetadataMappings
        .filter((mapping) => mapping.sourceField && mapping.metaKey)
        .map(({ sourceField, metaKey }) => ({ sourceField, metaKey }));
    },
    hasDuplicateMetaKeys() {
      const metaKeys = this.normalizedMetadataMappings
        .map((mapping) => mapping.metaKey)
        .filter(Boolean);
      return new Set(metaKeys).size !== metaKeys.length;
    },
    hasDuplicatePrimaryKeyValues() {
      if (!this.primaryKeyMapping.sourceField) {
        return false;
      }

      const seen = new Set();
      for (const row of this.rows) {
        const value = row?.[this.primaryKeyMapping.sourceField];
        const normalized = value == null ? "" : String(value).trim().toLowerCase();
        if (!normalized) {
          return true;
        }
        if (seen.has(normalized)) {
          return true;
        }
        seen.add(normalized);
      }
      return false;
    },
    mappingValidationMessages() {
      const messages = [];

      if (!this.primaryKeyMapping.sourceField) {
        messages.push("Select the uploaded source key used for matching.");
      }

      if (!this.primaryKeyMapping.targetField) {
        messages.push("Select which CARE field the primary key should match against.");
      }

      if (this.metadataMappings.length === 0) {
        messages.push("Add at least one metadata mapping.");
      }

      if (this.normalizedMetadataMappings.some((mapping) => !mapping.sourceField)) {
        messages.push("Every metadata mapping needs a source key.");
      }

      if (this.normalizedMetadataMappings.some((mapping) => !mapping.metaKey)) {
        messages.push("Every metadata mapping needs a target metaKey.");
      }

      if (this.hasDuplicateMetaKeys) {
        messages.push("Target metaKeys must be unique.");
      }

      if (this.hasDuplicatePrimaryKeyValues) {
        messages.push("Primary key values must be present and unique across all uploaded rows.");
      }

      return messages;
    },
    importPayload() {
      return {
        targetType: this.targetType,
        assignmentId: this.selectedAssignmentId,
        primaryKeyMapping: {
          sourceField: this.primaryKeyMapping.sourceField,
          targetField: this.primaryKeyMapping.targetField,
        },
        mappings: this.selectedMappings,
        rows: this.rows,
        fileName: this.fileName || null,
      };
    },
    payloadSignature() {
      return JSON.stringify(this.importPayload);
    },
    hasResult() {
      return Object.keys(this.result || {}).length > 0;
    },
    importIssues() {
      const issues = [];
      for (const entry of this.result.unmatched || []) {
        issues.push(`Unmatched value "${entry.primaryKeyValue ?? "unknown"}": ${entry.message}`);
      }
      for (const entry of this.result.skipped || []) {
        const prefix = entry.submissionId ? `Submission ${entry.submissionId}` : "Row";
        issues.push(`${prefix}: ${entry.message}`);
      }
      for (const entry of this.result.overwritten || []) {
        const prefix = entry.submissionId ? `Submission ${entry.submissionId}` : "Import";
        issues.push(`${prefix}: ${entry.message}`);
      }
      return issues;
    },
    stepValid() {
      return [
        this.rows.length > 0 && this.sourceFields.length > 0,
        this.targetType === "assignment" && Boolean(this.selectedAssignmentId),
        this.mappingValidationMessages.length === 0,
        true,
        true,
      ];
    },
  },
  watch: {
    payloadSignature() {
      this.resetPreview();
      this.result = {};
      this.lastPreviewSignature = "";
      this.lastImportedSignature = "";
    },
  },
  methods: {
    open(assignmentId) {
      this.assignmentId = assignmentId;
      this.resetModal();
      this.selectedAssignmentId = assignmentId;
      this.$refs.metadataImportStepper.open();
    },
    resetModal() {
      this.selectedAssignmentId = this.assignmentId;
      this.targetType = "assignment";
      this.rows = [];
      this.sourceFields = [];
      this.fileName = "";
      this.parseError = "";
      this.result = {};
      this.lastPreviewSignature = "";
      this.lastImportedSignature = "";
      this.isImportRunning = false;
      this.resetPreview();
      this.resetMappings();
    },
    resetMappings() {
      this.primaryKeyMapping = {
        sourceField: "",
        targetField: "extId",
      };
      this.metadataMappings = [];
      this.$refs.stepMapping?.resetMappings();
    },
    resetPreview() {
      this.preview = {
        matchedRowCount: 0,
        unmatchedRowCount: 0,
        skippedRowCount: 0,
        documentCount: 0,
        metadataEntryCount: 0,
        overwrittenEntryCount: 0,
      };
    },
    handleFileParsed() {
      this.$refs.stepMapping.initializeMappings(this.sourceFields);
    },
    handleStepChange(step) {
      switch (step) {
        case 3:
          this.loadPreview();
          break;
        case 4:
          this.executeImport();
          break;
      }
    },
    loadPreview() {
      if (this.lastPreviewSignature === this.payloadSignature) {
        return;
      }

      this.$refs.metadataImportStepper.setWaiting(true);
      this.$socket.emit("documentPreviewMetadataImport", this.importPayload, (res) => {
        this.$refs.metadataImportStepper.setWaiting(false);
        if (res.success) {
          this.preview = res.data || {};
          this.lastPreviewSignature = this.payloadSignature;
        } else {
          this.$refs.metadataImportStepper.currentStep = 2;
          this.eventBus.emit("toast", {
            title: "Failed to preview metadata import",
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
    executeImport() {
      // setWaiting controls UI state only; this guard prevents duplicate socket emits
      // while the same request is already in-flight.
      // lastImportedSignature avoids re-importing the same unchanged payload when users
      // revisit the Result step after a successful run.
      if (this.isImportRunning || this.lastImportedSignature === this.payloadSignature) {
        return;
      }

      this.isImportRunning = true;
      this.$refs.metadataImportStepper.setWaiting(true);
      this.$socket.emit("documentImportMetadata", this.importPayload, (res) => {
        this.isImportRunning = false;
        this.$refs.metadataImportStepper.setWaiting(false);
        if (res.success) {
          this.result = res.data || {};
          this.lastImportedSignature = this.payloadSignature;
          this.eventBus.emit("toast", {
            title: "Metadata imported",
            message: `Wrote ${res.data?.metadataEntryCount || 0} metadata entries.`,
            variant: "success",
          });
        } else {
          this.$refs.metadataImportStepper.currentStep = 3;
          this.eventBus.emit("toast", {
            title: "Metadata import failed",
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
  },
};
</script>
