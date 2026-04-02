<template>
  <StepperModal
      ref="assignmentStepper"
      :steps="steps"
      :validation="stepValid"
      size="xl"
      @submit="createAssignment"
    >
    <template #title>
      <h5 class="modal-title">Create Assignment</h5>
    </template>

    <template v-if="templates.length === 0" #error>
      <p class="text-center text-danger">There are not study templates available!</p>
      <p class="text-center">Please create a study template to proceed!</p>
    </template>
    <template #step-1>
      <BasicForm
          ref="templateSelectionForm"
          v-model="templateSelection"
          :fields="templateSelectionFields"
      />
      <div class="mt-3"><strong>Workflow Steps:</strong></div>
      <ul class="list-group">
        <li
            v-for="(workflowStep, index) in workflowSteps"
            :key="workflowStep.id" class="list-group-item"
            :class="(workflowStep.workflowStepDocument !== null) ? 'disabled': 'list-group-item-primary'">
          Workflow Step {{ index + 1 }}:
          {{ (workflowStep.stepType === 1) ? "Annotator" : (workflowStep.stepType === 2) ? "Editor" : "Unknown" }}
        </li>
      </ul>
      <div class="mt-3">
        <label class="form-label"><strong>Assignment should be based on:</strong></label>
        <FormSelect
            v-model="assignmentTypeSelection.type"
            :options="assignmentTypeFields"
        />
      </div>
      <div class="mt-3">
        <div class="form-check">
          <input
            type="checkbox"
            v-model="enableEmailNotification"
            class="form-check-input"
            id="emailNotifyCheck"
          />
          <label class="form-check-label" for="emailNotifyCheck">
            <strong>Send email notification to reviewer</strong>
          </label>
        </div>
      </div>
    </template>
    <template #step-2>
      <div v-if="assignmentType === 'study_session'">
        <h6 class="text-secondary">Target Workflow Selection</h6>
        <div class="mb-3">
          <label class="form-label"><strong>Select Target Workflow:</strong></label>
          <FormSelect
              v-model="targetWorkflowId"
              :options="workflowOptions"
          />
        </div>

        <div v-if="targetWorkflowId && targetWorkflowSteps.length > 0">
          <h6 class="text-secondary mt-4">Workflow Step Mapping</h6>
          <p class="text-muted">Map each source workflow step (from template) to a target workflow step:</p>
          
          <div
              v-for="(workflowStep, index) in workflowSteps"
              :key="workflowStep.id"
              class="mb-3"
          >
            <label class="form-label">
              <strong>Source Step {{ index + 1 }}: {{ getStepTypeName(workflowStep.stepType) }}</strong> → Target Step:
            </label>
            <FormSelect
                v-model="workflowMapping[workflowStep.id]"
                :options="getTargetStepOptions(workflowStep.stepType, workflowStep.id)"
            />
          </div>
        </div>
      </div>
      <div v-else>
        <BasicTable
          v-model="selectedAssignment"
          :columns="currentTableColumns"
          :data="currentTableData"
          :options="documentTableOptions"
          :max-table-height="400"
        />
      </div>
    </template>
    <template #step-3>
      <div v-if="assignmentType === 'study_session'">
        <BasicTable
          v-model="selectedAssignment"
          :columns="currentTableColumns"
          :data="currentTableData"
          :options="documentTableOptions"
          :max-table-height="400"
        />
      </div>
      <div v-else>
        <BasicTable
          v-model="selectedReviewer"
          :columns="reviewerTableColumns"
          :data="reviewerTable"
          :options="reviewerTableOptions"
          :max-table-height="400"
        />
      </div>
    </template>
    <template #step-4>
      <div v-if="assignmentType === 'study_session'">
        <BasicTable
          v-model="selectedReviewer"
          :columns="reviewerTableColumns"
          :data="reviewerTable"
          :options="reviewerTableOptions"
          :max-table-height="400"
        />
      </div>
      <div v-else>
        <p>
          Are you sure you want to create the assignment with the following details?
        </p>
        <div>
          <strong>Template:</strong> {{ template.name }}
        </div>
        <div>
          <strong>Workflow:</strong> {{ workflow.name }}
        </div>
        <div>
          <strong>Assignment Type:</strong> {{ assignmentType === 'document' ? 'Document' : 'Submission' }}
        </div>
        <div v-if="assignmentType === 'document'">
          <strong>Workflow Assignments:</strong>
          <ul>
            <li
                v-for="(stepAssignment, index) in workflowStepsAssignments"
                :key="stepAssignment.id"
            >
              - Workflow Step {{ index + 1 }}:
              <span v-if="stepAssignment.documentId && documents.find(doc => doc.id === stepAssignment.documentId)">
                      {{ documents.find(doc => doc.id === stepAssignment.documentId).name }}
                      ({{
                  reviewers.find(user => user.id === documents.find(doc => doc.id === stepAssignment.documentId).userId).firstName
                }}
                       {{
                  reviewers.find(user => user.id === documents.find(doc => doc.id === stepAssignment.documentId).userId).lastName
                }})
                    </span>
              <span v-else>
                      Create new document
                    </span>
            </li>
          </ul>
        </div>
        <div>
          <strong>Reviewers:</strong>
          <ul>
            <li
                v-for="reviewer in selectedReviewer"
                :key="reviewer.id">
              - {{ reviewer.firstName }} {{ reviewer.lastName }}
            </li>
          </ul>
        </div>
      </div>
    </template>
    <template #step-5>
      <div>
        <p>
          Are you sure you want to create the assignment with the following details?
        </p>
        <div>
          <strong>Template:</strong> {{ template.name }}
        </div>
        <div>
          <strong>Workflow:</strong> {{ workflow.name }}
        </div>
        <div>
          <strong>Assignment Type:</strong> Study Session
        </div>
        <div>
          <strong>Target Workflow:</strong> {{ getWorkflowType(targetWorkflowId) }}
        </div>
        <div>
          <strong>Selected Study Session:</strong> 
          {{ selectedAssignment.length > 0 ? `Session ${selectedAssignment[0].id}` : 'None' }}
        </div>
        <div>
          <strong>Reviewers:</strong>
          <ul>
            <li
                v-for="reviewer in selectedReviewer"
                :key="reviewer.id">
              - {{ reviewer.firstName }} {{ reviewer.lastName }}
            </li>
          </ul>
        </div>
      </div>
    </template>
  </StepperModal>
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import BasicForm from "@/basic/Form.vue";
import StepperModal from "@/basic/modal/StepperModal.vue";
import FormSelect from "@/basic/form/Select.vue";

/**
 * Modal for bulk creating assignments
 * @author: Dennis Zyska, Alexander Bürkle, Linyin Huang
 */
export default {
  name: "ImportModal",
  subscribeTable: [{
    table: "document",
    filter: [{
      key: "readyForReview",
      value: true
    }],
  },
    {
      table: "user",
    },
    {
      table: "study",
      filter: [{
        key: "template",
        value: true
      }]
    },
    "submission",
    {
      table: "template",
    },
    {
      table: "configuration",
      filter: [{key: "type", value: 1}]
    }],
  components: {StepperModal, BasicTable, BasicForm, FormSelect},
  data() {
    return {
      templateSelection: {},
      assignmentTypeSelection: {},
      selectedAssignment: [],
      selectedReviewer: [],
      enableEmailNotification: false,
      studySessionSelections: [[]],
      targetWorkflowId: null,
      workflowMapping: {},
      studyStepsTableColumns: [
        { name: "Step Type", key: "stepTypeName", sortable: true },
        { name: "First Name", key: "firstName", sortable: true },
        { name: "Last Name", key: "lastName", sortable: true },
        { name: "Study Name", key: "studyName", sortable: true },
        { name: "Workflow Type", key: "workflowType", sortable: true },
      ],
    };
  },
  computed: {
    assignmentType() {
      return this.assignmentTypeSelection.type || 'document';
    },
    isWorkflowMappingComplete() {
      if (!this.targetWorkflowId) return false;
      return this.workflowSteps.every((step) => {
        return this.workflowMapping[step.id] !== undefined && this.workflowMapping[step.id] !== null;
      });
    },
    stepValid() {
      const step1Valid = this.workflowStepsAssignment.length !== 0 && !!this.assignmentType;
      let step2Valid;
      let step3Valid;
      let step4Valid;
      
      if (this.assignmentType === 'study_session') {
        // For study sessions, check that workflow mapping is complete
        step2Valid = !!this.targetWorkflowId && this.isWorkflowMappingComplete;
        step3Valid = this.selectedAssignment.length === 1;
        step4Valid = this.selectedReviewer.length > 0;
        return [step1Valid, step2Valid, step3Valid, step4Valid, true];
      } else {
        step2Valid = this.selectedAssignment.length === 1;
        step3Valid = this.selectedReviewer.length > 0;
        return [step1Valid, step2Valid, step3Valid, true];
      }
    },
    documentTableOptions() {
      return {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        scrollY: true,
        scrollX: true,
        singleSelect: true,
        search: true,
        pagination: 10,
      }
    },
    reviewerTableOptions() {
      return {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        scrollY: true,
        scrollX: true,
        search: true,
        pagination: 10,
      }
    },
    templateSelectionFields() {
      return [
        {
          key: "template",
          label: "Template",
          type: "select",
          options: this.templates.map(template => ({
            name: template.name,
            value: template.id,
          })),
          required: true,
        },
      ]
    },
    assignmentTypeFields() {
      return {
        options: [
          {value: 'document', name: 'Documents'},
          {value: 'submission', name: 'Submissions'},
          {value: "study_session", name: "Study Sessions"}
        ]
      };
    },
    emailTemplates() {
      const currentUserId = this.$store.getters["auth/getUserId"];
      return this.$store.getters["table/template/getAll"]
        .filter(t => t.type === 3 && !t.deleted && t.userId === currentUserId);
    },
    emailTemplateOptions() {
      return {
        options: [
          {value: null, name: 'None (no email will be sent)'},
          ...this.emailTemplates.map(t => ({
            value: t.id,
            name: t.name
          }))
        ]
      };
    },
    templates() {
      return this.$store.getters["table/study/getFiltered"](item => item.template === true);
    },
    template() {
      return this.$store.getters["table/study/get"](this.templateSelection.template);
    },
    workflow() {
      return this.$store.getters["table/workflow/get"](this.template.workflowId);
    },
    workflowSteps() {
      if (!this.template) return [];
      return this.$store.getters["table/workflow_step/getFiltered"](item => item.workflowId === this.template.workflowId);
    },
    workflowStepsAssignment() {
      return this.workflowSteps.filter(step => step.stepType === 1 && step.workflowStepDocument === null);
    },
    workflowStepsAssignments() {
      if (this.assignmentType === 'submission') {
        return this.workflowSteps.map((c, index) => {
          if (index === 0 && this.selectedAssignment.length > 0) {
            const primaryDocId = this.getPrimaryDocumentId(this.selectedAssignment[0].id);
            return {
              documentId: primaryDocId,
              workflowStepId: c.id
            };
          }
          return {
            documentId: null,
            workflowStepId: c.id
          };
        });
      } else if (this.assignmentType === 'document') {
        return this.workflowSteps.map((c, index) => {
          return {
            documentId: (index === 0) ? this.selectedAssignment[0].id : null,
            workflowStepId: c.id
          }
        });
      }
    },
    documents() {
      return this.$store.getters["table/document/getFiltered"]((d) => d.readyForReview);
    },
    submissions() {
      return this.$store.getters["table/submission/getAll"];
    },
    currentTableData() {
      switch (this.assignmentType) {
        case 'submission':
          return this.submissionsTable;
        case 'document':
          return this.documentsTable;
        case 'study_session':
          return this.studySessionsTable;
        default:
          return [];
      }
    },
    currentTableColumns() {
      switch (this.assignmentType) {
        case 'submission':
          return this.submissionColumns;
        case 'document':
          return this.documentsTableColumns;
        case 'study_session':
          return this.studySessionsTableColumns;
        default:
          return [];
      }
    },
    documentsTable() {
      return this.documents.filter((d) => d.type === 0).map((d) => {
        let newD = {...d};
        newD.type = d.type === 0 ? "PDF" : "HTML";
        const user = this.$store.getters["table/user/get"](d.userId)
        newD.firstName = (user) ? user.firstName : "Unknown";
        newD.lastName = (user) ? user.lastName : "Unknown";
        return newD;
      })
    },
    documentsTableColumns() {
      return [
        {name: "ID", key: "id"},
        {name: "Document", key: "name"},
        {name: "First Name", key: "firstName"},
        {name: "Last Name", key: "lastName"},
      ]
    },
    submissionsTable() {
      return this.submissions.map((s) => {
        let newS = {...s};
        const user = this.$store.getters["table/user/get"](s.userId);
        newS.name = s.name || `Submission ${s.id}`;
        newS.userName = user ? user.userName : "N/A";
        newS.firstName = user ? user.firstName : "Unknown";
        newS.lastName = user ? user.lastName : "Unknown";
        newS.group = (s.group !== null && s.group !== undefined && s.group !== '') ? s.group : '';
        return newS;
      });
    },
    submissionColumns() {
      return [
        {name: "ID", key: "id"},
        {name: "Submission Name", key: "name"},
        {name: "User Name", key: "userName"},
        {name: "First Name", key: "firstName"},
        {name: "Last Name", key: "lastName"},
        {name: "Group ID", key: "group", filter: this.groupFilterOptions},
        {name: "Created At", key: "createdAt"},
      ]
    },
     studySessionsTable() {
      if (!this.targetWorkflowId) return [];
      
      const sessions = this.$store.getters["table/study_session/getAll"] || [];
      return sessions
        .filter(session => {
          const study = this.$store.getters["table/study/get"](session.studyId);
          return study && study.workflowId === this.targetWorkflowId;
        })
        .map(session => {
          const study = this.$store.getters["table/study/get"](session.studyId);
          const user = this.$store.getters["table/user/get"](session.userId);
          const submission = this.getSubmission(session.studyId);
          return {
            id: session.id,
            studyId: session.studyId,
            userId: session.userId,
            firstName: user ? user.firstName : 'Unknown',
            lastName: user ? user.lastName : 'Unknown',
            workflowType: this.getWorkflowType(study.workflowId),
            submissionGroup: submission && submission.group ? submission.group : 'N/A',
            status: session.end === null ? "Running" : "Finished",
            createdAt: new Date(session.createdAt).toLocaleString(),
          };
        });
    },
    studySessionsTableColumns() {
      return [
        { name: "ID", key: "id" },
        { name: "First Name", key: "firstName", sortable: true },
        { name: "Last Name", key: "lastName", sortable: true },
        { name: "Workflow Type", key: "workflowType", sortable: true },
        { name: "Created At", key: "createdAt", sortable: true },
        { name: "Submission Group", key: "submissionGroup", sortable: true, filter: this.groupFilterOptions},
        {
          name: "Status",
          key: "status",
          type: "badge",
          sortable: true,
          typeOptions: {
            keyMapping: {
              Running: "Running",
              Finished: "Finished",
            },
            classMapping: {
              Running: "bg-primary",
              Finished: "bg-success",
            }
          }
        },
      ];
    },
    studyStepsTable() {
      const sessions = this.$store.getters["table/study_session/getAll"] || [];
      const data = [];
      
      sessions.forEach((session) => {
        const study = this.$store.getters["table/study/get"](session.studyId);
        const studySteps = this.$store.getters["table/study_step/getFiltered"](
          (s) => s.studyId === session.studyId && !s.deleted
        ) || [];
        
        studySteps.forEach((step) => {
          if (step.workflowStepId === null) {
            return;
          }
          
          const user = this.$store.getters["table/user/get"](session.userId);
          
          data.push({
            id: step.id,
            sessionId: session.id,
            studyId: step.studyId,
            workflowStepId: step.workflowStepId,
            stepType: step.stepType,
            stepTypeName: this.getStepTypeName(step.stepType),
            documentId: step.documentId,
            studyStepPrevious: step.studyStepPrevious,
            studyName: study ? study.name : 'Unknown',
            workflowType: `${this.getWorkflowType(study ? study.workflowId : null)}`,
            userId: session.userId,
            firstName: user ? user.firstName : 'Unknown',
            lastName: user ? user.lastName : 'Unknown',
            sessionStart: session.start ? new Date(session.start).toLocaleString() : 'N/A',
            sessionEnd: session.end ? new Date(session.end).toLocaleString() : 'N/A',
            status: session.end === null ? "Running" : "Finished",
          });
        });
      });
      
      return data;
    },
    reviewers() {
      return this.$store.getters["table/user/getAll"];
    },
    roles() {
      return this.$store.getters["admin/getSystemRoles"] || [];
    },
    reviewerTable() {
      return this.reviewers.map((r) => {
        let newR = {...r};
        newR.studySessions = this.userStudySessions(r.id).filter((s) => this.isStudyClosed(s.studyId)).length;
        newR.documents = this.documents.filter((d) => d.userId === r.id).length;
        newR.rolesNames = (r.roles || [])
            .map((role) => {
              const foundRole = (this.roles || []).find((roleObj) => roleObj.id === role);
              return foundRole ? foundRole.name : null;
            })
            .filter(name => name !== null)
            .join(", ");
        return newR;
      });
    },
    reviewerTableColumns() {
      return [
        {name: "ID", key: "id"},
        {name: "extId", key: "extId"},
        {name: "First Name", key: "firstName"},
        {name: "Last Name", key: "lastName"},
        {name: "Number of Assignments", key: "studySessions"},
        {name: "Documents", key: "documents"},
        {
          name: "Roles",
          key: "rolesNames",
        }
      ]
    },
    groupFilterOptions() {
      const groups = new Set();
      let hasEmptyGroups = false;

      (this.submissionsTable || []).forEach((s) => {
        if (s && s.group !== null && s.group !== undefined && s.group !== '') {
          groups.add(String(s.group));
        } else {
          hasEmptyGroups = true;
        }
      });

      const options = Array.from(groups)
          .sort((a, b) => {
            const na = Number(a);
            const nb = Number(b);
            if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
            return a.localeCompare(b);
          })
          .map((g) => ({key: g, name: g}));

      if (hasEmptyGroups) {
        options.unshift({key: '', name: 'No GroupID'});
      }

      return options;
    },
    steps() {
      if (this.assignmentType === 'study_session') {
        return [
          {title: "Template Selection"},
          {title: "Workflow Mapping"},
          {title: "Study Session Selection"},
          {title: "Reviewer Selection"},
          {title: "Confirmation"}
        ];
      }
      return [
        {title: "Template Selection"},
        {title: "Assignment Selection"},
        {title: "Reviewer Selection"},
        {title: "Confirmation"}
      ];
    },
    workflowOptions() {
      return {
        options: this.$store.getters["table/workflow/getAll"].map(workflow => ({
          name: workflow.name,
          value: workflow.id,
        }))
      };
    },
    targetWorkflowSteps() {
      if (!this.targetWorkflowId) return [];
      return this.$store.getters["table/workflow_step/getFiltered"](
        item => item.workflowId === this.targetWorkflowId
      ) || [];
    },
  },
  watch: {
    assignmentType(newType, oldType) {
      if (oldType && newType !== oldType) {
        this.selectedAssignment = [];
        this.studySessionSelections = [];
        this.targetWorkflowId = null;
        this.workflowMapping = {};
        this.baseFileSelections = {};
        this.inputGroupValid = false;
        this.validationConfigurationNames = {};
      }
    },
    workflowSteps: {
      handler(newSteps) {
        if (this.assignmentType === 'study_session' && newSteps.length > 0) {
          // Initialize studySessionSelections as array of arrays
          this.studySessionSelections = newSteps.map(() => []);
        }
      },
      immediate: true
    }
  },
  methods: {
    getSubmission(studyId) {  
      const studySteps = this.$store.getters["table/study_step/getFiltered"](
        (s) => s.studyId === studyId
      ) || []; 
      for (const step of studySteps) {
        if (step.stepType === 1 && step.documentId !== null) {
          let document = this.$store.getters["table/document/get"](step.documentId);
          
          while(document && document.parentDocumentId !== null) {
            document = this.$store.getters["table/document/get"](document.parentDocumentId);
          }
          
          if (document && document.submissionId) {
            const submission = this.$store.getters["table/submission/get"](document.submissionId);
            if (submission) {
              return submission;
            }
          }
        }
      }
      
      return null;
    }, 

    getStepTypeName(stepType) {
      switch (stepType) {
        case 1: return 'Annotator';
        case 2: return 'Editor';
        default: return 'Unknown';
      }
    },
    getTargetStepOptions(stepType, currentStepId) {
      // First, order the target workflow steps based on workflowStepPrevious
      const orderedSteps = [];
      const stepPositionMap = new Map(); // Maps step.id to its position (1-based)
      const nextMap = new Map(this.targetWorkflowSteps.map(s => [s.workflowStepPrevious, s]));
      
      // Find the first step (where workflowStepPrevious is null)
      let current = this.targetWorkflowSteps.find(s => s.workflowStepPrevious === null);
      
      // Build ordered list by following the chain and track positions
      let position = 1;
      while (current) {
        orderedSteps.push(current);
        stepPositionMap.set(current.id, position);
        current = nextMap.get(current.id);
        position++;
      }
      
      // Filter by stepType and create options with correct step numbers
      const options = orderedSteps
        .filter(step => step.stepType === stepType)
        .map((step) => ({
          name: `Step ${stepPositionMap.get(step.id)}: ${this.getStepTypeName(step.stepType)}`,
          value: step.id,
        }));
      
      // Add "Previous Submission Document" placeholder only if:
      // 1. Current step is Annotator (type 1), AND
      // 2. Previous step in SOURCE workflow is also Annotator (type 1)
      if (stepType === 1 && currentStepId) {
        const currentSourceStep = this.workflowSteps.find(s => s.id === currentStepId);
        if (currentSourceStep && currentSourceStep.workflowStepPrevious) {
          const previousSourceStep = this.workflowSteps.find(
            s => s.id === currentSourceStep.workflowStepPrevious
          );
          if (previousSourceStep && previousSourceStep.stepType === 1) {
            options.unshift({
              name: '<Document> Revised Document',
              value: 'previousSubmission',
            });
          }
        }
      }
      
      return {
        options: options
      };
    },
    getWorkflowType(workflowId) {
        const workflow = this.$store.getters["table/workflow/get"](workflowId);
        return workflow ? workflow.name : "Unknown";
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
        firstName: "Unknown",
        lastName: "Unknown",
      };
    },
    userStudySessions(userId) {
      return this.$store.getters["table/study_session/getFiltered"](
          (s) => s.userId === userId
      );
    },
    isStudyClosed(studyId) {
      const study = this.$store.getters["table/study/get"](studyId);
      if (!study) {
        return false;
      }
      return study.closed === null ? true : false;
    },
    getPrimaryDocumentId(submissionId) {
      const submission = this.$store.getters["table/submission/get"](submissionId);
      const configuration = this.$store.getters["table/configuration/get"](submission.validationConfigurationId);
      const docs = this.$store.getters["table/document/getFiltered"](
          (d) => d.submissionId === submissionId && !d.deleted && d.type === 0
      );
      
      if (!docs || docs.length === 0) return null;
      
      // If configuration specifies a primary document key, try to use it
      if (configuration && configuration.primaryDocument) {
        const primaryDoc = docs.find(d => d.id === configuration.primaryDocument);
        if (primaryDoc) return primaryDoc.id;
      }
      
      // Otherwise, return the first PDF document
      return docs[0].id;
    },
    open() {
      this.reset();
      this.$refs.assignmentStepper.open();
    },
    reset() {
      this.selectedAssignment = [];
      this.selectedReviewer = [];
      this.assignmentTypeSelection = {};
      this.studySessionSelections = [];
      this.targetWorkflowId = null;
      this.workflowMapping = {};
      this.baseFileSelections = {};
      this.inputGroupValid = false;
      this.validationConfigurationNames = {};
      this.enableEmailNotification = false;
    },
    createAssignment() {
      this.$refs.assignmentStepper.setWaiting(true);
      
      const assignmentData = {
        template: this.template,
        assignmentType: this.assignmentType,
        reviewer: this.selectedReviewer,
        assignment: this.selectedAssignment[0],
        documents: this.workflowStepsAssignments,
        enableEmailNotification: this.enableEmailNotification,
        selectedAssignments: this.selectedAssignment,
      };
      
      // Add workflowMapping for study_session, documents for others
      if (this.assignmentType === 'study_session') {
        assignmentData.targetWorkflowId = this.targetWorkflowId;
        assignmentData.workflowMapping = this.workflowMapping;
      } else {
        assignmentData.documents = this.workflowStepsAssignments;
      }
      this.$socket.emit("assignmentCreateSingle", assignmentData, (res) => {
        this.$refs.assignmentStepper.setWaiting(false);
        if (res.success) {
          this.$refs.assignmentStepper.close();
          this.eventBus.emit("toast", {
            title: "Assignment created",
            message: "The assignment has been created successfully",
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to create assignment",
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
  },

};
</script>

<style scoped>
input {
  display: block;
  margin-bottom: 10px;
}

ul {
  list-style-type: none;
  padding: 0;
}

li {
  margin: 5px 0;
  cursor: pointer;
}

li:hover {
  background-color: #f0f0f0;
}

button {
  margin-left: 10px;
}

</style>
