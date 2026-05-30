<template>
  <Card :title="$t('submission.dashboard.title')">
    <template #headerElements>
      <div class="btn-group gap-2">
        <BasicButton
            class="btn-secondary btn-sm"
            :text="$t('submission.dashboard.buttons.assignGroup')"
            :title="$t('submission.dashboard.tooltips.assignGroup')"
            icon="folder-check"
            @click="openAssignModal"
        />

        <BasicButton
            class="btn-secondary btn-sm"
            :text="$t('submission.dashboard.buttons.publishReviews')"
            :title="$t('submission.dashboard.tooltips.publishReviews')"
            icon="upload"
            @click="openPublishModal"
        />

        <BasicButton
            class="btn-secondary btn-sm"
            :text="$t('submission.dashboard.buttons.publishAssessment')"
            :title="$t('submission.dashboard.tooltips.publishAssessment')"
            icon="clipboard-data"
            @click="openPublishAssessmentModal"
        />

        <BasicButton
            class="btn-secondary btn-sm"
            :text="$t('submission.dashboard.buttons.manualImport')"
            :title="$t('submission.dashboard.tooltips.manualImport')"
            icon="file-earmark-arrow-up"
            @click="openUploadModal"
        />

        <BasicButton
            class="btn-primary btn-sm"
            :text="$t('submission.dashboard.buttons.importMoodle')"
            :title="$t('submission.dashboard.tooltips.importMoodle')"
            icon="box-arrow-in-down"
            @click="openImportModal"
        />

        <BasicButton
            :class="isProcessingActive ? 'btn-warning btn-sm position-relative' : 'btn-success btn-sm'"
            :text="isProcessingActive ? $t('submission.dashboard.buttons.viewProcessing') : $t('submission.dashboard.buttons.applySkills')"
            :title="isProcessingActive ? $t('submission.dashboard.tooltips.viewProcessing') : $t('submission.dashboard.tooltips.applySkills')"
            :icon="isProcessingActive ? 'hourglass-split' : 'gear-fill'"
            @click="preprocessGrades"
        >
    <span
        v-if="isProcessingActive"
        class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle">
      <span class="visually-hidden">{{ $t('submission.dashboard.tooltips.processingActive') }}</span>
    </span>
        </BasicButton>
      </div>


    </template>
    <template #body>
      <BasicTable
          :columns="tableColumns"
          :data="submissionTable"
          :options="tableOptions"
          :buttons="tableButtons"
          :max-table-height="'65vh'"
          @action="action"
      />
    </template>
  </Card>
  <UploadModal v-if="modals.upload" ref="uploadModal" @hide="modals.upload = false"/>
  <ConfirmModal v-if="modals.deleteConf" ref="deleteConf" @hide="modals.deleteConf = false"/>
  <ImportModal v-if="modals.import" ref="importModal" @hide="modals.import = false"/>
  <PublishModal v-if="modals.publish" ref="publishModal" @hide="modals.publish = false"/>
  <PublishAssessmentModal v-if="modals.publishAssessment" ref="publishAssessmentModal" @hide="modals.publishAssessment = false"/>
  <AssignModal v-if="modals.assign" ref="assignModal" @hide="modals.assign = false"/>
  <ApplySkillModal v-if="modals.applySkill" ref="applySkillModal" @hide="modals.applySkill = false"/>
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import UploadModal from "./submission/UploadModal.vue";
import ImportModal from "./submission/ImportModal.vue";
import PublishModal from "./submission/PublishModal.vue";
import PublishAssessmentModal from "./submission/PublishAssessmentModal.vue";
import AssignModal from "./submission/AssignModal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import JSZip from "jszip";
import FileSaver from "file-saver";
import ApplySkillModal from "@/basic/modal/ApplySkillModal.vue";
import { resolveApiMessage } from "@/assets/utils";

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
    "user",
  ],
  components: {
    UploadModal,
    ImportModal,
    ConfirmModal,
    PublishModal,
    PublishAssessmentModal,
    AssignModal,
    Card,
    BasicTable,
    BasicButton,
    ApplySkillModal,
  },
  data() {
    return {
      modals: {
        assign: false,
        publish: false,
        publishAssessment: false,
        import: false,
        upload: false,
        applySkill: false,
        deleteConf: false,
      },
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
        search: true,
      },
    };
  },
  computed: {
    tableColumns() {
      return [
        {name: this.$t('submission.dashboard.columns.id'), key: "id"},
        {name: this.$t('submission.dashboard.columns.firstName'), key: "firstName"},
        {name: this.$t('submission.dashboard.columns.lastName'), key: "lastName"},
        {name: this.$t('submission.dashboard.columns.submissionId'), key: "extId"},
        {name: this.$t('submission.dashboard.columns.group'), key: "group", sortable: true},
        {name: this.$t('submission.dashboard.columns.validationId'), key: "validationConfigurationId", sortable: true},
        {name: this.$t('submission.dashboard.columns.createdAt'), key: "createdAt"},
      ];
    },
    tableButtons() {
      return [
        {
          icon: "download",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
          title: this.$t('submission.dashboard.actions.download'),
          action: "downloadSubmission",
          stats: {
            submissionId: "id",
          },
        },
        // TODO: validateSubmission is not yet implemented.
        // {
        //   icon: "check-square",
        //   options: {
        //     iconOnly: true,
        //     specifiers: {
        //       "btn-outline-secondary": true,
        //     },
        //   },
        //   title: "Validate Submission",
        //   action: "validateSubmission",
        //   stats: {
        //     documentId: "id",
        //   },
        // },
        {
          icon: "trash",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
          title: this.$t('submission.dashboard.actions.delete'),
          action: "deleteSubmission",
          stats: {
            submissionId: "id",
          },
        },
      ];
    },
    submissions() {
      return this.$store.getters["table/submission/getAll"].filter((s) => s.parentSubmissionId === null);
    },
    isProcessingActive() {
      const bgTask = this.$store.getters["service/get"]("BackgroundTaskService", "backgroundTaskUpdate") || {};
      const preprocess = bgTask.preprocess || {};
      // Show "View Processing" both when requests are pending OR when completed but not yet confirmed
      const hasActiveRequests = (
          preprocess.requests &&
          typeof preprocess.requests === 'object' &&
          Object.keys(preprocess.requests).length > 0
      );
      const isCompletedAwaitingConfirmation = preprocess.completed === true;
      return hasActiveRequests || isCompletedAwaitingConfirmation;
    },
    submissionTable() {
      return this.submissions.map((s) => {
        const user = this.$store.getters["table/user/get"](s.userId);
        return {
          id: s.id,
          extId: s.extId,
          firstName: user ? user.firstName : this.$t('common.unknown'),
          lastName: user ? user.lastName : this.$t('common.unknown'),
          createdAt: new Date(s.createdAt).toLocaleDateString(),
          validationConfigurationId: s.validationConfigurationId ?? "-",
          group: s.group ?? "-",
        };
      });
    },
  },
  watch: {
    isProcessingActive(val) {
      if (val) {
        this.modals.applySkill = true;
        this.$nextTick(() => this.$refs.applySkillModal?.open());
      }
    },
  },
  mounted() {
    // Get initial state
    this.$socket.emit("serviceCommand", {
      service: "BackgroundTaskService",
      command: "getBackgroundTask",
      data: {}
    });
    // Subscribe to real-time updates
    this.$socket.emit("serviceCommand", {
      service: "BackgroundTaskService",
      command: "subscribeBackgroundTaskUpdates",
      data: {}
    });
  },
  unmounted() {
    // Unsubscribe from updates
    this.$socket.emit("serviceCommand", {
      service: "BackgroundTaskService",
      command: "unsubscribeBackgroundTaskUpdates",
      data: {}
    });
  },
  methods: {
    openAssignModal() {
      this.modals.assign = true;
      this.$nextTick(() => this.$refs.assignModal?.open());
    },
    openPublishModal() {
      this.modals.publish = true;
      this.$nextTick(() => this.$refs.publishModal?.open());
    },
    openPublishAssessmentModal() {
      this.modals.publishAssessment = true;
      this.$nextTick(() => this.$refs.publishAssessmentModal?.open());
    },
    openImportModal() {
      this.modals.import = true;
      this.$nextTick(() => this.$refs.importModal?.open());
    },
    openUploadModal() {
      this.modals.upload = true;
      this.$nextTick(() => this.$refs.uploadModal?.open());
    },
    openApplySkillModal() {
      this.modals.applySkill = true;
      this.$nextTick(() => this.$refs.applySkillModal?.open());
    },
    openDeleteConfModal(name, message, warning, cb) {
      this.modals.deleteConf = true;
      this.$nextTick(() => this.$refs.deleteConf?.open(name, message, warning, cb));
    },
    action(data) {
      switch (data.action) {
        case "downloadSubmission":
          this.downloadSubmission(data.params.id);
          break;
        case "deleteSubmission":
          this.deleteSubmission(data.params);
          break;
      }
    },
    async deleteSubmission(row) {
      let warning = "";
      this.openDeleteConfModal(
        this.$t('submission.dashboard.delete.title'),
        this.$t('submission.dashboard.delete.message'),
        warning,
        (val) => {
          if (val) {
            this.$socket.emit("submissionUpdate", {
              id: row.id,
              deleted: true,
            }, (res) => {
              if (res.success) {
                this.eventBus.emit("toast", {
                  title: this.$t('submission.dashboard.toasts.deleteSuccessTitle'),
                  message: this.$t('submission.dashboard.toasts.deleteSuccessMessage'),
                  variant: "success",
                });
              } else {
                this.eventBus.emit("toast", {
                  title: this.$t('submission.dashboard.toasts.deleteFailedTitle'),
                  message: resolveApiMessage(res),
                  variant: "danger",
                });
              }
            });
          }
      });
    },
    preprocessGrades() {
      this.openApplySkillModal();
    },
    async downloadSubmission(submissionId) {
      try {
        // Get all documents for this submission
        const docs = this.$store.getters["table/document/getFiltered"]((d) => d.submissionId === submissionId);

        if (!docs || docs.length === 0) {
          this.eventBus.emit("toast", {
            title: this.$t('submission.dashboard.toasts.noDocumentsTitle'),
            message: this.$t('submission.dashboard.toasts.noDocumentsMessage'),
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
              this.$socket.emit("documentGet", {documentId: doc.id}, (res) => {
                if (res.success) {
                  resolve(res.data);
                } else {
                  reject(new Error(resolveApiMessage(res) || res.message));
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
                zip.file(`${folderName}/${fileName}`, response.file, {binary: false});
              } else {
                // For binary data
                zip.file(`${folderName}/${fileName}`, response.file, {binary: true});
              }
            } else {
              this.eventBus.emit("toast", {
                title: this.$t('submission.dashboard.toasts.downloadIssueTitle'),
                message: this.$t('submission.dashboard.toasts.downloadIssueMessage', { name: doc.name }),
                variant: "warning",
              });
            }
          } catch (error) {
            this.eventBus.emit("toast", {
              title: this.$t('submission.dashboard.toasts.downloadErrorTitle'),
              message: this.$t('submission.dashboard.toasts.downloadErrorMessage', { name: doc.name, error: error.message }),
              variant: "danger",
            });
          }
        }

        zip.generateAsync({type: "blob"}).then((content) => {
          FileSaver.saveAs(content, `${folderName}.zip`);
        });

        this.eventBus.emit("toast", {
          title: this.$t('submission.dashboard.toasts.downloadCompleteTitle'),
          message: this.$t('submission.dashboard.toasts.downloadCompleteMessage', { id: submission.extId, count: docs.length }),
          variant: "success",
        });
      } catch (error) {
        this.eventBus.emit("toast", {
          title: this.$t('submission.dashboard.toasts.downloadFailedTitle'),
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
