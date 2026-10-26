<template>
  <div class="container-fluid">
    <h1>{{ $t('dashboard.sessionOverview.title') }}</h1>
    <div class="filters-container mb-3">
      <div class="d-flex-col align-items-center gap-3">
        <div class="form-check form-switch">
          <label class="form-check-label" for="showOpenStudiesSwitch">
            {{ $t('dashboard.sessionOverview.showOnlyOpenStudies') }}
          </label>
          <input
            id="showOpenStudiesSwitch"
            v-model="filters.showOpenStudies"
            class="form-check-input"
            type="checkbox"
            role="switch"
          >
        </div>
        <BasicFilterDropdown
          v-model="filters.workflowType"
          :label="$t('dashboard.sessionOverview.filterWorkflowType')"
          icon="diagram-3"
          :options="workflowFilterOptions"
        />
      </div>
    </div>
    <BasicTable
      :columns="columns"
      :data="filteredStudySessions"
      :options="tableOptions"
      :max-table-height="'70vh'"
      @action="handleAction"
    />
  </div>
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import BasicFilterDropdown from "@/basic/FilterDropdown.vue";
import { translateMaybeKey } from "@/assets/utils";

/**
 * Dashboard page showing an overview of all study sessions
 *
 * @author: Karim Ouf
 */
export default {
  name: "SessionOverview",
  components: { BasicTable, BasicFilterDropdown },
  subscribeTable: ["study_session", "study", "workflow", "user", "study_step"],
  data() {
    return {
      filters: {
        showOpenStudies: true,
        workflowType: "all"
      },
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
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
              Running: "bg-primary",
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
    studySessions() {
      const sessions = this.$store.getters["table/study_session/getAll"] || [];
      const studies = this.$store.getters["table/study/getAll"] || [];

      return sessions.map((session) => {
        const study = studies.find(s => s.id === session.studyId);
        const currentStepIndex = this.$store.getters["table/study_step/get"](session.studyStepIdMax)?.stepNumber ?? null;
        const studySteps = this.$store.getters["table/study_step/getFiltered"](
          (step) => step.studyId === session.studyId
        );

        return {
          id: session.id,
          studyId: session.studyId,
          studyName: study.name,
          firstName: this.getUserName(session.userId).firstName,
          lastName: this.getUserName(session.userId).lastName,
          currentStep: currentStepIndex !== null
            ? this.$t('dashboard.sessionOverview.step', { number: currentStepIndex })
            : this.$t('common.na'),
          createdAt: new Date(session.createdAt).toLocaleString(),
          updatedAt: new Date(session.updatedAt).toLocaleString(),
          numSteps: studySteps.length,
          status: session.end === null ? "Running" : "Finished",
          hash: session.hash,
        };
      });
    },
    filteredStudySessions() {
      return this.studySessions.filter(session => {
        const study = this.$store.getters["table/study/get"](session.studyId);
        if (!study) return false;

        if (this.filters.showOpenStudies && study.closed !== null) {
          return false;
        }
        if (!this.filters.showOpenStudies && study.closed === null) {
          return false;
        }

        if (this.filters.workflowType !== "all" &&
            study.workflowId.toString() !== this.filters.workflowType) {
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
.filters-container {
  padding: .625rem .875rem;
  background-color: var(--bs-tertiary-bg, #f8f9fa);
  border: 1px solid var(--bs-border-color-translucent);
  border-radius: var(--bs-border-radius-lg, .75rem);
}

.filters-container > div {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: .75rem 1.5rem;
}

.filters-container .form-check {
  margin-bottom: 0;
}
</style>
