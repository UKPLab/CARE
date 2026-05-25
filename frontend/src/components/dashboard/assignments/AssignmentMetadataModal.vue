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
          Upload a metadata file in `.json` or `.csv` format. CARE will extract the available fields so you can map them in the next steps.
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
        <div class="mb-3">
          <label class="form-label">Primary key field</label>
          <select v-model="primaryKeyField" class="form-select">
            <option disabled value="">Select a field</option>
            <option
              v-for="field in sourceFields"
              :key="`primary-${field}`"
              :value="field"
            >
              {{ field }}
            </option>
          </select>
          <div class="form-text">
            CARE will match this field against assignment submission owners by `extId` first and `email` second.
          </div>
        </div>

        <div v-if="mappingValidationMessages.length > 0" class="alert alert-warning">
          <div
            v-for="(message, index) in mappingValidationMessages"
            :key="`mapping-warning-${index}`"
          >
            {{ message }}
          </div>
        </div>

        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead>
              <tr>
                <th>Source Field</th>
                <th class="text-center">Import</th>
                <th>Target metaKey</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="field in sourceFields"
                :key="`field-${field}`"
              >
                <td>
                  <strong>{{ field }}</strong>
                  <div
                    v-if="field === primaryKeyField"
                    class="small text-muted"
                  >
                    Used for matching only
                  </div>
                </td>
                <td class="text-center">
                  <input
                    v-model="fieldMappings[field].include"
                    class="form-check-input"
                    type="checkbox"
                    :disabled="field === primaryKeyField"
                    @change="handleMappingToggle(field)"
                  >
                </td>
                <td>
                  <input
                    v-model="fieldMappings[field].metaKey"
                    class="form-control"
                    type="text"
                    :disabled="!fieldMappings[field].include || field === primaryKeyField"
                    placeholder="Enter metaKey"
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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
            <div><strong>Primary key:</strong> {{ primaryKeyField || "-" }}</div>
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
              Wrote <strong>{{ result.metadataEntryCount }}</strong> metadata entries across <strong>{{ result.documentCount }}</strong> documents.
            </span>
            <span v-else>
              No metadata entries were written.
            </span>
          </div>
          <div class="small mb-2">
            Matched rows: <strong>{{ result.matchedRowCount || 0 }}</strong>
          </div>
          <div v-if="(result.overwritten || []).length > 0" class="warning-container">
            Overwritten metadata:
            <ul
              v-for="(entry, index) in result.overwritten"
              :key="`overwritten-${index}`"
            >
              <li>
                Submission <strong>{{ entry.submissionId }}</strong>:
                {{ entry.message }}
              </li>
            </ul>
          </div>
          <div v-if="(result.unmatched || []).length > 0" class="warning-container">
            Unmatched rows:
            <ul
              v-for="(entry, index) in result.unmatched"
              :key="`unmatched-${index}`"
            >
              <li>
                Value <strong>{{ entry.primaryKeyValue ?? "unknown" }}</strong>: {{ entry.message }}
              </li>
            </ul>
          </div>
          <div v-if="(result.skipped || []).length > 0" class="warning-container">
            Skipped rows:
            <ul
              v-for="(entry, index) in result.skipped"
              :key="`skipped-${index}`"
            >
              <li>
                Submission <strong>{{ entry.submissionId }}</strong>: {{ entry.message }}
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
      fieldMappings: {},
      primaryKeyField: "",
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
    selectedMappings() {
      return this.sourceFields
        .filter((field) => field !== this.primaryKeyField && this.fieldMappings[field]?.include)
        .map((field) => ({
          sourceField: field,
          metaKey: String(this.fieldMappings[field]?.metaKey || "").trim(),
        }));
    },
    selectedMetaKeys() {
      return this.selectedMappings.map((mapping) => mapping.metaKey).filter(Boolean);
    },
    hasDuplicateMetaKeys() {
      return new Set(this.selectedMetaKeys).size !== this.selectedMetaKeys.length;
    },
    hasDuplicatePrimaryKeyValues() {
      if (!this.primaryKeyField) {
        return false;
      }

      const seen = new Set();
      for (const row of this.rows) {
        const value = row?.[this.primaryKeyField];
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

      if (!this.primaryKeyField) {
        messages.push("Select a primary key field.");
      }

      if (this.selectedMappings.length === 0) {
        messages.push("Select at least one source field to import as metadata.");
      }

      if (this.selectedMappings.some((mapping) => !mapping.metaKey)) {
        messages.push("Every selected source field needs a target metaKey.");
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
        primaryKeyField: this.primaryKeyField,
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
    primaryKeyField(newField) {
      if (newField && this.fieldMappings[newField]) {
        this.fieldMappings[newField].include = false;
      }
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
      this.fieldMappings = {};
      this.primaryKeyField = "";
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
    initializeMappings() {
      this.fieldMappings = this.sourceFields.reduce((acc, field) => {
        acc[field] = {
          include: false,
          metaKey: field,
        };
        return acc;
      }, {});
      this.primaryKeyField = "";
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
    handleMappingToggle(field) {
      if (!this.fieldMappings[field]?.include) {
        this.fieldMappings[field].metaKey = field;
      }
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
        this.fieldMappings = {};
        this.primaryKeyField = "";
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
.warning-container {
  margin: 0.5rem auto;
  color: #8a6d3b;

  ul {
    margin-bottom: 0.25rem;
  }
}
</style>
