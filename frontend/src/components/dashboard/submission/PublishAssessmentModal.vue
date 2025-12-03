<template>
  <StepperModal
    ref="assessmentStepper"
    size="xl"
    :steps="steps"
    :validation="stepValid"
    @submit="handleSubmit"
  >
    <template #title>
      <h5 class="modal-title">Publish Assessment</h5>
    </template>

    <!-- STEP 1: Workflow Selection -->
    <template #step-1>
      <div class="mb-3">
        <label class="form-label"><b>Select Workflow:</b></label>
        <p class="small text-muted mb-3">
          Select a workflow to filter related studies for assessment export.
        </p>
        <BasicTable
          v-model="selectedWorkflows"
          :data="workflowsTable"
          :columns="workflowTableColumns"
          :options="singleSelectTableOptions"
          :max-table-height="350"
        />
      </div>
    </template>

    <!-- STEP 2: Configuration Selection -->
    <template #step-2>
      <div class="mb-3">
        <label class="form-label"><b>Select Assessment Configuration:</b></label>
        <p class="small text-muted mb-3">
          Choose which assessment configuration you want to export data for.
        </p>
        <BasicTable
          v-model="selectedConfigurations"
          :data="configurationsTable"
          :columns="configurationTableColumns"
          :options="singleSelectTableOptions"
          :max-table-height="350"
        />
      </div>
    </template>

    <!-- STEP 3: Study Selection -->
    <template #step-3>
      <div class="mb-3">
        <label class="form-label"><b>Select Studies:</b></label>
        <p class="small text-muted mb-3">
          Studies filtered by selected workflow and configuration. Select the studies you want to export.
        </p>
        <div v-if="filteredStudiesTable.length === 0" class="alert alert-warning">
          No studies found matching the selected workflow and configuration.
        </div>
        <BasicTable
          v-else
          v-model="selectedStudies"
          :data="filteredStudiesTable"
          :columns="studyTableColumns"
          :options="multiSelectTableOptions"
          :max-table-height="350"
        />
      </div>
    </template>

    <!-- STEP 4: Session Selection -->
    <template #step-4>
      <div class="mb-3">
        <label class="form-label"><b>Select Sessions:</b></label>
        <p class="small text-muted mb-3">
          Select which study sessions to include in the assessment export.
        </p>
        <div v-if="sessionsTable.length === 0" class="alert alert-warning">
          No sessions found for the selected studies.
        </div>
        <BasicTable
          v-else
          v-model="selectedSessions"
          :data="sessionsTable"
          :columns="sessionTableColumns"
          :options="multiSelectTableOptions"
          :max-table-height="350"
        />
      </div>
    </template>

    <!-- STEP 5: Confirmation -->
    <template #step-5>
      <div class="mb-3">
        <label
          for="linkCollection"
          class="form-label"
        ><b>Link Collection:</b></label>
        <select
          id="linkCollection"
          v-model="linkCollection"
          class="form-select"
        >
          <option value="studies">based on Studies (session links for each study)</option>
          <option value="sessions">based on Sessions (links for own sessions)</option>
        </select>
      </div>
      <div class="mb-3">
        <p><b>Links:</b></p>
        <ul v-if="linkCollection === 'studies'">
          <li
            v-for="study in formattedStudies"
            :key="study.study.id"
          >
            <b>{{ study.study.name }} ({{ study.study.ownerFirstName }} {{ study.study.ownerLastName }})</b>
            <ul>
              <li
                v-for="session in study.sessions"
                :key="session.sessionId"
              >
                {{ session.firstName }} {{ session.lastName }} (<a
                  :href="session.link"
                  target="_blank"
                >{{ session.link }}</a>)
              </li>
            </ul>
          </li>
        </ul>
        <ul v-else-if="linkCollection === 'sessions'">
          <li
            v-for="(sessions, odx) in formattedSessions"
            :key="odx"
          >
            <b>{{ sessions[0].firstName }} {{ sessions[0].lastName }}</b>
            <ul>
              <li
                v-for="s in sessions"
                :key="s.sessionId"
              >
                {{ s.studyName }} (<a
                  :href="s.link"
                  target="_blank"
                >{{ s.link }}</a>)
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </template>

    <!-- STEP 6: Publishing Options -->
    <template #step-6>
      <div class="mb-3">
        <label for="publishMethod" class="form-label"><b>Publishing Method:</b></label>
        <select
          id="publishMethod"
          v-model="publishMethod"
          class="form-select"
        >
          <option
            v-for="opt in publishMethodOptions"
            :key="opt.value"
            :value="opt.value"
            :disabled="opt.disabled"
          >
            {{ opt.label }}
          </option>
        </select>
      </div>
    </template>
  </StepperModal>
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import StepperModal from "@/basic/modal/StepperModal.vue";

/**
 * Modal for publishing assessment data with CSV export
 * @author: CARE Team
 */
export default {
  name: "PublishAssessmentModal",
  components: { BasicTable, StepperModal },
  subscribeTable: [
    { table: "workflow" },
    { table: "workflow_step" },
    { table: "configuration", filter: [{ key: "type", value: 0 }] },
    { table: "study" },
    { table: "study_step" },
    { table: "study_session" },
    { table: "submission" },
    { table: "document" },
    { table: "user" },
    { table: "user_role" },
    { table: "user_role_matching" },
  ],
  data() {
    return {
      selectedWorkflows: [],
      selectedConfigurations: [],
      selectedStudies: [],
      selectedSessions: [],
      publishMethod: "csv",
      linkCollection: "studies",
    };
  },
  computed: {
    steps() {
      return [
        { title: "Workflow" },
        { title: "Configuration" },
        { title: "Study" },
        { title: "Session" },
        { title: "Confirmation" },
        { title: "Publishing" },
      ];
    },
    stepValid() {
      return [
        this.selectedWorkflows.length > 0,
        this.selectedConfigurations.length > 0,
        this.selectedStudies.length > 0,
        this.selectedSessions.length > 0,
        true,
        true,
      ];
    },
    singleSelectTableOptions() {
      return {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        singleSelect: true,
        pagination: false,
        search: true,
      };
    },
    multiSelectTableOptions() {
      return {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        pagination: false,
        search: true,
      };
    },
    // Data sources
    workflows() {
      return this.$store.getters["table/workflow/getAll"] || [];
    },
    configurations() {
      return this.$store.getters["table/configuration/getFiltered"](
        (c) => c.type === 0 && !c.deleted
      ) || [];
    },
    studies() {
      return this.$store.getters["table/study/getFiltered"](
        (s) => s.closed && !s.template
      ) || [];
    },
    studySteps() {
      return this.$store.getters["table/study_step/getAll"] || [];
    },
    studySessions() {
      return this.$store.getters["table/study_session/getAll"] || [];
    },
    submissions() {
      return this.$store.getters["table/submission/getAll"] || [];
    },
    documents() {
      return this.$store.getters["table/document/getAll"] || [];
    },
    users() {
      return this.$store.getters["table/user/getAll"] || [];
    },
    userRoles() {
      return this.$store.getters["table/user_role/getAll"] || [];
    },
    userRoleMatchings() {
      return this.$store.getters["table/user_role_matching/getAll"] || [];
    },

    // Table data
    workflowsTable() {
      return this.workflows.map((w) => ({
        ...w,
        id: w.id,
        name: w.name || `Workflow ${w.id}`,
        description: w.description || "-",
      }));
    },
    workflowTableColumns() {
      return [
        { name: "ID", key: "id" },
        { name: "Name", key: "name" },
        { name: "Description", key: "description" },
      ];
    },
    configurationsTable() {
      return this.configurations.map((c) => ({
        ...c,
        id: c.id,
        name: c.name,
        createdAt: c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "-",
      }));
    },
    configurationTableColumns() {
      return [
        { name: "ID", key: "id" },
        { name: "Name", key: "name" },
        { name: "Created", key: "createdAt" },
      ];
    },
    
    // Selected values for display
    selectedWorkflowName() {
      if (this.selectedWorkflows.length === 0) return "None";
      return this.selectedWorkflows[0].name || `Workflow ${this.selectedWorkflows[0].id}`;
    },
    selectedConfigurationName() {
      if (this.selectedConfigurations.length === 0) return "None";
      return this.selectedConfigurations[0].name || "Unknown";
    },
    selectedWorkflowId() {
      return this.selectedWorkflows.length > 0 ? this.selectedWorkflows[0].id : null;
    },
    selectedConfigurationId() {
      return this.selectedConfigurations.length > 0 ? this.selectedConfigurations[0].id : null;
    },

    // Filtered studies based on workflow and configuration selection
    filteredStudiesTable() {
      if (!this.selectedWorkflowId || !this.selectedConfigurationId) {
        return [];
      }

      return this.studies
        .filter((study) => {
          // Check if study has matching workflow
          if (study.workflowId !== this.selectedWorkflowId) {
            return false;
          }

          // Check if any study step has the selected configuration
          const studyStepsForStudy = this.studySteps.filter(
            (step) => step.studyId === study.id
          );
          
          const hasMatchingConfig = studyStepsForStudy.some((step) => {
            const configId = step.configuration?.settings?.configurationId;
            return configId === this.selectedConfigurationId;
          });

          return hasMatchingConfig;
        })
        .map((study) => {
          const sessionsCount = this.studySessions.filter(
            (s) => s.studyId === study.id
          ).length;
          
          return {
            ...study,
            id: study.id,
            name: study.name,
            sessionsCount,
            closedAt: study.end ? new Date(study.end).toLocaleDateString() : "-",
          };
        });
    },
    studyTableColumns() {
      return [
        { name: "ID", key: "id" },
        { name: "Name", key: "name" },
        { name: "Sessions", key: "sessionsCount" },
        { name: "Closed At", key: "closedAt" },
      ];
    },

    // Sessions based on selected studies
    sessionsTable() {
      const selectedStudyIds = this.selectedStudies.map((s) => s.id);
      
      if (selectedStudyIds.length === 0) {
        return [];
      }

      return this.studySessions
        .filter((session) => selectedStudyIds.includes(session.studyId))
        .map((session) => {
          const study = this.studies.find((s) => s.id === session.studyId);
          const user = this.users.find((u) => u.id === session.userId);
          
          // Find related document and submission
          const studyStepsForSession = this.studySteps.filter(
            (step) => step.studyId === session.studyId
          );
          const documentIds = studyStepsForSession.map((step) => step.documentId).filter(Boolean);
          const document = documentIds.length > 0 
            ? this.documents.find((d) => documentIds.includes(d.id)) 
            : null;
          const submission = document?.submissionId 
            ? this.submissions.find((s) => s.id === document.submissionId) 
            : null;

          // Get owner info
          const owner = submission 
            ? this.users.find((u) => u.id === submission.userId) 
            : null;

          return {
            sessionId: session.id,
            studyId: session.studyId,
            studyName: study?.name || "Unknown",
            userId: session.userId,
            firstName: user?.firstName || "Unknown",
            lastName: user?.lastName || "Unknown",
            userName: user?.userName || "-",
            ownerFirstName: owner?.firstName || "-",
            ownerLastName: owner?.lastName || "-",
            ownerUserName: owner?.userName || "-",
            submissionId: submission?.id || null,
            submissionExtId: submission?.extId || "-",
            link: window.location.origin + "/review/" + session.hash,
            start: session.start,
            end: session.end,
            hash: session.hash,
          };
        });
    },
    sessionTableColumns() {
      return [
        { name: "Study", key: "studyName" },
        { name: "Reviewer First Name", key: "firstName" },
        { name: "Reviewer Last Name", key: "lastName" },
        { name: "Owner First Name", key: "ownerFirstName" },
        { name: "Owner Last Name", key: "ownerLastName" },
        { name: "Submission ExtId", key: "submissionExtId" },
      ];
    },
    formattedStudies() {
      // Group selected sessions by study
      const studyMap = {};
      this.selectedSessions.forEach((session) => {
        const studyId = session.studyId;
        if (!studyMap[studyId]) {
          studyMap[studyId] = {
            study: {
              id: studyId,
              name: session.studyName,
              ownerFirstName: session.ownerFirstName || "-",
              ownerLastName: session.ownerLastName || "-",
            },
            sessions: [],
          };
        }
        studyMap[studyId].sessions.push(session);
      });
      return Object.values(studyMap);
    },
    formattedSessions() {
      // Group selected sessions by reviewer (userId)
      const userMap = {};
      this.selectedSessions.forEach((session) => {
        const key = session.userId;
        if (!userMap[key]) {
          userMap[key] = [];
        }
        userMap[key].push(session);
      });
      return userMap;
    },
    publishMethodOptions() {
      return [
        { value: "csv", label: "Download CSV", disabled: true },
        { value: "moodle", label: "Moodle", disabled: true },
        { value: "email", label: "Email", disabled: true },
      ];
    },
  },
  watch: {
    selectedWorkflows() {
      // Reset downstream selections when workflow changes
      this.selectedConfigurations = [];
      this.selectedStudies = [];
      this.selectedSessions = [];
    },
    selectedConfigurations() {
      // Reset downstream selections when configuration changes
      this.selectedStudies = [];
      this.selectedSessions = [];
    },
    selectedStudies() {
      // Reset sessions when studies change
      this.selectedSessions = [];
    },
  },
  methods: {
    getUserRoles(userId) {
      const roleMatchings = this.userRoleMatchings.filter(
        (urm) => urm.userId === userId && !urm.deleted
      );
      return roleMatchings
        .map((urm) => {
          const role = this.userRoles.find((ur) => ur.id === urm.userRoleId);
          return role ? role.name : "Unknown";
        })
        .join(", ");
    },
    open() {
      this.reset();
      this.$refs.assessmentStepper.open();
    },
    reset() {
      this.selectedWorkflows = [];
      this.selectedConfigurations = [];
      this.selectedStudies = [];
      this.selectedSessions = [];
      this.publishMethod = "csv";
      this.linkCollection = "studies";
    },
    handleSubmit() {
      // CSV download is disabled for now
      this.eventBus.emit("toast", {
        title: "Coming Soon",
        message: "CSV download functionality will be available in a future update.",
        variant: "info",
      });
      this.$refs.assessmentStepper.close();
    },
  },
};
</script>

<style scoped>
.list-group-item {
  padding: 0.5rem 1rem;
}
</style>

