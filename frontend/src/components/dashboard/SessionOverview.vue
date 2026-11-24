<template>
  <DashboardListPage
    :title="$t('dashboard.sessionOverview.title')"
    :columns="columns"
    :data="filteredStudySessions"
    :table-options="tableOptions"
    @action="handleAction"
  >
    <template #headerActions>
      <div class="dashboard-filters">
        <div class="form-check form-switch mb-0">
          <input
            id="showOpenStudiesSwitch"
            v-model="filters.showOpenStudies"
            class="form-check-input"
            type="checkbox"
            role="switch"
          >
          <label class="form-check-label" for="showOpenStudiesSwitch">
            {{ $t('dashboard.sessionOverview.showOnlyOpenStudies') }}
          </label>
        </div>
        <BasicFilterDropdown
          v-model="filters.workflowType"
          :label="$t('dashboard.sessionOverview.filterWorkflowType')"
          icon="diagram-3"
          :options="workflowFilterOptions"
        />
      </div>
    </template>
  </DashboardListPage>
</template>

<script>
import DashboardListPage from "@/basic/dashboard/ListPage.vue";
import BasicFilterDropdown from "@/basic/FilterDropdown.vue";
import { DEFAULT_DASHBOARD_TABLE_OPTIONS } from "@/basic/dashboard/constants.js";
import { translateMaybeKey } from "@/assets/utils";
import { tableRowsSnapshot } from "@/store/utils";

// Same output as `new Date(value).toLocaleString()` (browser locale, date + time), but one
// formatter for all rows instead of a new one per call.
const BROWSER_DATE_TIME = new Intl.DateTimeFormat(undefined, {
  year: "numeric", month: "numeric", day: "numeric",
  hour: "numeric", minute: "numeric", second: "numeric",
});
function formatBrowserDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Invalid Date" : BROWSER_DATE_TIME.format(date);
}

/**
 * Dashboard page showing an overview of all study sessions
 *
 * @author: Karim Ouf
 */
export default {
  name: "SessionOverview",
  components: { DashboardListPage, BasicFilterDropdown },
  subscribeTable: ["study_session", "study", "workflow", "user", "study_step"],
  data() {
    return {
      filters: {
        showOpenStudies: true,
        workflowType: "all"
      },
      tableOptions: {
        ...DEFAULT_DASHBOARD_TABLE_OPTIONS,
        pagination: 20,
        search: true,
      },
    };
  },

  computed: {
    columns() {
      return [
        { name: this.$t('dashboard.sessionOverview.columns.studyName'), key: "studyName", sortable: true },
        { name: this.$t('common.firstName'), key: "firstName", sortable: true },
        { name: this.$t('common.lastName'), key: "lastName", sortable: true },
        { name: this.$t('dashboard.sessionOverview.columns.maxStep'), key: "currentStep", sortable: true },
        { name: this.$t('common.createdAt'), key: "createdAt", sortable: true },
        { name: this.$t('common.updatedAt'), key: "updatedAt", sortable: true },
        { name: this.$t('dashboard.sessionOverview.columns.numberOfSteps'), key: "numSteps", sortable: true },
        {
          name: this.$t('common.status'),
          key: "status",
          type: "badge",
          sortable: true,
          typeOptions: {
            keyMapping: {
              Running: this.$t('common.running'),
              Finished: this.$t('common.finished'),
            },
            classMapping: {
              Running: "badge-care-primary",
              Finished: "bg-success",
            }
          }
        },
      ];
    },
    workflowTypes() {
      return (this.$store.getters["table/workflow/getAll"] || []).map((workflow) => ({
        ...workflow,
        name: translateMaybeKey(workflow.name),
      }));
    },
    workflowFilterOptions() {
      return [
        { value: "all", label: this.$t('dashboard.sessionOverview.allWorkflows') },
        ...this.workflowTypes.map((wf) => ({ value: wf.id.toString(), label: wf.name })),
      ];
    },
    /**
     * One row per session. Lookups go through maps built once per recompute: the previous
     * version ran studies.find() and a filter over all study steps for every session, i.e.
     * sessions x studies work (tens of thousands of studies), each access tracked by Vue's
     * reactivity, and redone on any change of the five subscribed tables. On a slow CPU that
     * froze the page for tens of seconds.
     */
    studySessions() {
      // Snapshots instead of getAll: the study table holds tens of thousands of rows, and
      // getAll made Vue track every one of them (seconds per data batch on a slow CPU).
      const sessions = tableRowsSnapshot(this.$store, "study_session");
      const studies = tableRowsSnapshot(this.$store, "study");
      const steps = tableRowsSnapshot(this.$store, "study_step");

      const studyById = new Map();
      for (const study of studies) studyById.set(study.id, study);
      const stepNumberById = new Map();
      const stepCountByStudy = new Map();
      for (const step of steps) {
        stepNumberById.set(step.id, step.stepNumber);
        stepCountByStudy.set(step.studyId, (stepCountByStudy.get(step.studyId) || 0) + 1);
      }

      return sessions.map((session) => {
        const study = studyById.get(session.studyId);
        const currentStepIndex = stepNumberById.get(session.studyStepIdMax) ?? null;
        const user = this.getUserName(session.userId);

        return {
          id: session.id,
          studyId: session.studyId,
          // For filteredStudySessions (kept out of the columns).
          studyClosed: study ? study.closed : undefined,
          studyWorkflowId: study?.workflowId,
          studyName: study?.name,
          firstName: user.firstName,
          lastName: user.lastName,
          currentStep: currentStepIndex !== null
            ? this.$t('dashboard.sessionOverview.step', { number: currentStepIndex })
            : this.$t('common.na'),
          createdAt: formatBrowserDateTime(session.createdAt),
          updatedAt: formatBrowserDateTime(session.updatedAt),
          numSteps: stepCountByStudy.get(session.studyId) || 0,
          status: session.end === null ? "Running" : "Finished",
          hash: session.hash,
        };
      });
    },
    filteredStudySessions() {
      return this.studySessions.filter(session => {
        // Study fields come with the row (studySessions); undefined = study not loaded.
        if (session.studyClosed === undefined) return false;

        if (this.filters.showOpenStudies && session.studyClosed !== null) {
          return false;
        }
        if (!this.filters.showOpenStudies && session.studyClosed === null) {
          return false;
        }

        if (this.filters.workflowType !== "all" &&
            String(session.studyWorkflowId) !== this.filters.workflowType) {
          return false;
        }

        return true;
      });
    },
  },
  methods: {
    getWorkflowType(workflowId) {
      const workflow = this.$store.getters["table/workflow/get"](workflowId);
      return workflow ? translateMaybeKey(workflow.name) : this.$t('common.unknown');
    },
    getUserName(userId) {
      const user = this.$store.getters["table/user/get"](userId);
      if (user) {
        return {
          firstName: user.firstName,
          lastName: user.lastName,
        };
      }
      return {
        firstName: this.$t('common.unknown'),
        lastName: "",
      };
    },
    handleAction({ action, params }) {
      if (action === "openSession") {
        this.openSession(params);
      }
    },
    openSession(session) {
      if (session.hash) {
        this.$router.push("/study/" + session.hash);
      }
    },
  },
};
</script>

<style scoped>
.dashboard-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .5rem 1rem;
}
</style>
