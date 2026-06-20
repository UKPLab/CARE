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
      <div class="p-3">
        <p class="text-muted mb-3">
          Upload a metadata file in `.json` or `.csv` format. CARE will extract the available fields so you can define the target and mappings in the next steps.
        </p>
        <input
          ref="metadataFileInput"
          type="file"
          class="form-control"
          accept=".json,.csv,application/json,text/csv"
          @change="handleFileChange"
        >
        <div v-if="fileName" class="mt-2 small">
          Loaded file: <strong>{{ fileName }}</strong>
        </div>
        <div v-if="parseError" class="mt-2 text-danger small">
          {{ parseError }}
        </div>
        <div v-if="rows.length > 0" class="mt-2 small text-success">
          Parsed {{ rows.length }} rows with {{ sourceFields.length }} fields.
        </div>
      </div>
    </template>

    <template #step-2>
      <div class="p-3">
        <div class="mb-3">
          <label class="form-label">Target type</label>
          <select v-model="targetType" class="form-select">
            <option value="assignment">Assignment</option>
          </select>
        </div>
        <div class="mb-3">
          <label class="form-label">Assignment</label>
          <select v-model.number="selectedAssignmentId" class="form-select">
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

    <template #step-3>
      <div class="p-3">
        <div class="mb-4">
          <h6>Primary Key Mapping</h6>
          <div class="row g-3 align-items-end">
            <div class="col-md-6">
              <label class="form-label">Source key</label>
              <select v-model="primaryKeyMapping.sourceField" class="form-select">
                <option disabled value="">Select a field</option>
                <option
                  v-for="field in sourceFields"
                  :key="`primary-source-${field}`"
                  :value="field"
                >
                  {{ field }}
                </option>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label">Match against</label>
              <select v-model="primaryKeyMapping.targetField" class="form-select">
                <option value="extId">extId</option>
                <option value="email">email</option>
              </select>
            </div>
          </div>
          <div class="form-text">
            This mapping controls how CARE matches uploaded rows to submission owners in the selected assignment.
          </div>
        </div>

        <h6 class="mb-3">Metadata Mappings</h6>

        <div v-if="mappingValidationMessages.length > 0" class="alert alert-warning">
          <div
            v-for="(message, index) in mappingValidationMessages"
            :key="`mapping-warning-${index}`"
          >
            {{ message }}
          </div>
        </div>

        <div class="mapping-panel">
          <div class="mapping-panel-header">
            <div class="mapping-panel-title-row">
              <div class="mapping-col-source">Source key</div>
              <div class="mapping-col-target">Target metaKey</div>
              <div class="mapping-col-action">Action</div>
            </div>
            <button
              class="btn btn-outline-primary btn-sm"
              type="button"
              @click="addMappingRow"
            >
              Add Mapping
            </button>
          </div>

          <div
            v-if="metadataMappings.length === 0"
            class="text-muted small"
          >
            No metadata mappings configured yet.
          </div>

          <div
            v-for="(mapping, index) in metadataMappings"
            :key="mapping.id"
            class="mapping-item"
          >
            <div class="mapping-col-source">
              <select
                v-model="mapping.sourceField"
                class="form-select"
              >
                <option disabled value="">Select a field</option>
                <option
                  v-for="field in sourceFields"
                  :key="`mapping-source-${mapping.id}-${field}`"
                  :value="field"
                >
                  {{ field }}
                </option>
              </select>
            </div>
            <div class="mapping-arrow">→</div>
            <div class="mapping-col-target">
              <input
                v-model="mapping.metaKey"
                class="form-control"
                list="metadata-key-presets"
                placeholder="topic"
                type="text"
              >
            </div>
            <div class="mapping-col-action">
              <button
                class="btn btn-outline-danger btn-sm"
                type="button"
                :disabled="metadataMappings.length === 1"
                @click="removeMappingRow(index)"
              >
                Remove
              </button>
            </div>
          </div>
        </div>

        <!-- TODO: Metadata presets, not sure what options are common here, to be discussed -->
        <datalist id="metadata-key-presets">
          <option value="topic"></option>
          <option value="category"></option>
          <option value="tag"></option>
        </datalist>
      </div>
    </template>

    <template #step-4>
      <div class="p-3">
        <div class="alert alert-warning mb-3">
          This import affects only the selected assignment. Existing metadata entries with the same `metaKey` will be overwritten.
        </div>
        <div class="card">
          <div class="card-body bg-light">
            <div><strong>Target type:</strong> {{ targetTypeLabel }}</div>
            <div><strong>Assignment:</strong> {{ selectedAssignment?.name || `Assignment #${selectedAssignmentId}` }}</div>
            <div>
              <strong>Primary key mapping:</strong>
              {{ primaryKeyMapping.sourceField || "-" }} -> {{ primaryKeyMapping.targetField || "-" }}
            </div>
            <div><strong>Mapped metadata fields:</strong> {{ selectedMappings.length }}</div>
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

    <template #step-5>
      <div class="p-3">
        <div v-if="hasResult">
          <div class="mb-2">
            <span v-if="result.metadataEntryCount > 0">
              Wrote <strong>{{ result.metadataEntryCount }}</strong> metadata entries across <strong>{{ result.documentCount }}</strong> documents
              (<strong>{{ result.matchedRowCount || 0 }}</strong> matched rows).
            </span>
            <span v-else>
              No metadata entries were written.
            </span>
          </div>
          <div v-if="importIssues.length > 0" class="warning-container">
            <div class="mb-1">Issues:</div>
            <ul>
              <li
                v-for="(issue, index) in importIssues"
                :key="`import-issue-${index}`"
              >
                {{ issue }}
              </li>
            </ul>
          </div>
        </div>
        <div v-else class="text-muted">
          Import has not been run yet.
        </div>
      </div>
    </template>
  </StepperModal>
</template>

<script>
import Papa from "papaparse";
import StepperModal from "@/basic/modal/StepperModal.vue";

/**
 * Multi-step modal for importing document metadata.
 *
 * @author Linyin Huang
 */
export default {
  name: "AssignmentMetadataModal",
  components: { StepperModal },
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
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    visibleAssignments() {
      if (this.canViewAllAssignments) {
        return this.$store.getters["table/assignment/getAll"] || [];
      }

      return this.$store.getters["table/assignment/getFiltered"](
        (assignment) => assignment.userId === this.userId || Boolean(assignment.public)
      ) || [];
    },
    selectedAssignment() {
      return this.selectedAssignmentId ? this.$store.getters["table/assignment/get"](this.selectedAssignmentId) : null;
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
      this.primaryKeyMapping = {
        sourceField: "",
        targetField: "extId",
      };
      this.metadataMappings = [];
      this.nextMappingId = 1;
      this.fileName = "";
      this.parseError = "";
      this.result = {};
      this.lastPreviewSignature = "";
      this.lastImportedSignature = "";
      this.isImportRunning = false;
      this.resetPreview();
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
    /**
     * Recursively flatten nested JSON structures into a single array of row objects.
     *
     * This allows the metadata import to accept exports where rows may be wrapped
     * in one or more array layers, such as `[[{ id: "1" }, { id: "2" }]]`.
     * Non-object primitive values are ignored.
     *
     * @param {*} payload - Parsed JSON content that may contain nested arrays and objects.
     * @returns {Object[]} A flat array containing only row-like objects.
     *
     * @example
     * // Input: [[{ id: "1" }, { id: "2" }]]
     * // Output: [{ id: "1" }, { id: "2" }]
     * const flatRows = this.flattenRows(payload);
     */
    flattenRows(payload) {
      // If the payload is an array, recurse into its elements
      if (Array.isArray(payload)) {
        // flatMap executes the recursion and flattens the returned arrays by one level
        return payload.flatMap((entry) => this.flattenRows(entry));
      }

      // If the payload is a valid object (and not null), wrap it in an array to be flattened by the caller
      if (payload && typeof payload === "object") {
        return [payload];
      }

      // Return an empty array for primitive types or null/undefined to exclude them from the final result
      return [];
    },
    createMappingRow(defaults = {}) {
      return {
        id: this.nextMappingId++,
        sourceField: defaults.sourceField || "",
        metaKey: defaults.metaKey || "",
      };
    },
    initializeMappings() {
      const preferredPrimaryField = this.sourceFields.includes("id") ? "id" : (this.sourceFields.includes("email") ? "email" : "");

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
    async parseJson(file) {
      const text = await file.text();
      const payload = JSON.parse(text);
      const rows = this.flattenRows(payload).filter((row) => row && typeof row === "object");
      const fields = [...rows.reduce((acc, row) => {
        Object.keys(row).forEach((key) => acc.add(key));
        return acc;
      }, new Set())];
      return { rows, fields };
    },
    parseCsv(file) {
      return new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: ({ data, meta }) => {
            resolve({
              rows: data.filter((row) => row && typeof row === "object"),
              fields: meta.fields || [],
            });
          },
          error: reject,
        });
      });
    },
    async handleFileChange(event) {
      const file = event.target.files?.[0];
      if (!file) return;

      this.fileName = file.name;
      this.parseError = "";

      try {
        let parsed = { rows: [], fields: [] };
        if (file.name.toLowerCase().endsWith(".json")) {
          parsed = await this.parseJson(file);
        } else if (file.name.toLowerCase().endsWith(".csv")) {
          parsed = await this.parseCsv(file);
        } else {
          throw new Error("Unsupported file format. Please upload .json or .csv.");
        }

        const fields = parsed.fields
          .map((field) => String(field || "").trim())
          .filter(Boolean);
        if (parsed.rows.length === 0) {
          throw new Error("The uploaded file did not contain usable rows.");
        }
        if (fields.length === 0) {
          throw new Error("The uploaded file did not contain any usable fields.");
        }

        this.rows = parsed.rows;
        this.sourceFields = fields;
        this.initializeMappings();
      } catch (error) {
        this.rows = [];
        this.sourceFields = [];
        this.primaryKeyMapping = {
          sourceField: "",
          targetField: "extId",
        };
        this.metadataMappings = [];
        this.parseError = error.message || "Failed to parse metadata file.";
      }
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

<style scoped>
.mapping-panel {
  border: 1px dashed #b9b9b9;
  border-radius: 0.5rem;
  padding: 0.9rem;
  background: #fafafa;
}

.mapping-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.85rem;
}

.mapping-panel-title-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 0.75rem;
  flex: 1;
  font-size: 0.9rem;
  font-weight: 600;
  color: #555;
  padding: 0 0.125rem;
}

.mapping-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
}

.mapping-item + .mapping-item {
  margin-top: 0.75rem;
}

.mapping-col-source,
.mapping-col-target {
  min-width: 0;
}

.mapping-col-action {
  display: flex;
  justify-content: flex-end;
}

.mapping-arrow {
  color: #6c757d;
  font-size: 1rem;
  line-height: 1;
  padding-top: 0.1rem;
}

@media (max-width: 767.98px) {
  .mapping-panel-header {
    flex-direction: column;
    align-items: stretch;
  }

  .mapping-panel-title-row {
    display: none;
  }

  .mapping-item {
    grid-template-columns: 1fr;
  }

  .mapping-col-action {
    justify-content: flex-start;
  }

  .mapping-arrow {
    display: none;
  }
}

.warning-container {
  margin: 0.5rem auto;
  color: #8a6d3b;

  ul {
    margin-bottom: 0.25rem;
  }
}
</style>
