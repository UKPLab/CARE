<template>
  <StepperModal
    ref="metadataImportStepper"
    :steps="steps"
    :validation="stepValid"
    :submit-text="$t('common.close')"
    @submit="$refs.metadataImportStepper.close()"
    @step-change="handleStepChange"
  >
    <template #title>
      <span>{{ $t('assignments.metadata.modal.title') }}</span>
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
        v-model:primary-key-mapping="primaryKeyMapping"
        v-model:metadata-mappings="metadataMappings"
        :source-fields="sourceFields"
        :mapping-validation-messages="mappingValidationMessages"
        @add-mapping="addMappingRow"
        @remove-mapping="removeMappingRow"
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
import { resolveApiMessage } from "@/assets/utils";

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
  subscribeTable: ["assignment", "submission", "document", "user"],
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
      nextMappingId: 1,
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
    };
  },
  computed: {
    steps() {
      return [
        { title: this.$t("assignments.metadata.steps.upload") },
        { title: this.$t("assignments.metadata.steps.target") },
        { title: this.$t("assignments.metadata.steps.mapping") },
        { title: this.$t("assignments.metadata.steps.preview") },
        { title: this.$t("assignments.metadata.steps.result") },
      ];
    },
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
      return this.selectedAssignment?.name
        || this.$t("assignments.metadata.fallback.assignmentLabel", { id: this.selectedAssignmentId });
    },
    targetTypeLabel() {
      return this.targetType === "assignment"
        ? this.$t("common.assignment")
        : this.targetType;
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
        messages.push(this.$t("assignments.metadata.validation.selectSourceKey"));
      }

      if (!this.primaryKeyMapping.targetField) {
        messages.push(this.$t("assignments.metadata.validation.selectTargetField"));
      }

      if (this.metadataMappings.length === 0) {
        messages.push(this.$t("assignments.metadata.validation.addMapping"));
      }

      if (this.normalizedMetadataMappings.some((mapping) => !mapping.sourceField)) {
        messages.push(this.$t("assignments.metadata.validation.mappingNeedsSource"));
      }

      if (this.normalizedMetadataMappings.some((mapping) => !mapping.metaKey)) {
        messages.push(this.$t("assignments.metadata.validation.mappingNeedsMetaKey"));
      }

      if (this.hasDuplicateMetaKeys) {
        messages.push(this.$t("assignments.metadata.validation.uniqueMetaKeys"));
      }

      if (this.hasDuplicatePrimaryKeyValues) {
        messages.push(this.$t("assignments.metadata.validation.uniquePrimaryKeys"));
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
        const detail = resolveApiMessage(entry);
        const value = entry.primaryKeyValue ?? this.$t("assignments.metadata.issues.unknownValue");
        issues.push(this.$t("assignments.metadata.issues.unmatched", { value, detail }));
      }
      for (const entry of this.result.skipped || []) {
        const detail = resolveApiMessage(entry);
        if (entry.submissionId) {
          issues.push(this.$t("assignments.metadata.issues.submission", { id: entry.submissionId, detail }));
        } else {
          issues.push(this.$t("assignments.metadata.issues.row", { detail }));
        }
      }
      for (const entry of this.result.overwritten || []) {
        const detail = resolveApiMessage(entry);
        if (entry.submissionId) {
          issues.push(this.$t("assignments.metadata.issues.submission", { id: entry.submissionId, detail }));
        } else {
          issues.push(this.$t("assignments.metadata.issues.import", { detail }));
        }
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
      this.nextMappingId = 1;
      this.primaryKeyMapping = {
        sourceField: "",
        targetField: "extId",
      };
      this.metadataMappings = [];
    },
    createMappingRow(defaults = {}) {
      return {
        id: this.nextMappingId++,
        sourceField: defaults.sourceField || "",
        metaKey: defaults.metaKey || "",
      };
    },
    initializeMappings(sourceFields) {
      const preferredPrimaryField = sourceFields.includes("id")
        ? "id"
        : (sourceFields.includes("email") ? "email" : "");

      this.primaryKeyMapping = {
        sourceField: preferredPrimaryField,
        targetField: preferredPrimaryField === "email" ? "email" : "extId",
      };
      this.metadataMappings = [
        this.createMappingRow(),
      ];
    },
    addMappingRow() {
      this.metadataMappings.push(this.createMappingRow());
    },
    removeMappingRow(index) {
      if (this.metadataMappings.length === 1) {
        return;
      }
      this.metadataMappings.splice(index, 1);
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
      this.initializeMappings(this.sourceFields);
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
            title: this.$t("assignments.metadata.toasts.previewFailed"),
            message: resolveApiMessage(res),
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
            title: this.$t("assignments.metadata.toasts.importSuccess.title"),
            message: this.$t("assignments.metadata.toasts.importSuccess.message", {
              count: res.data?.metadataEntryCount || 0,
            }),
            variant: "success",
          });
        } else {
          this.$refs.metadataImportStepper.currentStep = 3;
          this.eventBus.emit("toast", {
            title: this.$t("assignments.metadata.toasts.importFailed"),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      });
    },
  },
};
</script>
