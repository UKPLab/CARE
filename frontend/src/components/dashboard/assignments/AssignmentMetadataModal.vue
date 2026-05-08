<template>
  <StepperModal
    ref="metadataImportStepper"
    :steps="steps"
    :validation="stepValid"
    submit-text="Import Metadata"
    @submit="submit"
  >
    <template #title>
      <span>Import Metadata</span>
    </template>

    <template #step-1>
      <div class="p-3">
        <!-- TODO: Check if the description needs to be adjusted. -->
        <p class="text-muted mb-3">
          Upload the published Ratingallocate export for this assignment as `.json` or `.csv`.
        </p>
        <input
          ref="allocationFileInput"
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
        <div v-if="allocations.length > 0" class="mt-2 small text-success">
          Parsed {{ allocations.length }} allocation rows.
        </div>
      </div>
    </template>

    <template #step-2>
      <div class="p-3">
        <div class="alert alert-warning mb-3">
          This import updates metadata for submissions in the current assignment only. Existing metadata for matched submissions will be overwritten.
        </div>
        <div class="card">
          <div class="card-body bg-light">
            <div><strong>Assignment:</strong> {{ assignment?.name || `Assignment #${assignmentId}` }}</div>
            <div><strong>Matched submissions:</strong> {{ preview.matchedCount }}</div>
            <div><strong>Rows without submission match:</strong> {{ preview.unmatchedCount }}</div>
            <div><strong>Submissions with existing topics to overwrite:</strong> {{ preview.overwrittenCount }}</div>
            <div><strong>Matched submissions without documents:</strong> {{ preview.skippedCount }}</div>
          </div>
        </div>
      </div>
    </template>

    <template #step-3>
      <div class="p-3">
        <div class="mb-2">
          Updated <strong>{{ result.matchedCount || 0 }}</strong> submissions.
        </div>
        <div v-if="(result.overwritten || []).length > 0" class="warning-container">
          Overwritten existing topics:
          <ul v-for="(entry, index) in result.overwritten" :key="`overwritten-${index}`">
            <li>Submission <strong>{{ entry.submissionId }}</strong>: {{ entry.message }}</li>
          </ul>
        </div>
        <div v-if="(result.unmatched || []).length > 0" class="warning-container">
          Unmatched report rows:
          <ul v-for="(entry, index) in result.unmatched" :key="`unmatched-${index}`">
            <li>User <strong>{{ entry.extId || entry.email || "unknown" }}</strong>: {{ entry.message }}
            </li>
          </ul>
        </div>
        <div v-if="(result.skipped || []).length > 0" class="warning-container">
          Skipped submissions:
          <ul v-for="(entry, index) in result.skipped" :key="`skipped-${index}`">
            <li>Submission <strong>{{ entry.submissionId }}</strong>: {{ entry.message }}</li>
          </ul>
        </div>
      </div>
    </template>
  </StepperModal>
</template>

<script>
import Papa from "papaparse";
import StepperModal from "@/basic/modal/StepperModal.vue";


/**
 * Multi-step modal for uploading document metadata.
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
      allocations: [],
      fileName: "",
      parseError: "",
      preview: {
        matchedCount: 0,
        unmatchedCount: 0,
        overwrittenCount: 0,
        skippedCount: 0,
      },
      result: {},
      steps: [{ title: "Upload" }, { title: "Preview" }, { title: "Result" }],
    };
  },
  computed: {
    assignment() {
      return this.assignmentId ? this.$store.getters["table/assignment/get"](this.assignmentId) : null;
    },
    usersById() {
      const users = this.$store.getters["table/user/getAll"] || [];
      return new Map(users.map((user) => [Number(user.id), user]));
    },
    submissionsInAssignment() {
      return this.$store.getters["table/submission/getFiltered"](
        (submission) => submission.assignmentId === this.assignmentId && !submission.deleted
      ) || [];
    },
    documentsBySubmissionId() {
      const documents = this.$store.getters["table/document/getAll"] || [];
      return documents.reduce((acc, document) => {
        if (document.deleted) {
          return acc;
        }
        if (!acc.has(document.submissionId)) {
          acc.set(document.submissionId, []);
        }
        acc.get(document.submissionId).push(document);
        return acc;
      }, new Map());
    },
    metadataByDocumentId() {
      const metadata = this.$store.getters["table/document_metadata/getAll"] || [];
      return metadata.reduce((acc, row) => {
        if (row.deleted) {
          return acc;
        }
        if (!acc.has(row.documentId)) {
          acc.set(row.documentId, []);
        }
        acc.get(row.documentId).push(row);
        return acc;
      }, new Map());
    },
    submissionsByExtId() {
      const map = new Map();
      for (const submission of this.submissionsInAssignment) {
        const owner = this.usersById.get(Number(submission.userId));
        if (owner?.extId != null) {
          map.set(Number(owner.extId), submission);
        }
      }
      return map;
    },
    submissionsByEmail() {
      const map = new Map();
      for (const submission of this.submissionsInAssignment) {
        const owner = this.usersById.get(Number(submission.userId));
        if (owner?.email) {
          map.set(String(owner.email).trim().toLowerCase(), submission);
        }
      }
      return map;
    },
    stepValid() {
      return [this.allocations.length > 0, true, true];
    },
  },
  methods: {
    open(assignmentId) {
      this.assignmentId = assignmentId;
      this.allocations = [];
      this.fileName = "";
      this.parseError = "";
      this.preview = {
        matchedCount: 0,
        unmatchedCount: 0,
        overwrittenCount: 0,
        skippedCount: 0,
      };
      this.result = {};
      this.$refs.metadataImportStepper.open();
    },
    /**
     * Recursively flattens a nested data structure into a single-dimensional array of objects
     * as the allocation.json from Moodle may look like: [[{ id: "1" }, { id: "2" }]]
     * @param {*} payload - The data to flatten. Can be a nested array, a single object, or other types.
     * @returns {Object[]} A flattened array containing only the extracted objects.
     * 
     * @example
     * // Input: [[{ id: "1" }, { id: "2" }]]
     * // Output: [{ id: "1" }, { id: "2" }]
     * const flatData = this.flattenRows(payload);
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
    normalizeRow(row) {
      if (!row || typeof row !== 'object') return null;

      // Define a key value mapping method
      const findValue = (keys) => {
        const foundKey = keys.find(key => row[key] !== undefined && row[key] !== null);
        return row[foundKey];
      };

      const extId = findValue(['id', 'ID']);
      const topic = findValue(['topic', 'topicname', 'choice', 'Choice', 'title']);
      const email = findValue(['emailAddress', 'emailaddress', 'email']);

      if (extId == null || !topic) return null;

      return {
        extId: Number(extId),
        topic: String(topic).trim(),
        email: email ? String(email).trim() : null,
        // TODO: Comment out the following properties for testing purpose
        // source: "moodle.ratingallocate.report",
        // published: true,
        // raw: row,
      };
    },
    async parseJson(file) {
      const text = await file.text();
      const payload = JSON.parse(text);
      return this.flattenRows(payload)
        .map((row) => this.normalizeRow(row))
        .filter(Boolean);
    },
    parseCsv(file) {
      return new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: ({ data }) => {
            resolve(
              data.map((row) => this.normalizeRow(row)).filter(Boolean)
            );
          },
          error: reject,
        });
      });
    },
    matchAllocationToSubmission(allocation) {
      if (allocation.extId != null && this.submissionsByExtId.has(Number(allocation.extId))) {
        return this.submissionsByExtId.get(Number(allocation.extId));
      }

      const email = allocation.email ? String(allocation.email).trim().toLowerCase() : "";
      if (email && this.submissionsByEmail.has(email)) {
        return this.submissionsByEmail.get(email);
      }

      return null;
    },
    rebuildPreview() {
      let matchedCount = 0;
      let unmatchedCount = 0;
      let overwrittenCount = 0;
      let skippedCount = 0;

      for (const allocation of this.allocations) {
        const submission = this.matchAllocationToSubmission(allocation);
        if (!submission) {
          unmatchedCount += 1;
          continue;
        }

        const documents = this.documentsBySubmissionId.get(submission.id) || [];
        if (documents.length === 0) {
          skippedCount += 1;
          continue;
        }

        matchedCount += 1;

        const hasExistingTopic = documents.some((document) => {
          const rows = this.metadataByDocumentId.get(document.id) || [];
          return rows.some((row) => row.metaKey === "topic");
        });
        if (hasExistingTopic) {
          overwrittenCount += 1;
        }
      }

      this.preview = {
        matchedCount,
        unmatchedCount,
        overwrittenCount,
        skippedCount,
      };
    },
    async handleFileChange(event) {
      const file = event.target.files?.[0];
      if (!file) return;

      this.fileName = file.name;
      this.parseError = "";

      try {
        let rows = [];
        if (file.name.toLowerCase().endsWith(".json")) {
          rows = await this.parseJson(file);
        } else if (file.name.toLowerCase().endsWith(".csv")) {
          rows = await this.parseCsv(file);
        } else {
          throw new Error("Unsupported file format. Please upload .json or .csv.");
        }

        if (rows.length === 0) {
          throw new Error("The topic allocation report did not contain usable rows.");
        }

        this.allocations = rows;
        this.rebuildPreview();
      } catch (error) {
        this.allocations = [];
        this.preview = {
          matchedCount: 0,
          unmatchedCount: 0,
          overwrittenCount: 0,
          skippedCount: 0,
        };
        this.parseError = error.message || "Failed to parse topic allocation report.";
      }
    },
    submit() {
      this.$refs.metadataImportStepper.setWaiting(true);
      this.$socket.emit("documentImportTopicAllocation", {
        assignmentId: this.assignmentId,
        allocations: this.allocations,
      }, (res) => {
        this.$refs.metadataImportStepper.setWaiting(false);
        if (res.success) {
          this.result = res.data || {};
          this.$refs.metadataImportStepper.currentStep = 2;
          this.eventBus.emit("toast", {
            title: "Topic allocation imported",
            message: `Updated ${res.data?.matchedCount || 0} submissions.`,
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: "Topic allocation import failed",
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
