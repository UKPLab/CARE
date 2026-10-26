<template>
  <span>
    <Card
        class="study-dashboard"
        :title="$t('studies.title')"
    >
      <template #title>
        <span class="study-dashboard-title">{{ $t('studies.title') }}</span>
      </template>
      <template #headerElements>
        <div class="study-header-actions">
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
          <span
              class="study-header-sep"
              aria-hidden="true"
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
            :query-scope="studyQueryScope"
            :query-scope-matcher="dashboardScopeMatcher"
            :query-filter-schema="studyFilterSchema"
            :query-search-columns="studySearchColumns"
            :enrich-row="(row) => enrichStudyRow(row)"
            :options="options"
            :buttons="buttons"
            :max-table-height="'65vh'"
            :card-mode="viewMode === 'cards'"
            @action="action"
        >
          <template #additional-buttons>
            <div
                class="study-view-toggle"
                role="group"
                :aria-label="$t('studies.cards.viewToggle')"
                :class="{ 'is-table': viewMode === 'table' }"
            >
              <span
                  class="study-view-toggle-thumb"
                  aria-hidden="true"
              />
              <button
                  type="button"
                  class="study-view-toggle-btn"
                  :class="{ active: viewMode === 'cards' }"
                  :title="$t('studies.cards.cardView')"
                  :aria-pressed="viewMode === 'cards'"
                  @click="setViewMode('cards')"
              >
                <LoadIcon
                    icon-name="grid-3x2-gap"
                    :size="15"
                />
              </button>
              <button
                  type="button"
                  class="study-view-toggle-btn"
                  :class="{ active: viewMode === 'table' }"
                  :title="$t('studies.cards.tableView')"
                  :aria-pressed="viewMode === 'table'"
                  @click="setViewMode('table')"
              >
                <LoadIcon
                    icon-name="table"
                    :size="15"
                />
              </button>
            </div>
          </template>
          <template #cards="cards">
            <StudyCardGrid
                :rows="cards.rows"
                :total="cards.total"
                :loading="cards.loading"
                :loading-visible="cards.loadingVisible"
                :row-buttons="cards.rowButtons"
                :row-state="cards.rowState"
                :on-action="cards.onAction"
                :show-owner="canReadPrivateInformation"
                :searching="cards.searching"
                :search-text="cards.searchText"
                :filter-labels="cards.filterLabels"
                :clear-search="cards.clearSearch"
                :on-create="add"
            />
          </template>
          <template #empty="empty">
            <div
                v-if="!empty.loading || empty.searching"
                class="study-table-empty"
            >
              <StudyEmptyState
                  :searching="empty.searching"
                  :search-text="empty.searchText"
                  :filter-labels="empty.filterLabels"
                  :can-create="true"
                  compact
                  @clear="empty.clearSearch()"
                  @create="add"
              />
            </div>
          </template>
        </BackendTable>
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
// Self-hosted (bundled by Vite, no third-party font CDN), SIL Open Font License 1.1.
import "@fontsource-variable/inter/opsz.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
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
import StudyCardGrid from "./study/StudyCardGrid.vue";
import StudyEmptyState from "./study/StudyEmptyState.vue";
import LoadIcon from "@/basic/Icon.vue";
import { dashboardRowAction, dashboardRowButton } from "@/basic/dashboard/actions.js";
import {NUMERIC_OPERATORS, NUMERIC_OPERATORS_NE} from "@/basic/table/searchTokens.js";

const STUDY_VIEW_STORAGE_KEY = "care.studyDashboardView";

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
    PublishAssessmentModal,
    StudyCardGrid,
    StudyEmptyState,
    LoadIcon,
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
      viewMode: this.initialViewMode(),
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
        striped: false,
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
        // Manage column: main actions as icons, the rest (and destructive ones, last) behind "more"
        rowActions: {
          maxInline: 3,
          inline: ["openStudy", "copyStudyLink", "inspectStudySessions"],
          menuOnly: ["editStudy", "restartStudy"],
        },
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
        id: {label: this.$t('common.id'), type: "numeric", operators: NUMERIC_OPERATORS},
        createdAt: {label: this.$t('studies.columns.created'), type: "date"},
        sessions: {label: this.$t('studies.columns.sessions'), type: "numeric", operators: NUMERIC_OPERATORS_NE},
        limitSessions: {label: this.$t('studies.columns.sessionLimit'), type: "numeric", operators: NUMERIC_OPERATORS_NE},
        limitSessionsPerUser: {label: this.$t('studies.columns.sessionLimitPerUser'), type: "numeric", operators: NUMERIC_OPERATORS_NE},
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
    /**
     * Dashboard ownership rule, applied server-side: without
     * fullAccess, only studies the viewer runs.
     */
    studyQueryScope() {
      return {dashboard: true};
    },
    canViewAllStudies() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.fullAccess");
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
              "closed": "badge-violet",
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
            classMapping: { true: "bg-success", false: "bg-secondary" }
          }
        },
        {
          name: this.$t('studies.columns.resumable'),
          key: "resumable",
          type: "badge",
          typeOptions: {
            keyMapping: {true: this.$t('common.yes'), false: this.$t('common.no')},
            classMapping: {true: "bg-success", false: "bg-secondary"}
          }
        },
        {
          name: this.$t('studies.columns.collaborative'),
          key: "collab",
          type: "badge",
          typeOptions: {
            keyMapping: {true: this.$t('common.yes'), false: this.$t('common.no')},
            classMapping: {true: "bg-success", false: "bg-secondary"}
          }
        },
        {
          name: this.$t('studies.columns.multipleSubmissions'),
          key: "multipleSubmit",
          type: "badge",
          typeOptions: {
            keyMapping: {true: this.$t('common.yes'), false: this.$t('common.no')},
            classMapping: {true: "bg-success", false: "bg-secondary"}
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
    /**
     * Last view the user picked; otherwise cards for owners of their own studies and the
     * table for full-access users, who usually see many more rows.
     * @returns {"cards"|"table"}
     */
    initialViewMode() {
      try {
        const saved = localStorage.getItem(STUDY_VIEW_STORAGE_KEY);
        if (saved === "cards" || saved === "table") return saved;
      } catch (_error) {
        // Storage blocked (e.g. embedded): fall through to the default.
      }
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.fullAccess") ? "table" : "cards";
    },
    setViewMode(mode) {
      this.viewMode = mode;
      try {
        localStorage.setItem(STUDY_VIEW_STORAGE_KEY, mode);
      } catch (_error) {
        // Not persisted; the choice still holds for this visit.
      }
    },
    /**
     * Client mirror of the dashboard scope for live rows
     * Same rule as study.getQueryTableScopeFilter
     * @param {Object} row raw study row from a Delta
     * @returns {boolean|undefined} undefined when the row lacks the ownership columns
     */
    dashboardScopeMatcher(row) {
      if (this.canViewAllStudies) {
        return true;
      }
      if (!row || !("createdByUserId" in row) || !("userId" in row)) {
        return undefined;
      }
      return (row.createdByUserId === null && row.userId === this.userId)
          || row.createdByUserId === this.userId;
    },
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
/* ======================================================================
   Study dashboard shell: page background, header and view toggle. Table,
   search and pagination look comes from the shared basic/table components.
   ====================================================================== */

.study-dashboard {
  --sd-radius: 16px;
  --sd-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --sd-border: rgba(15, 23, 42, 0.08);
  --sd-panel: var(--bs-body-bg);
  --sd-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px -12px rgba(15, 23, 42, 0.12);
  --sd-panel-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.05);
  --sd-ghost-hover: rgba(255, 255, 255, 0.85);
  --sd-bg:
    radial-gradient(1100px 360px at 0% -8%, rgba(var(--bs-primary-rgb), 0.075), transparent 62%),
    radial-gradient(900px 420px at 100% -16%, rgba(var(--care-violet-rgb), 0.075), transparent 60%),
    linear-gradient(180deg, #f7f8fc 0%, #f2f4f9 100%);

  font-family: "Inter Variable", "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system,
    "Helvetica Neue", Roboto, sans-serif;
  font-optical-sizing: auto;
  font-feature-settings: "cv01", "cv11", "ss03";
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  border: 1px solid var(--sd-border);
  border-radius: var(--sd-radius);
  background: var(--sd-bg);
  box-shadow: var(--sd-shadow);
}

[data-bs-theme="dark"] .study-dashboard {
  --sd-border: rgba(255, 255, 255, 0.08);
  --sd-panel: color-mix(in srgb, var(--bs-body-bg) 95%, #ffffff 5%);
  --sd-shadow: 0 1px 0 rgba(255, 255, 255, 0.03) inset, 0 12px 32px -16px rgba(0, 0, 0, 0.7);
  --sd-panel-shadow: 0 1px 0 rgba(255, 255, 255, 0.03) inset, 0 1px 2px rgba(0, 0, 0, 0.4);
  --sd-ghost-hover: rgba(255, 255, 255, 0.07);
  --sd-bg:
    radial-gradient(1100px 360px at 0% -8%, color-mix(in srgb, var(--care-accent) 8%, transparent), transparent 62%),
    radial-gradient(900px 420px at 100% -16%, rgba(var(--care-violet-rgb), 0.09), transparent 60%),
    color-mix(in srgb, var(--bs-body-bg) 90%, #000000 10%);
}

/* ---------- Header ---------- */

.study-dashboard :deep(.card-header) {
  gap: 1rem;
  flex-wrap: wrap;
  padding: 1.15rem 1.35rem 0.4rem;
  background: transparent;
  border-bottom: 0;
}

.study-dashboard :deep(.card-header .card-title) {
  margin: 0;
}

.study-dashboard :deep(.card-body) {
  padding: 0.85rem 1.35rem 1.35rem;
  background: transparent;
}

.study-dashboard-title {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.022em;
  color: var(--bs-emphasis-color);
}

.study-header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
}

/* Secondary header actions: quiet ghost buttons; one filled primary at the end. */
.study-header-actions :deep(.btn) {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.38rem 0.7rem;
  font-size: 0.82rem;
  font-weight: 500;
  border-radius: 8px;
  transition: background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.15s var(--sd-ease);
}

.study-header-actions :deep(.btn:active) {
  transform: scale(0.97);
}

.study-header-actions :deep(.btn-secondary) {
  --bs-btn-bg: transparent;
  --bs-btn-border-color: transparent;
  --bs-btn-color: var(--bs-body-color);
  --bs-btn-hover-bg: var(--sd-ghost-hover);
  --bs-btn-hover-border-color: var(--sd-border);
  --bs-btn-hover-color: var(--bs-emphasis-color);
  --bs-btn-active-bg: var(--sd-ghost-hover);
  --bs-btn-active-border-color: var(--sd-border);
  --bs-btn-active-color: var(--bs-emphasis-color);
  --bs-btn-focus-shadow-rgb: var(--bs-primary-rgb);
}

.study-header-actions :deep(.btn-secondary:hover) {
  box-shadow: var(--sd-panel-shadow);
}

.study-header-actions :deep(.btn-secondary svg) {
  color: var(--bs-secondary-color);
  transition: color 0.2s ease;
}

.study-header-actions :deep(.btn-secondary:hover svg) {
  color: var(--bs-primary);
}

[data-bs-theme="dark"] .study-header-actions :deep(.btn-secondary:hover svg) {
  color: var(--care-accent);
}

.study-header-actions :deep(.btn-primary) {
  padding-inline: 0.85rem;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(var(--bs-primary-rgb), 0.3), 0 6px 16px -6px rgba(var(--bs-primary-rgb), 0.55);
}

.study-header-actions :deep(.btn-primary:hover) {
  filter: brightness(1.06);
  box-shadow: 0 1px 2px rgba(var(--bs-primary-rgb), 0.3), 0 10px 22px -8px rgba(var(--bs-primary-rgb), 0.65);
}

[data-bs-theme="dark"] .study-header-actions :deep(.btn-primary) {
  box-shadow:
    0 1px 2px color-mix(in srgb, var(--care-accent) 30%, transparent),
    0 6px 16px -6px color-mix(in srgb, var(--care-accent) 55%, transparent);
}

[data-bs-theme="dark"] .study-header-actions :deep(.btn-primary:hover) {
  box-shadow:
    0 1px 2px color-mix(in srgb, var(--care-accent) 30%, transparent),
    0 10px 22px -8px color-mix(in srgb, var(--care-accent) 65%, transparent);
}

.study-header-sep {
  width: 1px;
  height: 1.25rem;
  margin: 0 0.35rem;
  background: var(--sd-border);
}

/* ---------- Table view: panel on the tinted page ----------
   Table, search bar, pagination, badges and row actions are styled by the shared
   basic/table components. This page only feeds them its surface colours and puts
   the table into a panel. */

.study-dashboard {
  --table-bg: var(--sd-panel);
  --table-border-color: var(--sd-border);
}

.study-dashboard :deep(.table-scroll-shell) {
  margin-top: 1rem;
  margin-bottom: 1.25rem;
  background: var(--sd-panel);
  border: 1px solid var(--sd-border);
  border-radius: 12px;
  box-shadow: var(--sd-panel-shadow);
  overflow: hidden;
}

/*
 * The shell is the frame now, so the wrapper and table drop their own bottom spacing.
 * The empty row spans every column, which can be wider than the panel. Pin its content to the
 * visible width (container query units of the scroll wrapper) so it stays centred on screen.
 */
.study-dashboard :deep(.table-scroll-shell .table-wrapper) {
  margin-bottom: 0;
  container-type: inline-size;
}

.study-dashboard :deep(.table-scroll-shell .table) {
  margin-bottom: 0;
}

.study-table-empty {
  position: sticky;
  left: 0;
  /* Minus the cell's horizontal padding, or the row itself would cause a horizontal scroll. */
  width: calc(100cqw - 1.6rem);
}

.study-dashboard :deep(.table-wrapper tbody tr:hover > td:has(.study-table-empty)) {
  --bs-table-bg-state: transparent;
}

@media (prefers-reduced-motion: reduce) {
  .study-header-actions :deep(.btn) {
    transition: none;
  }
}

/* Segmented Cards / Table switch at the end of the search bar. */
.study-view-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  margin-left: 0.5rem !important;
  padding: 2px;
  border: 1px solid var(--bs-border-color);
  border-radius: 8px !important;
  background: var(--bs-tertiary-bg);
  isolation: isolate;
}

.study-view-toggle-thumb {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 2px;
  width: calc(50% - 2px);
  border-radius: 6px;
  background: var(--bs-body-bg);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12), 0 1px 1px rgba(15, 23, 42, 0.06);
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  z-index: -1;
}

.study-view-toggle.is-table .study-view-toggle-thumb {
  transform: translateX(100%);
}

[data-bs-theme="dark"] .study-view-toggle-thumb {
  background: color-mix(in srgb, var(--bs-body-bg) 82%, #ffffff 18%);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.study-view-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 1.6rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--bs-secondary-color);
  transition: color 0.2s ease;
}

.study-view-toggle-btn:hover {
  color: var(--bs-emphasis-color);
}

.study-view-toggle-btn.active {
  color: var(--bs-primary);
}

[data-bs-theme="dark"] .study-view-toggle-btn.active {
  color: var(--care-accent);
}

.study-view-toggle-btn:focus-visible {
  outline: 2px solid rgba(var(--bs-primary-rgb), 0.5);
  outline-offset: 1px;
  border-radius: 6px;
}

[data-bs-theme="dark"] .study-view-toggle-btn:focus-visible {
  outline-color: var(--care-accent);
}

@media (prefers-reduced-motion: reduce) {
  .study-view-toggle-thumb {
    transition: none;
  }
}
</style>
