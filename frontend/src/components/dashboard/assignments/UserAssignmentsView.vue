<template>
  <div class="container">
    <div class="d-flex justify-content-between align-items-center">
      <h1 class="mb-0">Active Assignments</h1>
      <BasicButton
        class="btn-primary btn-sm"
        text="Add Assignment"
        title="Add Assignment"
        icon="plus"
        @click="addAssignment"
      />
    </div>
    <div v-if="activeAssignments.length === 0">
      <p class="fs-6">
        You have no active assignments.
      </p>
    </div>
    <div v-else>
      <hr>
      <div
        v-for="assignment in activeAssignments"
        :key="`active-${assignment.id}`"
      >
        <Card
          :title="assignment.title"
          collapsable
          collapsed
        >
          <template #headerElements>
            <BasicButton
              class="btn btn-primary btn-sm"
              title="Upload Submission"
              text="Upload Submission"
              icon="file-earmark-arrow-up"
              :disabled="!canUploadSubmissionForAssignment(assignment)"
              @click="openUploadModalForAssignment(assignment)"
            />
          </template>
          <template #body>
            <AssignmentSubmissionsTable
              :assignment-id="assignment.id"
            />
          </template>
          <template #footer>
            <span>{{ assignment.end ? assignmentTimes[assignment.id] : "no due date" }}</span>
          </template>
        </Card>
        <hr>
      </div>
    </div>
  </div>

  <div class="container">
    <h1>Closed Assignments</h1>
    <div v-if="closedAssignments.length === 0">
      <p class="fs-6">
        You have no closed assignments.
      </p>
    </div>
    <div v-else>
      <hr>
      <div
        v-for="assignment in closedAssignments"
        :key="`closed-${assignment.id}`"
      >
        <Card
          :title="assignment.title"
          collapsable
          collapsed
        >
          <template #headerButtons>
            <BasicButton
              class="btn btn-primary btn-sm"
              title="Upload Submission"
              text="Upload Submission"
              icon="file-earmark-arrow-up"
              :disabled="!canUploadSubmissionForAssignment(assignment)"
              @click="openUploadModalForAssignment(assignment)"
            />
          </template>
          <template #body>
            <AssignmentSubmissionsTable
              :assignment-id="assignment.id"
            />
          </template>
        </Card>
        <hr>
      </div>
    </div>
  </div>

  <AssignmentModal ref="assignmentModal" />
  <AssignmentUploadModal ref="uploadModal" />
  <ConfirmModal ref="deleteConf" />
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicButton from "@/basic/Button.vue";
import AssignmentModal from "@/components/dashboard/assignments/AssignmentModal.vue";
import AssignmentUploadModal from "@/components/dashboard/assignments/AssignmentUploadModal.vue";
import AssignmentSubmissionsTable from "@/components/dashboard/assignments/AssignmentSubmissionsTable.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import { getTimeDiffString } from "@/assets/utils";

export default {
  name: "UserAssignmentsView",
  subscribeTable: ["assignment", "submission", "user", "document"],
  components: { Card, BasicButton, AssignmentModal, AssignmentUploadModal, AssignmentSubmissionsTable, ConfirmModal },
  computed: {
    isAdmin() {
      return this.$store.getters["auth/isAdmin"];
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    assignments() {
      return this.$store.getters["table/assignment/getFiltered"](
        (assignment) => assignment.userId === this.userId || Boolean(assignment.public)
      ) || [];
    },
    assignmentTimes() {
      return Object.fromEntries(
        this.assignments.map((assignment) => [
          assignment.id,
          assignment.end ? getTimeDiffString(Date.now(), new Date(assignment.end)) : null,
        ])
      );
    },
    activeAssignments() {
      return this.assignments.filter((assignment) => this.getAssignmentStatus(assignment) !== "closed");
    },
    closedAssignments() {
      return this.assignments.filter((assignment) => this.getAssignmentStatus(assignment) === "closed");
    },
  },
  methods: {
    addAssignment() {
      this.$refs.assignmentModal.open();
    },
    getAssignmentStatus(assignment) {
      if (assignment.closed) {
        return "closed";
      }

      const now = new Date();
      const start = assignment.start ? new Date(assignment.start) : null;
      const end = assignment.end ? new Date(assignment.end) : null;

      if (start && now < start) {
        return "notStarted";
      }

      if (end && now > end) {
        return "closed";
      }

      return "open";
    },
    maxRevisionsForAssignment(assignment) {
      return Number(assignment?.maxRevisions || 0);
    },
    currentUserMaxRevisionDepth(assignmentId) {
      const userSubmissions = this.$store.getters["table/submission/getFiltered"](
        (submission) => submission.assignmentId === assignmentId && submission.userId === this.userId && !submission.deleted
      ) || [];

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
    isRevisionLimitReachedForAssignment(assignment) {
      const maxRevisions = this.maxRevisionsForAssignment(assignment);
      if (maxRevisions === 0) {
        return false;
      }
      return this.currentUserMaxRevisionDepth(assignment.id) >= maxRevisions;
    },
    canUploadSubmissionForAssignment(assignment) {
      const statusAllowsUpload = this.getAssignmentStatus(assignment) === "open";
      return statusAllowsUpload && !this.isRevisionLimitReachedForAssignment(assignment);
    },
    openUploadModalForAssignment(assignment) {
      if (this.isRevisionLimitReachedForAssignment(assignment)) {
        this.eventBus.emit("toast", {
          title: "Revision limit reached",
          message: `You have reached the maximum number of revisions (${this.maxRevisionsForAssignment(assignment)}).`,
          variant: "warning",
        });
        return;
      }

      if (!this.canUploadSubmissionForAssignment(assignment)) {
        this.eventBus.emit("toast", {
          title: "Upload not allowed",
          message: "Submissions are closed for this assignment.",
          variant: "warning",
        });
        return;
      }

      this.$refs.uploadModal.open(assignment.id);
    },
  },
};
</script>
