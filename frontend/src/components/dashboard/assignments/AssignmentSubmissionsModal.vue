<template>
  <BasicModal
    ref="assignmentSubmissionsModal"
    :props="{ assignmentId: assignmentId }"
    size="lg"
    name="assignmentSubmissionsModal"
  >
    <template #title>
      <span>Submissions for {{ assignmentTitle }}</span>
    </template>
    <template #body>
      <AssignmentSubmissionsTable
        :assignment-id="assignmentId"
      />
    </template>
    <template #footer>
      <span
        v-if="isRevisionLimitReached"
        class="text-warning me-3"
      >
        Maximum number of revisions ({{ maxRevisions }}) reached.
      </span>
      <span class="btn-group">
        
        <BasicButton
          class="btn btn-secondary"
          title="Close"
          @click="close"
        />
        <BasicButton
          class="btn btn-primary"
          title="Upload Submission"
          text="Upload Submission"
          icon="file-earmark-arrow-up"
          :disabled="!canUploadSubmission"
          @click="openUploadModal"
        />
        
      </span>
    </template>
  </BasicModal>
  <ImportModal ref="importModal" />
  <AssignmentUploadModal ref="uploadModal" />
  <ConfirmModal ref="deleteConf" />
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import AssignmentUploadModal from "@/components/dashboard/assignments/AssignmentUploadModal.vue";
import AssignmentSubmissionsTable from "@/components/dashboard/assignments/AssignmentSubmissionsTable.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import ImportModal from "@/components/dashboard/submission/ImportModal.vue";

/**
 * Modal displaying all submissions for a given assignment.
 *
 * Opens via open(assignmentId) and shows the AssignmentSubmissionsTable
 * scoped to that assignment. Provides actions to upload new submissions,
 * import from external sources, delete submissions, and close the modal.
 * Displays a warning when the assignment's maximum revision limit is reached.
 *
 * @author Karim Ouf
 */
export default {
  name: "AssignmentSubmissionsModal",
  subscribeTable: ["submission", "user", "assignment", "document"],
  components: { BasicModal, BasicButton, AssignmentUploadModal, AssignmentSubmissionsTable, ConfirmModal, ImportModal },
  data() {
    return {
      assignmentId: 0,
    };
  },
  computed: {
    isAdmin() {
      return this.$store.getters["auth/isAdmin"];
    },
    currentUserId() {
      return this.$store.getters["auth/getUserId"];
    },
    assignment() {
      return this.assignmentId ? this.$store.getters["table/assignment/get"](this.assignmentId) : null;
    },
    submissionStatus() {
      if (!this.assignment) {
        return "open";
      }

      if (this.assignment.closed) {
        return "closed";
      }

      const now = new Date();
      const start = this.assignment.start ? new Date(this.assignment.start) : null;
      const end = this.assignment.end ? new Date(this.assignment.end) : null;

      if (start && now < start) {
        return "notStarted";
      }

      if (end && now > end) {
        return "closed";
      }

      return "open";
    },
    canUploadSubmission() {
      const statusAllowsUpload = this.isAdmin || this.submissionStatus === "open";
      return statusAllowsUpload && !this.isRevisionLimitReached;
    },
    maxRevisions() {
      return this.assignment?.maxRevisions || 0;
    },
    currentUserMaxRevisionDepth() {
      if (!this.currentUserId) {
        return 0;
      }
      const userSubmissions = this.submissions.filter((submission) => submission.userId === this.currentUserId);
      if (userSubmissions.length === 0) {
        return 0;
      }

      const submissionById = new Map(userSubmissions.map((submission) => [submission.id, submission]));
      const depthCache = new Map();

      const getDepth = (submission) => {
        if (!submission) {
          return 0;
        }
        if (depthCache.has(submission.id)) {
          return depthCache.get(submission.id);
        }

        const visited = new Set();
        let depth = 1;
        let current = submission;

        while (current?.previousSubmissionId && submissionById.has(current.previousSubmissionId)) {
          if (visited.has(current.previousSubmissionId)) {
            break;
          }
          visited.add(current.previousSubmissionId);
          depth += 1;
          current = submissionById.get(current.previousSubmissionId);
        }

        depthCache.set(submission.id, depth);
        return depth;
      };

      return Math.max(...userSubmissions.map((submission) => getDepth(submission)));
    },
    isRevisionLimitReached() {
      if (this.isAdmin || this.maxRevisions === 0) {
        return false;
      }
      return this.currentUserMaxRevisionDepth >= this.maxRevisions;
    },
    assignmentTitle() {
      return this.assignment?.title || `Assignment #${this.assignmentId}`;
    },
    submissions() {
      return this.$store.getters["table/submission/getFiltered"](
        (submission) => submission.assignmentId === this.assignmentId
      );
    },
  },
  methods: {
    open(assignmentId) {
      this.assignmentId = assignmentId;
      this.$refs.assignmentSubmissionsModal.open();
    },
    openUploadModal() {
      if (this.isRevisionLimitReached) {
        this.eventBus.emit("toast", {
          title: "Revision limit reached",
          message: `You have reached the maximum number of revisions (${this.maxRevisions}).`,
          variant: "warning",
        });
        return;
      }
      if (!this.canUploadSubmission) {
        this.eventBus.emit("toast", {
          title: "Upload not allowed",
          message: "Submissions are closed for this assignment. Only admins can upload now.",
          variant: "warning",
        });
        return;
      }
      this.$refs.uploadModal.open(this.assignmentId);
    },
    close() {
      this.$refs.assignmentSubmissionsModal.close();
    },
  },
};
</script>
