<template>
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
      @action="$emit('action', $event)"
  />
</template>

<script>
import BackendTable from "@/basic/BackendTable.vue";
import { dashboardRowAction, dashboardRowButton } from "@/basic/dashboard/actions.js";
import {NUMERIC_OPERATORS, NUMERIC_OPERATORS_NE} from "@/basic/table/searchTokens.js";

/**
 * Server-paged grid of the studies in the default project, with search tokens,
 * the dashboard ownership scope, and per-row study actions (emitted as `action`).
 *
 * @author: Dennis Zyska, Nils Dycke, Manu Sundar Raj Nandyal
 */
export default {
  name: "StudyTable",
  components: { BackendTable },
  emits: ["action"],
  data() {
    return {
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
    };
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
  },
  methods: {
    /**
     * Re-fetch the visible page, e.g. after a modal changed studies.
     * @returns {void}
     */
    refetch() {
      this.$refs.studiesBackendTable?.refetchCurrentWindow?.();
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
  },
};
</script>
