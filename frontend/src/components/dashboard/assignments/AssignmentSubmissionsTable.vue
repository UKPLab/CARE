<template>
  <div>
    <BasicTable
      :columns="columns"
      :data="tableRows"
      :options="tableOptions"
      :buttons="tableButtons"
      @action="handleAction"
    />
    <AssignmentUploadModal ref="uploadModal" />
    <ConfirmModal ref="deleteConf" />
  </div>
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import AssignmentUploadModal from "@/components/dashboard/assignments/AssignmentUploadModal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import { resolveApiMessage } from "@/assets/utils";
import JSZip from "jszip";
import FileSaver from "file-saver";

/**
 * Table displaying submissions for a specific assignment.
 *
 * Can be used standalone via the assignmentId prop or with pre-fetched rows.
 * Shows submission metadata (name, user, creation date, study usage) and
 * provides actions to download, replace, or delete individual submissions.
 * Supports bulk download as a ZIP archive.
 *
 * @author Karim Ouf
 */
export default {
  name: "AssignmentSubmissionsTable",
  components: { BasicTable, AssignmentUploadModal, ConfirmModal },
  subscribeTable: ["submission", "user", "document", "assignment"],
  props: {
    rows: {
      type: Array,
      required: false,
      default: () => [],
    },
    assignmentId: {
      type: Number,
      required: false,
      default: null,
    },
  },
  data() {
    return {
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
        { name: "Submission Name", key: "name" },
        { name: "Username", key: "userName" },
        { name: "Studies Using", key: "studyUsageCount" },
        { name: "Created At", key: "createdAt" },
      ],
    };
  },
  computed: {
    hasAdminRights() {
      return this.$store.getters["auth/isAdmin"] || this.$store.getters["auth/checkRight"]("frontend.dashboard.assignments.viewAll");
    },
    canReplaceDeleteSubmissions() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.assignments.replaceDeleteSubmissions");
    },
    currentUserId() {
      return this.$store.getters["auth/getUserId"];
    },
    authUser() {
      return this.$store.getters["auth/getUser"] || {};
    },
    assignment() {
      if (!this.assignmentId) {
        return null;
      }
      return this.$store.getters["table/assignment/get"](this.assignmentId);
    },
    tableRows() {
      if (!this.assignmentId) {
        return this.rows;
      }

      const submissions = this.$store.getters["table/submission/getFiltered"](
        (submission) => submission.assignmentId === this.assignmentId && !submission.deleted
      ) || [];
      
      return submissions
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((submission) => {
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
            assignmentId: this.assignmentId,
            canDownload: this.hasAdminRights || (submission.userId === this.currentUserId),
            canReplaceDelete: ((submission.userId === this.currentUserId && this.assignment.allowReUpload) || this.canReplaceDeleteSubmissions && !isStudyLocked) && this.assignment.closed === null,
            isStudyLocked,
            studyUsageCount,
            name: submission.name || "-",
            userName: user?.userName || this.authUser?.userName || "unknown",
            group: submission.group ?? "-",
            description: submission.description || "",
            createdAt: submission.createdAt ? new Date(submission.createdAt).toLocaleString() : "-",
          };
        });
    },
    tableButtons() {
      const buttons = [];

      buttons.push(
        {
          icon: "download",
          filter: [
            {
              key: "canDownload",
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
          title: "Download submission files",
          action: "downloadSubmission",
          stats: {
            submissionId: "id",
          },
        },
        {
          icon: "arrow-repeat",
          filter: [
            {
              key: "canReplaceDelete",
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
              key: "canReplaceDelete",
              value: true,
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
        }
      );

      return buttons;
    },
  },
  methods: {
    handleAction(data) {
      switch (data.action) {
        case "downloadSubmission":
          this.downloadSubmission(data.params);
          break;
        case "replaceSubmission":
          this.replaceSubmission(data.params);
          break;
        case "deleteSubmission":
          this.deleteSubmission(data.params);
          break;
      }
    },
    async downloadSubmission(submission) {
      try {
        const docs = this.$store.getters["table/document/getFiltered"](
          (d) => d.submissionId === submission.id && !d.deleted
        ) || [];

        if (docs.length === 0) {
          this.eventBus.emit("toast", {
            title: "No documents found",
            message: "This submission has no associated documents to download",
            variant: "warning",
          });
          return;
        }

        const zip = new JSZip();
        const userName = submission.userName || "unknown";
        const folderName = `submission_${submission.id}_${userName}`;

        for (const doc of docs) {
          try {
            const response = await new Promise((resolve, reject) => {
              this.$socket.emit("documentGet", { documentId: doc.id }, (res) => {
                if (res.success) {
                  resolve(res.data);
                } else {
                  reject(new Error(res.message || "Failed to get document"));
                }
              });
            });

            let fileExtension;
            switch (doc.type) {
              case 3:
                fileExtension = ".json";
                break;
              case 4:
                fileExtension = ".zip";
                break;
              default:
                fileExtension = ".pdf";
            }

            const fileName = `${doc.name}${fileExtension}`;

            if (response.file) {
              if (typeof response.file === "string") {
                zip.file(`${folderName}/${fileName}`, response.file, { binary: false });
              } else {
                zip.file(`${folderName}/${fileName}`, response.file, { binary: true });
              }
            }
          } catch (error) {
            this.eventBus.emit("toast", {
              title: "Download error",
              message: `Failed to download ${doc.name}: ${error.message}`,
              variant: "danger",
            });
          }
        }

        const content = await zip.generateAsync({ type: "blob" });
        FileSaver.saveAs(content, `${folderName}.zip`);

        this.eventBus.emit("toast", {
          title: "Download complete",
          message: `Downloaded submission ${submission.id} with ${docs.length} documents`,
          variant: "success",
        });
      } catch (error) {
        this.eventBus.emit("toast", {
          title: "Download failed",
          message: error.message,
          variant: "danger",
        });
      }
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

      const assignmentId = row.assignmentId || this.assignmentId;
      if (!assignmentId) {
        this.eventBus.emit("toast", {
          title: "Replace failed",
          message: "Assignment id is missing for this submission.",
          variant: "danger",
        });
        return;
      }
      this.$refs.uploadModal.open(assignmentId, row);
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
            "submissionDelete",
            {
              id: row.id,
              force: true,
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
                  message: resolveApiMessage(res),
                  variant: "danger",
                });
              }
            }
          );
        }
      );
    },
  },
};
</script>
