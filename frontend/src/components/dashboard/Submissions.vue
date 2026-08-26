<template>
  <div class="container">
    <div class="d-flex justify-content-between align-items-center">
      <h1 class="mb-0">Active Assignments</h1>
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
          :title="assignment.name"
          collapsable
          collapsed
        >
          <template #headerElements>
            <div class="d-flex align-items-center gap-2">
              <span
                v-if="!canUploadForOthers"
                :class="['badge', 'd-inline-flex', 'align-items-center', 'gap-1', submissionsBadgeClass(assignment)]"
              >
                <LoadIcon icon-name="file-earmark-check" size="14" />
                {{ remainingSubmissionsForAssignment(assignment) }} submission(s) left
              </span>
              <span :class="['badge', 'd-inline-flex', 'align-items-center', 'gap-1', timeBadgeClass(assignment)]">
                <LoadIcon icon-name="clock" size="14" />
                {{ timeBadgeText(assignment) }}
              </span>
              <BasicButton
                class="btn btn-primary btn-sm"
                title="Upload Submission"
                text="Upload Submission"
                icon="file-earmark-arrow-up"
                :disabled="!canUploadSubmissionForAssignment(assignment)"
                @click="openUploadModalForAssignment(assignment)"
              />
            </div>
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
          :title="assignment.name"
          collapsable
          collapsed
        >
          <template #headerElements>
            <div class="d-flex align-items-center gap-2">
              <span
                v-if="!canUploadForOthers"
                :class="['badge', 'd-inline-flex', 'align-items-center', 'gap-1', submissionsBadgeClass(assignment)]"
              >
                <LoadIcon icon-name="file-earmark-check" size="14" />
                {{ remainingSubmissionsForAssignment(assignment) }} submission(s) left
              </span>
              <BasicButton
                class="btn btn-primary btn-sm"
                title="Upload Submission"
                text="Upload Submission"
                icon="file-earmark-arrow-up"
                :disabled="!canUploadSubmissionForAssignment(assignment)"
                @click="openUploadModalForAssignment(assignment)"
              />
            </div>
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

  <AssignmentUploadModal ref="uploadModal" />
  <ConfirmModal ref="deleteConf" />
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicButton from "@/basic/Button.vue";
import LoadIcon from "@/basic/Icon.vue";
import AssignmentUploadModal from "@/components/dashboard/assignments/AssignmentUploadModal.vue";
import AssignmentSubmissionsTable from "@/components/dashboard/assignments/AssignmentSubmissionsTable.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import { getTimeDiffString } from "@/assets/utils";

export default {
  name: "DashboardSubmission",
  subscribeTable: ["assignment", "submission", "user", "document"],
  components: { Card, BasicButton, LoadIcon, AssignmentUploadModal, AssignmentSubmissionsTable, ConfirmModal },
  computed: {
    canUploadForOthers() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.assignments.uploadForOthers");
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    assignments() {
      return this.$store.getters["table/assignment/getFiltered"](
        (assignment) => assignment.userId === this.userId || !assignment.disable
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
      if (maxRevisions === -1) {
        return false;
      }
      return this.currentUserMaxRevisionDepth(assignment.id) >= maxRevisions + 1;
    },
    remainingSubmissionsForAssignment(assignment) {
      const maxRevisions = this.maxRevisionsForAssignment(assignment);
      if (maxRevisions === -1) {
        return "Unlimited";
      }
      return Math.max(maxRevisions + 1 - this.currentUserMaxRevisionDepth(assignment.id), 0);
    },
    submissionsBadgeClass(assignment) {
      return this.remainingSubmissionsForAssignment(assignment) === 0
        ? "bg-success text-white"
        : "bg-light text-dark border";
    },
    isAssignmentOverdue(assignment) {
      return !!assignment.end && new Date(assignment.end) < new Date();
    },
    isAssignmentClosingSoon(assignment) {
      if (!assignment.end) return false;
      const msLeft = new Date(assignment.end) - new Date();
      return msLeft > 0 && msLeft <= 24 * 60 * 60 * 1000;
    },
    timeBadgeClass(assignment) {
      if (this.isAssignmentOverdue(assignment)) return "bg-danger text-white";
      if (this.isAssignmentClosingSoon(assignment)) return "bg-warning text-dark";
      return "bg-light text-dark border";
    },
    timeBadgeText(assignment) {
      if (!assignment.end) return "no due date";
      return this.isAssignmentOverdue(assignment)
        ? `Overdue by ${this.assignmentTimes[assignment.id]}`
        : this.assignmentTimes[assignment.id];
    },
    canUploadSubmissionForAssignment(assignment) {
      const statusAllowsUpload = this.getAssignmentStatus(assignment) === "open";
      return statusAllowsUpload && !this.isRevisionLimitReachedForAssignment(assignment);
    },
    openUploadModalForAssignment(assignment) {
      if (this.isRevisionLimitReachedForAssignment(assignment)) {
        this.eventBus.emit("toast", {
          title: "Revision limit reached",
          message: `You have reached the maximum number of submissions for this assignment (${this.maxRevisionsForAssignment(assignment) + 1}).`,
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
