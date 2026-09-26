<template>
  <StepperModal
    ref="assessmentStepper"
    size="xl"
    :steps="steps"
    :validation="stepValid"
    @submit="handleSubmit"
    @step-change="onStepChange"
  >
    <template #title>
      <h5 class="modal-title">{{ $t("submission.publishAssessment.title") }}</h5>
    </template>

    <!-- STEP 1: Configuration Selection -->
    <template #step-1>
      <div class="mb-3">
        <label class="form-label"><b>{{ $t("submission.publishAssessment.selectConfiguration") }}</b></label>
        <p class="small text-muted mb-3">
          {{ $t("submission.publishAssessment.selectConfigurationDescription") }}
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

    <!-- STEP 2: Workflow Selection -->
    <template #step-2>
      <div class="mb-3">
        <label class="form-label"><b>{{ $t("submission.publishAssessment.selectWorkflows") }}</b></label>
        <p class="small text-muted mb-3">
          {{ $t("submission.publishAssessment.selectWorkflowsDescription") }}
        </p>
        <Loader v-if="workflowsLoading" :loading="true"/>
        <BasicTable
          v-else
          v-model="selectedWorkflows"
          :data="workflowsTable"
          :columns="workflowTableColumns"
          :options="multiSelectTableOptions"
          :max-table-height="350"
        />
      </div>
    </template>

    <!-- STEP 3: Session Selection -->
    <template #step-3>
      <div class="mb-3">
        <label class="form-label"><b>{{ $t("submission.publishAssessment.selectSessions") }}</b></label>
        <p class="small text-muted mb-3">
          {{ $t("submission.publishAssessment.selectSessionsDescriptionPrefix") }}
          <strong>{{ $t("submission.publishAssessment.closedStudySessions") }}</strong>
          {{ $t("submission.publishAssessment.selectSessionsDescriptionSuffix") }}
        </p>
        <BackendTable
          ref="sessionTable"
          table="study_session"
          :columns="sessionTableColumns"
          :query-scope="sessionQueryScope"
          :query-filter-schema="sessionFilterSchema"
          :query-search-columns="sessionSearchColumns"
          :options="sessionTableOptions"
          :max-table-height="'50vh'"
          @selection-change="onSessionSelectionChange"
        />
      </div>
    </template>

    <!-- STEP 4: Confirmation -->
    <template #step-4>
      <div class="mb-3">
        <label
          for="linkCollection"
          class="form-label"
        ><b>{{ $t("submission.publishAssessment.hashCollection") }}</b></label>
        <select
          id="linkCollection"
          v-model="linkCollection"
          class="form-select"
          :disabled="sessionSelection.allMatching"
        >
          <option value="studies">{{ $t("submission.publishAssessment.hashCollectionStudies") }}</option>
          <option value="sessions">{{ $t("submission.publishAssessment.hashCollectionSessions") }}</option>
        </select>
      </div>
      <div class="mb-3">
        <p><b>{{ $t("submission.publishAssessment.hashes") }}</b></p>
        <!-- Select-all is the query, not a row list: 10k+ hashes cannot be rendered -->
        <p v-if="sessionSelection.allMatching" class="text-muted">
          {{ $t("submission.publishAssessment.allMatchingSelected", { count: selectedSessionCount }) }}
        </p>
        <ul v-else-if="linkCollection === 'studies'">
          <li
            v-for="study in formattedStudies"
            :key="study.studyId"
          >
            <b>{{ study.studyName }} ({{ study.ownerFirstName }} {{ study.ownerLastName }})</b>
            <ul>
              <li
                v-for="session in study.sessions"
                :key="session.id"
              >
                {{ session.firstName }} {{ session.lastName }} (<a
                  :href="sessionLink(session.hash)"
                  target="_blank"
                >{{ session.hash }}</a>)
              </li>
            </ul>
          </li>
        </ul>
        <ul v-else-if="linkCollection === 'sessions'">
          <li
            v-for="reviewer in formattedSessions"
            :key="reviewer.userId"
          >
            <b>{{ reviewer.firstName }} {{ reviewer.lastName }}</b>
            <ul>
              <li
                v-for="s in reviewer.sessions"
                :key="s.id"
              >
                {{ s.studyName }} (<a
                  :href="sessionLink(s.hash)"
                  target="_blank"
                >{{ s.hash }}</a>)
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </template>

    <!-- STEP 5: Publishing Options -->
    <template #step-5>
      <div class="mb-3">
        <label for="publishMethod" class="form-label"><b>{{ $t("submission.publishAssessment.publishingMethod") }}</b></label>
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
      <div v-if="publishMethod === 'moodle'">
        <div class="mb-3">
          <div class="form-check">
            <input
              id="reviewUrl"
              v-model="isReviewUrlIncluded"
              class="form-check-input"
              type="checkbox"
            >
            <label
              class="form-check-label"
              for="reviewUrl"
            >
              <b>{{ $t("submission.publishAssessment.includeReviewUrl") }}</b>
            </label>
            <p class="small text-muted mt-1">
              {{ $t("submission.publishAssessment.includeReviewUrlDescription") }}
            </p>
          </div>
        </div>
        <MoodleOptions
          ref="moodleOptionsForm"
          v-model="moodleOptions"
          with-assignment-id
          @select-assignment="selectAssignment"
        />
        <div
          v-if="selectedSessionCount > 0 && selectedConfigurationContent"
          class="mt-4"
        >
          <label class="form-label"><b>{{ $t("submission.publishAssessment.moodleGradePublishingOverview") }}</b></label>
          <div class="card">
            <div class="card-body">
              <div class="row mb-2">
                <div class="col-6">
                  <strong>{{ $t("submission.publishAssessment.numberOfGradesToPublish") }}</strong>
                </div>
                <div class="col-6">
                  {{ gradeInformation.numberOfGrades }}
                </div>
              </div>
              <div class="row mb-2">
                <div class="col-6">
                  <strong>{{ $t("submission.publishAssessment.assessmentScaleCurrentScores") }}</strong>
                </div>
                <div class="col-6">
                  {{ $t("submission.publishAssessment.pointsRange", {
                    from: gradeInformation.totalMinPoints,
                    to: gradeInformation.totalMaxPoints
                  }) }}
                </div>
              </div>
              <div class="row mb-2">
                <div class="col-6">
                  <strong>{{ $t("submission.publishAssessment.moodleGradeScaleTarget") }}</strong>
                </div>
                <div class="col-6">
                  <template v-if="moodleOptions?.assignmentID">
                    {{ $t("submission.publishAssessment.pointsRange", {
                      from: 0,
                      to: gradeInformation.maxGradeFromMoodle
                    }) }}
                  </template>
                  <template v-else>
                    {{ $t("submission.publishAssessment.selectAssignmentForInformation") }}
                  </template>
                </div>
              </div>
              <div class="row">
                <div class="col-6">
                  <strong>{{ $t("submission.publishAssessment.conversionFactor") }}</strong>
                </div>
                <div class="col-6">
                  <template v-if="moodleOptions?.assignmentID">
                    {{ $t("submission.publishAssessment.conversionFactorValue", {
                      factor: gradeInformation.conversionFactor
                    }) }}
                  </template>
                  <template v-else>
                    {{ $t("submission.publishAssessment.selectAssignmentForInformation") }}
                  </template>
                </div>
              </div>
            </div>
          </div>
          <p class="small text-muted mt-2">
            <em>
              {{ $t("submission.publishAssessment.conversionNote") }}
            </em>
          </p>
        </div>
      </div>
    </template>
  </StepperModal>
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import BackendTable from "@/basic/BackendTable.vue";
import Loader from "@/basic/Loading.vue";
import StepperModal from "@/basic/modal/StepperModal.vue";
import MoodleOptions from "@/basic/form/MoodleOptions.vue";
import { calculateAssessmentScore, buildScoresFromState } from "assessment-score";
import { downloadObjectsAs, resolveApiMessage, translateMaybeKey } from "@/assets/utils.js";
import {
  ASSESSMENT_RESULT_KEY,
  getAssessmentResultKeyCandidates,
} from "@/assets/serviceDocumentDataKeys.js";

/** Same shape as BackendTable.getSelection(), for the steps where the session table is unmounted. */
function emptySelection() {
  return {allMatching: false, excludeIds: [], ids: [], rows: [], count: 0, filter: [], scope: null, query: {}};
}

/**
 * Modal for publishing assessment data with CSV export
 * @author: CARE Team
 */
export default {
  name: "PublishAssessmentModal",
  components: { BasicTable, BackendTable, Loader, StepperModal, MoodleOptions },
  subscribeTable: [
    { table: "workflow" },
    { table: "workflow_step" },
    { table: "configuration", filter: [{ key: "type", value: 0 }] },
    { table: "document_data" },
    { table: "user_role" },
    { table: "user_role_matching" },
  ],
  data() {
    return {
      selectedWorkflows: [],
      selectedConfigurations: [],
      // Workflow × step rows with their session counts (publishAssessmentWorkflows).
      workflowRows: [],
      workflowsLoading: false,
      sessionSelection: emptySelection(),
      moodleOptions: {},
      publishMethod: "csv",
      linkCollection: "studies",
      selectedAssignmentMaxGrade: 0, // Store max grade for selected assignment
      isReviewUrlIncluded: false, // Option to include review URL in Moodle feedback
    };
  },
  computed: {
    steps() {
      return [
        { title: this.$t("submission.publishAssessment.steps.configuration") },
        { title: this.$t("submission.publishAssessment.steps.workflow") },
        { title: this.$t("submission.publishAssessment.steps.session") },
        { title: this.$t("submission.publishAssessment.steps.confirmation") },
        { title: this.$t("submission.publishAssessment.steps.publishing") },
      ];
    },
    stepValid() {
      return [
        this.selectedConfigurations.length > 0,
        this.selectedWorkflows.length > 0,
        this.selectedSessionCount > 0,
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
        pagination: 10,
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
        pagination: 10,
        search: true,
      };
    },
    sessionTableOptions() {
      return {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        pagination: {
          serverSide: true,
          itemsPerPage: 10,
          total: 0,
        },
        search: true,
        sort: {column: "id", order: "ASC"},
      };
    },
    projectId() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    },
    canReadPrivateInformation() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.view.userPrivateInfo");
    },
    workflows() {
      return this.$store.getters["table/workflow/getAll"] || [];
    },
    configurations() {
      return this.$store.getters["table/configuration/getFiltered"](
        (c) => c.type === 0 && !c.deleted
      ) || [];
    },
    userRoles() {
      return this.$store.getters["table/user_role/getAll"] || [];
    },
    userRoleMatchings() {
      return this.$store.getters["table/user_role_matching/getAll"] || [];
    },

    // Table data
    workflowsTable() {
      return this.workflowRows
        .map((row) => {
          const workflow = this.workflows.find((w) => w.id === row.workflowId && !w.deleted);
          return {
            workflowId: row.workflowId,
            workflowName: translateMaybeKey(workflow?.name)
              || this.$t("submission.publishAssessment.workflowFallback", { id: row.workflowId }),
            stepNumber: row.stepNumber,
            description: translateMaybeKey(workflow?.description) || "-",
            openSessions: row.openSessions,
            closedSessions: row.closedSessions,
            totalSessions: row.openSessions + row.closedSessions,
          };
        })
        .sort((a, b) => {
          if (a.workflowName !== b.workflowName) {
            return a.workflowName.localeCompare(b.workflowName);
          }
          return a.stepNumber - b.stepNumber;
        })
        .map((row, index) => ({
          ...row,
          id: index + 1,
        }));
    },
    workflowTableColumns() {
      return [
        { name: this.$t("common.id"), key: "id" },
        { name: this.$t("submission.publishAssessment.columns.workflowId"), key: "workflowId" },
        { name: this.$t("submission.publishAssessment.columns.workflowName"), key: "workflowName" },
        { name: this.$t("submission.publishAssessment.columns.step"), key: "stepNumber" },
        { name: this.$t("submission.publishAssessment.columns.openSessions"), key: "openSessions" },
        { name: this.$t("submission.publishAssessment.columns.closedSessions"), key: "closedSessions" },
        { name: this.$t("submission.publishAssessment.columns.totalSessions"), key: "totalSessions" },
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
        { name: this.$t("common.id"), key: "id" },
        { name: this.$t("common.name"), key: "name" },
        { name: this.$t("submission.publishAssessment.columns.created"), key: "createdAt" },
      ];
    },
    selectedConfigurationId() {
      return this.selectedConfigurations.length > 0 ? this.selectedConfigurations[0].id : null;
    },
    selectedConfiguration() {
      if (!this.selectedConfigurationId) return null;
      return this.$store.getters["table/configuration/get"](this.selectedConfigurationId);
    },
    selectedConfigurationContent() {
      return this.selectedConfiguration?.content || null;
    },
    selectedConfigurationName() {
      return this.selectedConfiguration?.name || this.$t("common.unknown");
    },
    criteriaNames() {
      const cfg = this.selectedConfigurationContent;
      if (!cfg || !Array.isArray(cfg.rubrics)) return [];
      const names = [];
      cfg.rubrics.forEach((rubric) => {
        (rubric?.criteria || []).forEach((crit) => {
          if (crit?.name && !names.includes(crit.name)) {
            names.push(crit.name);
          }
        });
      });
      return names;
    },

    /**
     * Which sessions the session table lists: the picked configuration in the picked workflow steps,
     * closed studies only. The server turns this into the WHERE (study_session model), so neither
     * study nor study_step ids travel to the browser.
     */
    sessionQueryScope() {
      if (!this.selectedConfigurationId || this.selectedWorkflows.length === 0) {
        return null;
      }
      return {
        assessment: {
          configurationId: this.selectedConfigurationId,
          projectId: this.projectId,
          steps: this.selectedWorkflows.map((row) => ({
            workflowId: row.workflowId,
            stepNumber: row.stepNumber,
          })),
        },
      };
    },
    sessionTableColumns() {
      const columns = [
        { name: this.$t("submission.publishAssessment.columns.study"), key: "studyName" },
      ];
      if (this.canReadPrivateInformation) {
        columns.push(
          { name: this.$t("submission.publishAssessment.columns.reviewerFirstName"), key: "firstName" },
          { name: this.$t("submission.publishAssessment.columns.reviewerLastName"), key: "lastName" },
          { name: this.$t("submission.publishAssessment.columns.ownerFirstName"), key: "ownerFirstName" },
          { name: this.$t("submission.publishAssessment.columns.ownerLastName"), key: "ownerLastName" },
        );
      }
      columns.push(
        { name: this.$t("submission.publishAssessment.columns.submissionExtId"), key: "submissionExtId" },
      );
      return columns;
    },
    sessionFilterSchema() {
      const schema = {
        submissionExtId: {
          label: this.$t("submission.publishAssessment.columns.submissionExtId"),
          type: "numeric",
          operators: ["=", ">", ">=", "<", "<=", "%"],
        },
      };
      if (this.canReadPrivateInformation) {
        schema.firstName = {label: this.$t("submission.publishAssessment.columns.reviewerFirstName"), type: "text"};
        schema.lastName = {label: this.$t("submission.publishAssessment.columns.reviewerLastName"), type: "text"};
        schema.ownerFirstName = {label: this.$t("submission.publishAssessment.columns.ownerFirstName"), type: "text"};
        schema.ownerLastName = {label: this.$t("submission.publishAssessment.columns.ownerLastName"), type: "text"};
      }
      return schema;
    },
    sessionSearchColumns() {
      const columns = ["studyName"];
      if (this.canReadPrivateInformation) {
        columns.push("firstName", "lastName", "ownerFirstName", "ownerLastName");
      }
      return columns;
    },
    selectedSessionCount() {
      return this.sessionSelection.count;
    },
    formattedStudies() {
      // Group the ticked sessions by study
      const studyMap = {};
      this.sessionSelection.rows.forEach((session) => {
        if (!studyMap[session.studyId]) {
          studyMap[session.studyId] = {
            studyId: session.studyId,
            studyName: session.studyName || this.$t("common.unknown"),
            ownerFirstName: session.ownerFirstName || "-",
            ownerLastName: session.ownerLastName || "-",
            sessions: [],
          };
        }
        studyMap[session.studyId].sessions.push(session);
      });
      return Object.values(studyMap);
    },
    formattedSessions() {
      // Group the ticked sessions by reviewer
      const userMap = {};
      this.sessionSelection.rows.forEach((session) => {
        if (!userMap[session.userId]) {
          userMap[session.userId] = {
            userId: session.userId,
            firstName: session.firstName || this.$t("common.unknown"),
            lastName: session.lastName || "",
            sessions: [],
          };
        }
        userMap[session.userId].sessions.push(session);
      });
      return Object.values(userMap);
    },
    publishMethodOptions() {
      return [
        { value: "csv", label: this.$t("submission.publishAssessment.publishMethods.downloadCsv"), disabled: false },
        { value: "moodle", label: this.$t("submission.publishAssessment.publishMethods.moodle"), disabled: false },
        { value: "email", label: this.$t("submission.publishAssessment.publishMethods.email"), disabled: true },
      ];
    },
    // Grade information computed properties
    gradeInformation() {
      const numberOfGrades = this.selectedSessionCount;
      const assessment = this.selectedConfigurationContent
        ? calculateAssessmentScore(this.selectedConfigurationContent, {})
        : {};

      return {
        numberOfGrades,
        totalMaxPoints: assessment.total_max_points ?? 0,
        totalMinPoints: assessment.total_min_points ?? 0,
        maxGradeFromMoodle: this.selectedAssignmentMaxGrade || 0,
        conversionFactor: this.getConversionFactorFromAssessment(assessment),
      };
    },
  },
  watch: {
    selectedConfigurations() {
      // Reset downstream selections when configuration changes
      this.selectedWorkflows = [];
      this.sessionSelection = emptySelection();
      this.loadWorkflows();
    },
    selectedWorkflows() {
      // Reset sessions when workflow changes (the query behind them changed)
      this.sessionSelection = emptySelection();
    },
  },
  methods: {
    /**
     * Calculates the linear conversion factor between assessment points and Moodle grade.
     * Uses the same logic for both the overview display and the actual grade publishing.
     */
    getConversionFactorFromAssessment(assessment) {
      const totalMaxPoints = assessment.total_max_points ?? 0;
      const totalMinPoints = assessment.total_min_points ?? 0;
      const assignmentMaxGrade = this.selectedAssignmentMaxGrade || 0;

      const sourcePointsRange = totalMaxPoints - totalMinPoints;
      const targetGradeRange = assignmentMaxGrade - 0;

      if (assignmentMaxGrade > 0 && sourcePointsRange > 0) {
        let factor = targetGradeRange / sourcePointsRange;
        // Keep 3 decimal places for display and internal use
        factor = Math.round(factor * 1000000) / 1000000;
        return factor;
      }

      return 0;
    },
    /**
     * Workflow steps that run the picked configuration, with their session counts.
     */
    loadWorkflows() {
      this.workflowRows = [];
      if (!this.selectedConfigurationId) {
        return;
      }
      this.workflowsLoading = true;
      this.$socket.emit("publishAssessmentWorkflows", {
        configurationId: this.selectedConfigurationId,
        projectId: this.projectId,
      }, (res) => {
        this.workflowsLoading = false;
        if (!res?.success) {
          this.eventBus.emit("toast", {
            title: this.$t("submission.publishAssessment.toasts.workflowsFailed.title"),
            message: resolveApiMessage(res),
            variant: "danger",
          });
          return;
        }
        this.workflowRows = res.data?.workflows || [];
      });
    },
    onStepChange(step) {
      if (step !== 2) {
        const live = this.$refs.sessionTable?.getSelection?.();
        if (live) this.sessionSelection = {...live};
        return;
      }
      this.$nextTick(() => this.restoreSessionSelection());
    },
    restoreSessionSelection() {
      const saved = this.sessionSelection;
      if (!saved) return;
      const hasRows = Array.isArray(saved.rows) && saved.rows.length > 0;
      const hasIds = Array.isArray(saved.ids) && saved.ids.length > 0;
      const hasSelection = !!saved.allMatching || hasRows || hasIds;
      const query = saved.query || {};
      const hasSearch = !!String(query.search || "").trim()
        || Object.keys(query.columnFilters || {}).length > 0;
      if (!hasSelection && !hasSearch) return;
      const table = this.$refs.sessionTable;
      if (hasSearch) table?.applySearch?.(query);
      if (hasSelection) table?.applySelection?.(saved);
    },
    onSessionSelectionChange() {
      // Snapshot while the table exists: the stepper unmounts it before the confirmation step.
      const selection = this.$refs.sessionTable?.getSelection();
      this.sessionSelection = selection ? {...selection} : emptySelection();
    },
    sessionLink(hash) {
      return `${window.location.origin}/review/${hash}`;
    },
    getUserRoles(userId) {
      const roleMatchings = this.userRoleMatchings.filter(
        (urm) => urm.userId === userId && !urm.deleted
      );
      return roleMatchings
        .map((urm) => {
          const role = this.userRoles.find((ur) => ur.id === urm.userRoleId);
          return role ? role.name : this.$t("common.unknown");
        })
        .join(", ");
    },
    /**
     * Assessment result keys a step can write: service candidates plus the plain key.
     * Prefers a service with skill/hookId (AI/NLP workflow), otherwise the first service
     * @param {Array<Object>} services step services from the export row
     * @returns {string[]}
     */
    getAssessmentDataKeys(services) {
      const list = Array.isArray(services) ? services : [];
      // Any service with skill or hookId indicates AI/NLP workflow.
      const service = list.find((s) => s.skill || s.hookId) || list[0] || null;
      const keys = getAssessmentResultKeyCandidates(service);
      return keys.length ? keys : [ASSESSMENT_RESULT_KEY];
    },
    /**
     * Scores from Vuex document_data for one exported session.
     * @param {Object} session row from publishAssessmentData (needs id / studyStepId / services)
     * @returns {{scores: Object, assessment: Object}}
     */
    getAssessmentDataForSession(session) {
      if (!session?.studyStepId) {
        return {scores: {}, assessment: {}};
      }
      const sessionId = session.id ?? session.sessionId;
      const keys = this.getAssessmentDataKeys(session.services);
      const documentDataArray = this.$store.getters["table/document_data/getByKey"]("studySessionId", sessionId) || [];
      const raw = keys
        .map((key) => documentDataArray.find(
          (dd) => dd?.studyStepId === session.studyStepId && dd?.key === key && !dd?.deleted
        )?.value)
        .find((value) => value != null);
      const scoreState = raw && typeof raw === "object" ? raw : {};
      const scores = buildScoresFromState(scoreState);
      return {scores, assessment: calculateAssessmentScore(this.selectedConfigurationContent, scores)};
    },
    open() {
      this.reset();
      this.$refs.assessmentStepper.open();
    },
    reset() {
      this.selectedWorkflows = [];
      this.selectedConfigurations = [];
      this.workflowRows = [];
      this.workflowsLoading = false;
      this.sessionSelection = emptySelection();
      this.publishMethod = "csv";
      this.linkCollection = "studies";
      this.selectedAssignmentMaxGrade = 0;
      this.moodleOptions = {};
      this.isReviewUrlIncluded = false;
    },
    selectAssignment({ maxGrade }) {
      this.selectedAssignmentMaxGrade = maxGrade ?? 0;
    },
    handleSubmit() {
      if (!this.validateConfiguration()) return;
      if (this.selectedSessionCount <= 0) {
        this.eventBus.emit("toast", {
          title: this.$t("submission.publishAssessment.toasts.noSessionsSelected.title"),
          message: this.$t("submission.publishAssessment.toasts.noSessionsSelected.message"),
          variant: "warning",
        });
        return;
      }
      this.fetchAssessmentData((sessions) => {
        if (this.publishMethod === "moodle") {
          this.uploadGrades(sessions);
          return;
        }
        this.$refs.assessmentStepper.setWaiting(false);
        this.downloadCSV(sessions);
      });
    },
    /**
     * Scores and identity for the selected sessions. Either the ticked ids or the session query
     * itself (select-all) — the server resolves the rows again from the same filter and scope.
     * @param {function(Array<Object>): void} onLoaded
     */
    fetchAssessmentData(onLoaded) {
      this.$refs.assessmentStepper.setWaiting(true);
      this.$socket.emit("publishAssessmentData", {
        selection: {
          allMatching: this.sessionSelection.allMatching,
          excludeIds: this.sessionSelection.excludeIds,
          ids: this.sessionSelection.ids,
          filter: this.sessionSelection.filter,
          query: this.sessionSelection.query,
          scope: this.sessionSelection.scope || this.sessionQueryScope,
        },
      }, (res) => {
        if (!res?.success) {
          this.$refs.assessmentStepper.setWaiting(false);
          this.eventBus.emit("toast", {
            title: this.$t("submission.publishAssessment.toasts.assessmentDataFailed.title"),
            message: resolveApiMessage(res),
            variant: "danger",
          });
          return;
        }
        onLoaded(res.data?.sessions || []);
      });
    },
    /**
     * Validates that configuration content is available.
     */
    validateConfiguration() {
      const configContent = this.selectedConfigurationContent;
      if (!configContent) {
        this.eventBus.emit("toast", {
          title: this.$t("submission.publishAssessment.toasts.configurationMissing.title"),
          message: this.$t("submission.publishAssessment.toasts.configurationMissing.message"),
          variant: "danger",
        });
        return false;
      }
      return true;
    },
    /**
     * Uploads the selected sessions' grades to a specific assignment in Moodle.
     * @param {Array<Object>} sessions rows from publishAssessmentData
     */
    uploadGrades(sessions) {
      const grades = sessions.map((session) => {
        const { assessment } = this.getAssessmentDataForSession(session);

        const gradeEntry = {
          extId: session.ownerExtId || "",
          grade: this.convertAssessmentScore(assessment),
        };

        // Optionally include review URL as feedback text
        if (this.isReviewUrlIncluded && session.hash) {
          gradeEntry.text = this.sessionLink(session.hash);
        }

        return gradeEntry;
      });

      this.$socket.emit("submissionPublishGrades", {
          options: this.moodleOptions,
          grades: grades,
        }, (res) => {
          this.$refs.assessmentStepper.setWaiting(false);
          if (res.success) {
            this.$refs.assessmentStepper.close();
            this.eventBus.emit("toast", {
              title: this.$t("submission.publishAssessment.toasts.gradesPublished.title"),
              message: this.$t("submission.publishAssessment.toasts.gradesPublished.message"),
              variant: "success",
            });
          } else {
            this.eventBus.emit("toast", {
              title: this.$t("submission.publishAssessment.toasts.failedToPublishGrades.title"),
              message: resolveApiMessage(res),
              variant: "danger",
            });
          }
        }
      );
    },
    /**
     * Converts an assessment score from one scale to another.
     * Uses the same conversionFactor that is shown in the overview:
     *   convertedGrade = normalizedPoints * conversionFactor
     * and then rounds the result to 2 decimal places.
     */
    convertAssessmentScore(assessment) {
      const { total_min_points, achieved_points } = assessment;

      const conversionFactor = this.getConversionFactorFromAssessment(assessment);
      const normalizedPoints = achieved_points - (total_min_points ?? 0);
      const convertedGrade = normalizedPoints * conversionFactor;
      // Round final grade to 2 decimal places
      return Math.round(convertedGrade * 100) / 100;
    },
    /**
     * Build CSV rows for the selected sessions using assessmentScore utilities.
     * Each session becomes one row; criteria columns are derived from configuration.
     * Headers stay English so an export does not change with the UI language.
     * @param {Array<Object>} sessions rows from publishAssessmentData
     */
    downloadCSV(sessions) {
      const criteriaList = this.criteriaNames;
      const rows = sessions.map((session) => {
        const { scores, assessment } = this.getAssessmentDataForSession(session);

        const row = {
          "User ExtId": session.ownerExtId || "",
          "User First Name": session.ownerFirstName || "",
          "User Last Name": session.ownerLastName || "",
          "User Name": session.ownerUserName || "",
          "Submission ID": session.submissionId || "",
          "Submission ExtId": session.submissionExtId || "",
          "Reviewer First Name": session.firstName || "",
          "Reviewer Last Name": session.lastName || "",
          "Reviewer User Name": session.userName || "",
          "Reviewer Roles": this.getUserRoles(session.userId),
          "Hash": session.hash || "",
          "Total Points": assessment.achieved_points ?? 0,
        };

        // Add dynamic criteria columns
        criteriaList.forEach((criterionName) => {
          row[criterionName] = scores[criterionName] ?? 0;
        });

        return row;
      });

      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const configName = this.selectedConfigurationName.replace(/[^a-zA-Z0-9]/g, "_");
      const fileBaseName = `assessment_${configName}_${timestamp}`;
      downloadObjectsAs(rows, fileBaseName, "csv");

      this.eventBus.emit("toast", {
        title: this.$t("submission.publishAssessment.toasts.csvExport.title"),
        message: this.$t("submission.publishAssessment.toasts.csvExport.message"),
        variant: "success",
      });
    },
  },
};
</script>

<style scoped>
.list-group-item {
  padding: 0.5rem 1rem;
}
</style>