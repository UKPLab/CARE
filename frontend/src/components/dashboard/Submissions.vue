<template>
  <Card title="Submissions">
    <template #headerElements>
      <BasicButton
        class="btn-secondary btn-sm me-1"
        text="Publish Reviews"
        title="Publish Reviews"
        @click="$refs.publishModal.open()"
      />
      <BasicButton
        class="btn-secondary btn-sm me-1"
        text="Manual Import"
        title="Manual Import"
        @click="$refs.uploadModal.open()"
      />
      <BasicButton
        class="btn-primary btn-sm"
        title="Import via Moodle"
        text="Import via Moodle"
        @click="$refs.importModal.open()"
      />
      <BasicButton
        :class="isProcessingActive ? 'btn-warning btn-sm ms-1 position-relative' : 'btn-success btn-sm ms-1'"
        :text="isProcessingActive ? 'View Processing' : 'Apply Skills'"
        :title="isProcessingActive ? 'View Processing Progress' : 'Apply Skills'"
        @click="preprocessGrades" 
      >
        <span v-if="isProcessingActive" class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle">
          <span class="visually-hidden">Processing active</span>
        </span>
      </BasicButton>
    </template>
    <template #body>
      <BasicTable
        :columns="tableColumns"
        :data="submissionTable"
        :options="tableOptions"
        :buttons="tableButtons"
        @action="action"
      />
    </template>
  </Card>
  <UploadModal ref="uploadModal" />
  <ConfirmModal ref="deleteConf" />
  <ImportModal ref="importModal" />
  <PublishModal ref="publishModal" />
  <ApplySkillModal
    ref="applySkillModal"
  />
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import UploadModal from "./submission/UploadModal.vue";
import ImportModal from "./submission/ImportModal.vue";
import PublishModal from "./submission/PublishModal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import JSZip from "jszip";
import FileSaver from "file-saver";
import ApplySkillModal from "@/basic/modal/ApplySkillModal.vue";

/**
 * Submission list component
 *
 * This component loads the submission documents for review from the server
 * and provide two ways to import submission documents: one is via manually importing;
 * the other is via importing from Moodle API.
 * @author Linyin Huang, Dennis Zyska, Yiwei Wang
 */
export default {
  name: "DashboardSubmission",
  subscribeTable: [
    {
      table: "submission",
    },
  ],
  components: {
    UploadModal,
    ImportModal,
    ConfirmModal,
    PublishModal,
    Card,
    BasicTable,
    BasicButton,
    ApplySkillModal,
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
      },
      tableColumns: [
        { name: "ID", key: "id" },
        { name: "First Name", key: "firstName" },
        { name: "Last Name", key: "lastName" },
        { name: "Submission ID", key: "extId" },
        { name: "Validation ID", key: "validationConfigurationId" },
        { name: "Created At", key: "createdAt" },
      ],
      tableButtons: [
        {
          icon: "download",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
          title: "Download submission files",
          action: "downloadSubmission",
          stats: {
            submissionId: "id",
          },
        },
        {
          icon: "check-square",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
          title: "Validate Submission",
          action: "validateSubmission",
          stats: {
            documentId: "id",
          },
        },
        {
          icon: "trash",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
          title: "Delete document...",
          action: "deleteDoc",
          stats: {
            documentId: "id",
          },
        },
      ],
    };
  },
  computed: {
    submissions() {
      return this.$store.getters["table/submission/getAll"];
    },
    isProcessingActive() {
      const bgTask = this.$store.getters["service/get"]("BackgroundTaskService", "backgroundTaskUpdate") || {};
      const preprocess = bgTask.preprocess || {};
      return (
        preprocess &&
        preprocess.requests &&
        typeof preprocess.requests === 'object' &&
        Object.keys(preprocess.requests).length > 0
      );
    },
    submissionTable() {
      return this.submissions.map((s) => {
        const user = this.$store.getters["table/user/get"](s.userId);
        return {
          id: s.id,
          extId: s.extId,
          firstName: user ? user.firstName : "Unknown",
          lastName: user ? user.lastName : "Unknown",
          createdAt: new Date(s.createdAt).toLocaleDateString(),
          validationConfigurationId: s.validationConfigurationId ?? "-",
        };
      });
    },
  },  
  mounted() {
    this.$socket.emit("serviceCommand", {
      service: "BackgroundTaskService",
      command: "getBackgroundTask",
      data: {}
    });
  },
  methods: {
    action(data) {
      switch (data.action) {
        case "downloadSubmission":
          this.downloadSubmission(data.params.id);
          break;
        case "deleteDoc":
          this.deleteDoc(data.params);
          break;
      }
    },
    async deleteDoc(row) {
      const studies = this.$store.getters["table/study/getFiltered"]((e) => e.documentId === row.id);
      let warning;
      if (studies && studies.length > 0) {
        warning = ` There ${studies.length !== 1 ? "are" : "is"} currently ${studies.length} ${studies.length !== 1 ? "studies" : "study"}
         running on this document. Deleting it will delete the ${studies.length !== 1 ? "studies" : "study"}!`;
      } else {
        warning = "";
      }

      this.$refs.deleteConf.open("Delete Document", "Are you sure you want to delete the document?", warning, (val) => {
        if (val) {
          this.$socket.emit("documentUpdate", {
            id: row.id,
            deleted: true,
          }, (res) => {
            if (res.success) {
              this.eventBus.emit("toast", {
                title: "Document deleted",
                message: "The document has been deleted",
                variant: "success",
              });
            } else {
              this.eventBus.emit("toast", {
                title: "Failed to delete document",
                message: res.message,
                variant: "danger",
              });
            }
          });
        }
      });
    },
    preprocessGrades() {
      this.$refs.applySkillModal.open();
    },
    async downloadSubmission(submissionId) {
      try {
        // Get all documents for this submission
        const docs = this.$store.getters["table/document/getFiltered"]((d) => d.submissionId === submissionId);

        if (!docs || docs.length === 0) {
          this.eventBus.emit("toast", {
            title: "No documents found",
            message: "This submission has no associated documents to download",
            variant: "warning",
          });
          return;
        }

        // Create a ZIP file to package all documents
        const zip = new JSZip();

        // Get submission info for folder naming
        const submission = this.$store.getters["table/submission/get"](submissionId);
        const user = this.$store.getters["table/user/get"](submission.userId);
        const folderName = `submission_${submission.extId}_${user?.firstName}_${user?.lastName}`;

        // Download each document and add to ZIP
        for (const doc of docs) {
          try {
            // Request document content from server
            const response = await new Promise((resolve, reject) => {
              this.$socket.emit("documentGet", { documentId: doc.id }, (res) => {
                if (res.success) {
                  resolve(res.data);
                } else {
                  reject(new Error(res.message || "Failed to get document"));
                }
              });
            });

            // Determine file extension based on document type
            let fileExtension;
            let fileName;

            switch (doc.type) {
              case 3: // JSON/Config
                fileExtension = ".json";
                break;
              case 4: // ZIP
                fileExtension = ".zip";
                break;
              default:
                fileExtension = ".pdf";
            }

            fileName = `${doc.name}${fileExtension}`;

            // Add file to ZIP
            if (response.file) {
              if (typeof response.file === "string") {
                // If it's a string (like JSON), add as text
                zip.file(`${folderName}/${fileName}`, response.file, { binary: false });
              } else {
                // For binary data
                zip.file(`${folderName}/${fileName}`, response.file, { binary: true });
              }
            } else {
              this.eventBus.emit("toast", {
                title: "Document download issue",
                message: `Could not download ${doc.name}`,
                variant: "warning",
              });
            }
          } catch (error) {
            this.eventBus.emit("toast", {
              title: "Download error",
              message: `Failed to download ${doc.name}: ${error.message}`,
              variant: "danger",
            });
          }
        }

        zip.generateAsync({ type: "blob" }).then((content) => {
          FileSaver.saveAs(content, `${folderName}.zip`);
        });

        this.eventBus.emit("toast", {
          title: "Download complete",
          message: `Downloaded submission ${submission.extId} with ${docs.length} documents`,
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
  },
};
</script>

<style scoped>
.card .card-body {
  padding: 1rem;
}
</style>
