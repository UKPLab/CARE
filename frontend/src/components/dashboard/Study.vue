<template>
  <span>
    <Card :title="$t('studies.title')">
      <template #headerElements>
        <div class="btn-group gap-2">
          <BasicButton
              class="btn-secondary btn-sm"
              :title="$t('studies.savedTemplates')"
              :text="$t('studies.savedTemplates')"
              icon="folder"
              @click="openSavedTemplates"
          />
          <BasicButton
              v-if="canManageStudies"
              class="btn-secondary btn-sm"
              :title="$t('studies.manageStudies')"
              :text="$t('studies.manageStudies')"
              icon="gear-fill"
              @click="manageStudies"
          />
           <BasicButton
            class="btn-secondary btn-sm"
            :title="$t('submission.publishAssessment.title')"
            :text="$t('submission.publishAssessment.title')"
            icon="clipboard-data"
            @click="openPublishAssessment"
          />
          <BasicButton
              v-if="canAddBulkAssignments"
              class="btn-secondary btn-sm"
              :title="$t('studies.addBulkAssignments')"
              :text="$t('studies.addBulkAssignments')"
              icon="stack"
              @click="addBulkAssignment"
          />
          <BasicButton
              v-if="isAdmin"
              class="btn-secondary btn-sm"
              :title="$t('studies.addSingleAssignment')"
              :text="$t('studies.addSingleAssignment')"
              icon="plus-square"
              @click="addSingleAssignment"
          />
          <BasicButton
              class="btn-primary btn-sm"
              :title="$t('common.add')"
              :text="$t('common.add')"
              icon="plus"
              @click="add"
          />
        </div>
      </template>
      <template #body>
        <BackendTable
            ref="studiesBackendTable"
            table="study"
            :columns="columns"
            :query-filter="studyQueryFilter"
            :query-filter-schema="studyFilterSchema"
            :query-search-columns="studySearchColumns"
            :enrich-row="(row) => enrichStudyRow(row)"
            :options="options"
            :buttons="buttons"
            :max-table-height="'65vh'"
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
import BackendTable from "@/basic/BackendTable.vue";
import StudyModal from "@/components/dashboard/coordinator/Study.vue";
import StudySessionModal from "@/components/dashboard/study/StudySessionModal.vue";
import BasicButton from "@/basic/Button.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import AssignmentModal from "@/components/dashboard/study/AssignmentModal.vue";
import InformationModal from "@/basic/modal/InformationModal.vue";
import ManageStudiesModal from "@/components/dashboard/study/ManageStudiesModal.vue";
import StudyCloseModal from "@/components/dashboard/study/StudyCloseModal.vue";
import SavedTemplatesModal from "./study/SavedTemplatesModal.vue";
import { resolveApiMessage } from "@/assets/utils";
import PublishAssessmentModal from "./submission/PublishAssessmentModal.vue";
import { dashboardRowAction, dashboardRowButton } from "@/basic/dashboard/actions.js";

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
    BackendTable,
    StudyModal,
    StudySessionModal,
    BasicButton,
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
      options: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: {
          serverSide: true,
          itemsPerPage: 10,
          total: 0,
        },
        search: true,
        sort: {column: "createdAt", order: "DESC"},
      },
    }
  },
  computed: {
    /**
     * Filter tokens offered by the table search bar. Mirrors study.getQueryTableFilterColumns —
     * the backend drops anything it does not know, so a key added here needs the model too.
     */
    studyFilterSchema() {
      return {
        state: {
          label: this.$t('studies.columns.status'),
          type: "enum",
          options: [
            {value: "not started", label: this.$t('studies.status.notStarted')},
            {value: "running", label: this.$t('studies.status.running')},
            {value: "closed", label: this.$t('studies.status.closed')},
            {value: "ended", label: this.$t('studies.status.ended')},
          ],
        },
        id: {label: this.$t('common.id'), type: "numeric", operators: ["=", ">", ">=", "<", "<=", "%"]},
        createdAt: {label: this.$t('studies.columns.created'), type: "date"},
        sessions: {label: this.$t('studies.columns.sessions'), type: "numeric", operators: ["=", "!=", ">", ">=", "<", "<=", "%"]},
        limitSessions: {label: this.$t('studies.columns.sessionLimit'), type: "numeric", operators: ["=", "!=", ">", ">=", "<", "<=", "%"]},
        limitSessionsPerUser: {label: this.$t('studies.columns.sessionLimitPerUser'), type: "numeric", operators: ["=", "!=", ">", ">=", "<", "<=", "%"]},
        collab: {label: this.$t('studies.columns.collaborative'), type: "boolean"},
        resumable: {label: this.$t('studies.columns.resumable'), type: "boolean"},
        multipleSubmit: {label: this.$t('studies.columns.multipleSubmissions'), type: "boolean"},
        enableEmailNotifications: {label: this.$t('studies.columns.sessionStartFinishEmails'), type: "boolean"},
      };
    },
    /**
     * Free text stays on the columns this grid shows. The model also allows workflowName
     * (Manage Studies lists a Workflow column); without this the grid would match on a title
     * it does not display.
     */
    studySearchColumns() {
      const columns = ["id", "name", "sessions", "state"];
      if (this.canReadPrivateInformation) {
        columns.push("firstName", "lastName");
      }
      return columns;
    },
    studyQueryFilter() {
      return [
        {key: "projectId", value: this.projectId},
        {key: "template", value: false},
      ];
    },
    projectId() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    showInformationButton() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.admin");
    },
    buttons() {
      const buttons = [
        dashboardRowAction("edit", {
          title: this.$t('studies.editStudy'),
          filter: [
            {key: "showEditButton", value: true},
          ],
          action: "editStudy",
          stats: {
            studyId: "id"
          },
        }),
        dashboardRowAction("delete", {
          filter: [
            {key: "showDeleteButton", value: true},
          ],
          title: this.$t('studies.deleteStudy'),
          action: "deleteStudy",
          stats: {
            studyId: "id"
          },
        }),
        dashboardRowAction("open", {
          title: this.$t('studies.openStudy'),
          action: "openStudy",
          stats: {
            studyId: "id"
          },
        }),
        dashboardRowAction("restart", {
          title: this.$t('studies.restartStudy'),
          filter: [
            {key: "showRestartButton", value: true},
          ],
          action: "restartStudy",
          stats: {
            studyId: "id"
          },
        }),
        dashboardRowAction("link", {
          title: this.$t('studies.copyLink'),
          action: "copyStudyLink",
          stats: {
            studyId: "id"
          },
        }),
        dashboardRowAction("sessions", {
          title: this.$t('studies.inspectSessions'),
          action: "inspectStudySessions",
          stats: {
            studyId: "id"
          },
        }),
        dashboardRowAction("close", {
          filter: [
            {key: "showCloseButton", value: true},
          ],
          title: this.$t('studies.closeStudy'),
          action: "closeStudy",
          stats: {
            studyId: "id"
          },
        }),
        dashboardRowButton("save", {
          filter: [
            {key: "showTemplateButton", value: true},
          ],
          title: this.$t('studies.saveAsTemplate'),
          action: "saveAsTemplate",
          stats: {
            studyId: "id"
          },
        }),
      ];
      if (this.showInformationButton) {
        buttons.push(dashboardRowButton("arrows-angle-expand", {
          title: this.$t('studies.showInformation'),
          action: "showInformation",
          stats: {
            studyId: "id"
          },
        }));
      }
      return buttons;
    },
    columns() {
      let cols = [
        {name: this.$t('common.id'), key: "id", fixed: "left", style: {minWidth: "4.5rem", whiteSpace: "nowrap"} },
        {name: this.$t('common.name'), key: "name", fixed: "left", scroll: true, maxChars: 40 },
        {
          name: this.$t('studies.columns.status'),
          key: "state",
          sortable: true,
          type: "badge",
          typeOptions: {
            keyMapping: {
              "not started": this.$t('studies.status.notStarted'),
              "closed": this.$t('studies.status.closed'),
              "running": this.$t('studies.status.running'),
              "ended": this.$t('studies.status.ended'),
            },
            classMapping: {
              "not started": "bg-warning",
              "closed": "bg-secondary",
              "running": "bg-success",
              "ended": "bg-danger",
            }
          }
        },
        {name: this.$t('studies.columns.created'), key: "createdAt", sortable: true, type: "datetime"},
        //{name: "Time Limit", key: "timeLimit", sortable: true},
        {name: this.$t('studies.columns.sessions'), key: "sessions", sortable: true},
        {name: this.$t('studies.columns.sessionLimit'), key: "limitSessions", sortable: true},
        {name: this.$t('studies.columns.sessionLimitPerUser'), key: "limitSessionsPerUser", sortable: true},
        {
          name: this.$t('studies.columns.sessionStartFinishEmails'),
          key: "enableEmailNotifications",
          type: "badge",
          typeOptions: {
            keyMapping: { true: this.$t('common.yes'), false: this.$t('common.no') },
            classMapping: { true: "bg-success", false: "bg-danger" }
          }
        },
        {
          name: this.$t('studies.columns.resumable'),
          key: "resumable",
          type: "badge",
          typeOptions: {
            keyMapping: {true: this.$t('common.yes'), false: this.$t('common.no')},
            classMapping: {true: "bg-success", false: "bg-danger"}
          }
        },
        {
          name: this.$t('studies.columns.collaborative'),
          key: "collab",
          type: "badge",
          typeOptions: {
            keyMapping: {true: this.$t('common.yes'), false: this.$t('common.no')},
            classMapping: {true: "bg-success", false: "bg-danger"}
          }
        },
        {
          name: this.$t('studies.columns.multipleSubmissions'),
          key: "multipleSubmit",
          type: "badge",
          typeOptions: {
            keyMapping: {true: this.$t('common.yes'), false: this.$t('common.no')},
            classMapping: {true: "bg-success", false: "bg-danger"}
          }
        },
      ];
      if (this.canReadPrivateInformation) {
        cols.splice(3, 0, {name: this.$t('users.columns.firstName'), key: "firstName"});
        cols.splice(4, 0, {name: this.$t('users.columns.lastName'), key: "lastName"});
      }
      return cols;
    },
    isAdmin() {
      return this.$store.getters['auth/isAdmin'];
    },
    canReadPrivateInformation() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.view.userPrivateInfo");
    },
    canAddBulkAssignments() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.addBulkAssignments");
    },
    canAddSingleAssignments() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.addSingleAssignments");
    },
    canManageStudies() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.canManageStudies");
    },
  },
  methods: {
    enrichStudyRow(st) {
      let study = {...st};

      if (study.start !== null && new Date(study.start) > new Date()) {
        study.state = "not started";
      } else if (study.end !== null && new Date(study.end) < new Date()) {
        if (study.multipleSubmit) {
          study.state = study.closed ? "closed" : "running";
        } else {
          study.state = "ended";
        }
      } else {
        study.state = study.closed ? "closed" : "running";
      }

      study.showEditButton = (this.isAdmin || study.userId === this.userId) && !study.closed;
      study.showDeleteButton = this.isAdmin || study.userId === this.userId;
      study.showRestartButton = (this.isAdmin || study.userId === this.userId) && !!study.closed;
      study.showCloseButton = (this.isAdmin || study.userId === this.userId) && !study.closed;
      study.showTemplateButton = this.isAdmin || study.userId === this.userId;
      return study;
    },
    openStudyCoordinator(id = 0, linkOnly = false, row = null) {
      this.modals.studyCoordinator = true;
      this.$nextTick(() => this.$refs.studyCoordinator?.open(id, null, linkOnly, false, false, row));
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
      this.$refs.studiesBackendTable?.refetchCurrentWindow?.();
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
