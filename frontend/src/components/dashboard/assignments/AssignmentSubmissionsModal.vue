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
      <BasicTable
        :columns="columns"
        :data="submissionTable"
        :options="tableOptions"
        :buttons="tableButtons"
        @action="action"
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
  <AssignmentUploadModal ref="uploadModal" />
  <ConfirmModal ref="deleteConf" />
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import AssignmentUploadModal from "@/components/dashboard/assignments/AssignmentUploadModal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";

export default {
  name: "AssignmentSubmissionsModal",
  subscribeTable: ["submission", "user", "assignment", "document"],
  components: { BasicModal, BasicTable, BasicButton, AssignmentUploadModal, ConfirmModal },
  data() {
    return {
      assignmentId: 0,
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
        search: true,
      },
      columns: [
        { name: "ID", key: "id" },
        { name: "Username", key: "userName" },
        { name: "Studies Using", key: "studyUsageCount" },
        { name: "Created At", key: "createdAt" },
      ],
      tableButtons: [
        {
          icon: "arrow-repeat",
          filter: [
            {
              key: "allowReUpload",
              value: true,
            },
          ],
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
              "btn-sm": true,
            },
          },
          title: "Replace submission",
          action: "replaceSubmission",
          stats: {
            submissionId: "id",
          },
        },
        {
          icon: "trash",
          filter: [
            {
              key: "isStudyLocked",
              value: false,
            },
          ],
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-danger": true,
              "btn-sm": true,
            },
          },
          title: "Delete submission",
          action: "deleteSubmission",
          stats: {
            submissionId: "id",
          },
        },
      ],
    };
  },
  computed: {
    isAdmin() {
      return this.$store.getters["auth/isAdmin"];
    },
    currentUserId() {
      return this.$store.getters["auth/getUserId"];
    },
    user(){
      return this.$store.getters["auth/getUser"]
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
    submissionTable() {
      return this.submissions.map((submission) => {
        const user = this.$store.getters["table/user/get"](submission.userId);
        const submissionDocuments = this.$store.getters["table/document/getFiltered"](
          (document) => document.submissionId === submission.id && !document.deleted
        ) || [];

        const studyUsageCount = submissionDocuments
          .reduce((total, document) => total + Number(document.studyUsageCount || 0), 0);
        const isStudyLocked = studyUsageCount > 0;

        return {
          id: submission.id,
          userId: submission.userId,
          allowReUpload: (Boolean(this.assignment?.allowReUpload) || this.isAdmin ) && !isStudyLocked,
          isStudyLocked,
          studyUsageCount,
          userName: user?.userName || this.user?.userName || "unknown",
          group: submission.group ?? "-",
          createdAt: submission.createdAt ? new Date(submission.createdAt).toLocaleString() : "-",
        };
      });
    },
  },
  methods: {
    action(data) {
      switch (data.action) {
        case "replaceSubmission":
          this.replaceSubmission(data.params);
          break;
        case "deleteSubmission":
          this.deleteSubmission(data.params);
          break;
      }
    },
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
    replaceSubmission(row) {
      if (row.isStudyLocked) {
        this.eventBus.emit("toast", {
          title: "Replace not allowed",
          message: "This submission cannot be replaced because one or more documents are used in studies.",
          variant: "warning",
        });
        return;
      }
      this.$refs.uploadModal.open(this.assignmentId, {
        submissionId: row.id,
        userId: row.userId,
        group: row.group === "-" ? null : row.group,
      });
    },
    deleteSubmission(row) {
      if (row.isStudyLocked) {
        this.eventBus.emit("toast", {
          title: "Delete not allowed",
          message: "This submission cannot be deleted because one or more documents are used in studies.",
          variant: "warning",
        });
        return;
      }
      this.$refs.deleteConf.open(
        "Delete Submission",
        "Are you sure you want to delete this submission?",
        "",
        (confirmed) => {
          if (!confirmed) return;

          this.$socket.emit(
            "submissionUpdate",
            {
              id: row.id,
              deleted: true,
            },
            (res) => {
              if (res.success) {
                this.eventBus.emit("toast", {
                  title: "Submission deleted",
                  message: "The submission has been deleted",
                  variant: "success",
                });
              } else {
                this.eventBus.emit("toast", {
                  title: "Failed to delete submission",
                  message: res.message,
                  variant: "danger",
                });
              }
            }
          );
        }
      );
    },
    close() {
      this.$refs.assignmentSubmissionsModal.close();
    },
  },
};
</script>
