<template>
  <span>
    <Card :title="$t('studies.title')">
      <template #headerElements>
        <StudyToolbar
            @saved-templates="openSavedTemplates"
            @manage-studies="manageStudies"
            @publish-assessment="openPublishAssessment"
            @add-bulk-assignment="addBulkAssignment"
            @add-single-assignment="addSingleAssignment"
            @add="add"
        />
      </template>
      <template #body>
        <StudyTable
            ref="studyTable"
            @action="action"
        />
      </template>
    </Card>
    <StudyModal v-if="modals.studyCoordinator" ref="studyCoordinator" @hide="modals.studyCoordinator = false" @published="refreshStudies"/>
    <StudySessionModal v-if="modals.studySession" ref="studySessionModal" @hide="modals.studySession = false"/>
    <ConfirmModal v-if="modals.deleteConf" ref="deleteConf" @hide="modals.deleteConf = false"/>
    <ConfirmModal v-if="modals.confirm" ref="confirmModal" @hide="modals.confirm = false"/>
    <!-- Stays mounted after closing (the delete confirmation lives inside it); both tables query
         the same socket, so the grid refetches its window when the modal is done. -->
    <ManageStudiesModal v-if="modals.bulkConfirm" ref="bulkConfirmModal" @hide="refreshStudies"/>
    <StudyCloseModal ref="studyCloseModal" />
    <AssignmentModal v-if="modals.assignment" ref="assignmentModal" @hide="modals.assignment = false"/>
    <PublishAssessmentModal v-if="modals.publishAssessment" ref="publishAssessmentModal" @hide="modals.publishAssessment = false"/>
    <InformationModal v-if="modals.information" ref="informationModal" @hide="modals.information = false"/>
    <SavedTemplatesModal v-if="modals.savedTemplates" ref="savedTemplatesModal" @hide="modals.savedTemplates = false"/>
  </span>
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import StudyTable from "@/components/dashboard/study/StudyTable.vue";
import StudyModal from "@/components/dashboard/coordinator/Study.vue";
import StudySessionModal from "@/components/dashboard/study/StudySessionModal.vue";
import StudyToolbar from "@/components/dashboard/study/StudyToolbar.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import AssignmentModal from "@/components/dashboard/study/AssignmentModal.vue";
import InformationModal from "@/basic/modal/InformationModal.vue";
import ManageStudiesModal from "@/components/dashboard/study/ManageStudiesModal.vue";
import StudyCloseModal from "@/components/dashboard/study/StudyCloseModal.vue";
import SavedTemplatesModal from "./study/SavedTemplatesModal.vue";
import { resolveApiMessage } from "@/assets/utils";
import PublishAssessmentModal from "./submission/PublishAssessmentModal.vue";

/**
 * Dashboard component for handling studies
 *
 * @author: Dennis Zyska, Nils Dycke, Manu Sundar Raj Nandyal
 */
export default {
  name: "DashboardStudy",
  components: {
    ManageStudiesModal,
    StudyCloseModal,
    Card,
    StudyTable,
    StudyModal,
    StudySessionModal,
    StudyToolbar,
    ConfirmModal,
    AssignmentModal,
    InformationModal,
    SavedTemplatesModal,
    PublishAssessmentModal
  },
  inject: {
    acceptStats: {
      default: () => false
    }
  },
  props: {},
  // queryTable pages the grid. Do not subscribe the full `study` table.
  // Templates stay in Vuex for Saved Templates / assignments.
  // Documents and study_step load when Edit/Add opens. Sessions load on Inspect.
  subscribeTable: [
    {table: "study", filter: [{key: "template", value: true}]},
    "workflow", "workflow_step", "template"],
  data() {
    return {
      modals: {
        studyCoordinator: false,
        studySession: false,
        deleteConf: false,
        confirm: false,
        bulkConfirm: false,
        assignment: false,
        information: false,
        savedTemplates: false,
        publishAssessment: false,
      },
    }
  },
  computed: {
  },
  methods: {
    openStudyCoordinator(id = 0, linkOnly = false, row = null) {
      this.modals.studyCoordinator = true;
      this.$nextTick(() => this.$refs.studyCoordinator?.open(id, linkOnly, false, false, row));
    },
    openStudySessionModal(studyId, row = null) {
      this.modals.studySession = true;
      this.$nextTick(() => this.$refs.studySessionModal?.open(studyId, row));
    },
    openDeleteConfModal(name, message, warning, cb) {
      this.modals.deleteConf = true;
      this.$nextTick(() => this.$refs.deleteConf?.open(name, message, warning, cb));
    },
    openConfirmModal(name, message, warning, cb) {
      this.modals.confirm = true;
      this.$nextTick(() => this.$refs.confirmModal?.open(name, message, warning, cb));
    },
    openManageStudiesModal() {
      this.modals.bulkConfirm = true;
      this.$nextTick(() => this.$refs.bulkConfirmModal?.open());
    },
    openBulkAssignmentsModal() {
      this.modals.assignment = true;
      this.$nextTick(() => this.$refs.assignmentModal?.open(true));
    },
    openSingleAssignmentModal() {
      this.modals.assignment = true;
      this.$nextTick(() => this.$refs.assignmentModal?.open(false));
    },
    openInformationModal(params) {
      this.modals.information = true;
      this.$nextTick(() => this.$refs.informationModal?.open(params));
    },
    openSavedTemplatesModal() {
      this.modals.savedTemplates = true;
      this.$nextTick(() => this.$refs.savedTemplatesModal?.open());
    },
    action(data) {
      if (data.action === "editStudy") {
        this.studyCoordinator(data.params);
      } else if (data.action === "deleteStudy") {
        this.deleteStudy(data.params);
      } else if (data.action === "openStudy") {
        this.$router.push("/study/" + data.params.hash);
      } else if (data.action === "copyStudyLink") {
        this.copyLink(data.params);
      } else if (data.action === "restartStudy") {
        this.$socket.emit("appDataUpdate", {
          table: "study",
          data: {
            id: data.params.id,
            closed: null
          }
        }, (result) => {
          if (result.success) {
            this.eventBus.emit('toast', {
              title: this.$t('studies.messages.studyRestarted'),
              message: this.$t('studies.messages.studyRestartedMessage'),
              variant: "success"
            });
          } else {
            this.eventBus.emit('toast', {
              title: this.$t('errors.studies.studyRestartFailed'),
              message: resolveApiMessage(result),
              variant: "danger"
            });
          }
        });
      } else if (data.action === "inspectStudySessions") {
        this.openStudySessionModal(data.params.id, data.params);
      } else if (data.action === "closeStudy") {
        this.$refs.studyCloseModal.open(data.params);
      } else if (data.action === "saveAsTemplate") {
        this.saveAsTemplate(data.params);
      } else if (data.action === "showInformation") {
        const {deletedAt, createdAt, firstName, lastName, updatedAt, manage, ...filteredParams} = data.params;
        this.openInformationModal(filteredParams);
      }
    },
    async copyLink(row) {
      if (!row?.hash) {
        this.eventBus.emit('toast', {
          title: this.$t('errors.clipboard.linkNotCopied'),
          message: this.$t('errors.clipboard.retrieveFailed'),
          variant: "danger"
        });
        return;
      }

      const link = window.location.origin + "/study/" + row.hash;
      try {
        await navigator.clipboard.writeText(link);
        this.eventBus.emit('toast', {
          title: this.$t('studies.messages.linkCopied'),
          message: this.$t('studies.messages.linkCopiedMessage'),
          variant: "success"
        });
      } catch (_error) {
        this.eventBus.emit('toast', {
          title: this.$t('errors.clipboard.linkNotCopied'),
          message: this.$t('errors.clipboard.copyFailed'),
          variant: "danger"
        });
      }
    },
    openSavedTemplates() {
      this.openSavedTemplatesModal();
    },
    refreshStudies() {
      this.$refs.studyTable?.refetch();
    },
    openPublishAssessment() {
      this.modals.publishAssessment = true;
      this.$nextTick(() => this.$refs.publishAssessmentModal?.open());
    },
    add() {
      this.openStudyCoordinator(0);
    },
    addBulkAssignment() {
      this.openBulkAssignmentsModal();
    },
    addSingleAssignment() {
      this.openSingleAssignmentModal();
    },
    studyCoordinator(row, linkOnly = false) {
      this.openStudyCoordinator(row.id, linkOnly, row);
    },
    manageStudies() {
      this.openManageStudiesModal();
    },
    saveAsTemplate(study) {
      this.openConfirmModal(
          this.$t('studies.messages.saveAsTemplateTitle'),
          this.$t('studies.messages.saveAsTemplateConfirm'),
          "",
          (confirmed) => {
            if (confirmed) {
              this.$socket.emit("studySaveAsTemplate", {id: study.id}, (result) => {
                if (!result.success) {
                  this.eventBus.emit('toast', {
                    title: this.$t('errors.studies.templateSaveFailed'),
                    message: resolveApiMessage(result),
                    variant: "danger",
                  });
                } else {
                  this.eventBus.emit('toast', {
                    title: this.$t('studies.messages.templateSaved'),
                    message: this.$t('studies.messages.templateSavedMessage'),
                    variant: "success",
                  });
                }
              });
            }
          }
      );
    },
    async deleteStudy(row) {
      // Session count from queryTable enrich (row.sessions), not Vuex study_session.
      const sessionCount = Number(row.sessions) || 0;
      let warning;
      if (sessionCount > 0) {
        warning = this.$t('studies.messages.sessionWarning', { count: sessionCount });
      } else {
        warning = "";
      }

      this.openDeleteConfModal(
          this.$t('studies.messages.deleteTitle'),
          this.$t('studies.messages.deleteConfirm'),
          warning,
          (val) => {
            if (val) {
              this.$socket.emit("appDataUpdate", {
                table: "study",
                data: {
                  id: row.id,
                  deleted: true
                }
              }, (result) => {
                if (result.success) {
                  this.eventBus.emit('toast', {
                    title: this.$t('studies.messages.studyDeleted'),
                    message: this.$t('studies.messages.studyDeletedMessage'),
                    variant: "success"
                  });
                } else {
                  this.eventBus.emit('toast', {
                    title: this.$t('errors.studies.studyDeleteFailed'),
                    message: resolveApiMessage(result),
                    variant: "danger"
                  });
                }
              });
            }
          }
      );
    },
  }
}
</script>

<style scoped>
.card .card-body {
  padding: 1rem;
}
</style>
