<template>
  <StepperModal
      ref="assignmentStepper"
      :steps="steps"
      :validation="stepValid"
      size="xl"
      @submit="createAssignments">
    <template #title>
      <h5 class="modal-title">{{$t('dashboard.study.createBulkAssignment')}}</h5>
    </template>

    <template v-if="templates.length === 0" #error>
      <p class="text-center text-danger">{{$t('dashboard.study.noStudyTemplatesAvailable')}}</p>
      <p class="text-center">{{$t('dashboard.study.createTemplateToProceed')}}</p>
    </template>

    <template #step-1>
      <BasicForm
          ref="templateSelectionForm"
          v-model="templateSelection"
          :fields="templateSelectionFields"
      />
      <div class="mt-3"><strong>{{$t('dashboard.study.workflowSteps')}}</strong></div>
      <ul class="list-group">
        <li
            v-for="(workflowStep, index) in workflowSteps"
            :key="workflowStep.id" class="list-group-item"
            :class="(workflowStep.workflowStepDocument !== null) ? 'disabled': 'list-group-item-primary'">
          {{$t('dashboard.study.workflowStepWithIndex', {index: index + 1})}}
          {{ getStepTypeName(workflowStep.stepType) }}
        </li>
      </ul>
      <div class="mt-3">
        <label class="form-label"><strong>{{$t('dashboard.study.assignmentBase')}}</strong></label>
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
            <strong>{{ $t('dashboard.study.sendEmailNotificationToReviewer') }}</strong>
          </label>
        </div>
      </div>
    </template>

    <template #step-2>
      <div v-if="assignmentType === 'study_session'">
        <h6 class="text-secondary">{{ $t('dashboard.study.targetWorkflowSelection') }}</h6>
        <div class="mb-3">
          <label class="form-label"><strong>{{ $t('dashboard.study.selectTargetWorkflow') }}</strong></label>
          <FormSelect
              v-model="targetWorkflowId"
              :options="workflowOptions"
          />
        </div>

        <div v-if="targetWorkflowId && targetWorkflowSteps.length > 0">
          <h6 class="text-secondary mt-4">{{ $t('dashboard.study.workflowStepMapping') }}</h6>
          <p class="text-muted">{{ $t('dashboard.study.mapWorkflowStepToTarget') }}</p>

          <div
              v-for="(templateStep, index) in workflowSteps"
              :key="templateStep.id"
              class="mb-3"
          >
            <label class="form-label">
              <strong>
                {{ $t('dashboard.study.sourceStepTargetStep', {
                  index: index + 1,
                  stepType: getStepTypeName(templateStep.stepType)
                }) }}
              </strong>
            </label>
            <FormSelect
                v-model="workflowMapping[templateStep.id]"
                :options="{ options: getTargetStepOptions(templateStep.stepType, templateStep.id) }"
            />
          </div>
        </div>


        <div>
          <h6 class="text-secondary mt-4">{{ $t('dashboard.study.newStudyOwner') }}</h6>
          <div class="form-check">
            <input
                id="owner-session"
                v-model="newStudyOwner"
                type="radio"
                class="form-check-input"
                value="session_owner"
            />
            <label class="form-check-label" for="owner-session">
              {{ $t('dashboard.study.userOfStudySession') }}
            </label>
          </div>

          <div class="form-check">
            <input
                id="owner-current-user"
                v-model="newStudyOwner"
                type="radio"
                class="form-check-input"
                value="study_owner"
            />
            <label class="form-check-label" for="owner-current-user">
              {{ $t('dashboard.study.ownerOfStudy') }}
            </label>
          </div>
        </div>
      </div>
      <div v-else>
        <BasicTable
            v-model="selectedAssignments"
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
            v-model="selectedAssignments"
            :columns="currentTableColumns"
            :data="currentTableData"
            :options="documentTableOptions"
            :max-table-height="400"
        />
      </div>
      <div v-else>
        <div class="form-check">
          <input id="filterHasDocumentsCheckbox" v-model="filterHasDocuments" class="form-check-input" type="checkbox">
          <label class="form-check-label" for="filterHasDocumentsCheckbox">
            {{ $t('dashboard.study.filterUsersWithDocuments') }}
          </label>
          <br>
          <input
              id="filterSelectedDocumentsCheckbox" v-model="filterSelectedDocuments" class="form-check-input"
              type="checkbox">
          <label class="form-check-label" for="filterSelectedDocumentsCheckbox">
            {{ $t('dashboard.study.filterUsersFromPreviousDocuments') }}
          </label>
        </div>
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
        <div class="form-check">
          <input id="filterHasDocumentsCheckbox4" v-model="filterHasDocuments" class="form-check-input" type="checkbox">
          <label class="form-check-label" for="filterHasDocumentsCheckbox4">
            {{ $t('dashboard.study.filterUsersWithDocuments') }}
          </label>
          <br>
          <input
              id="filterSelectedDocumentsCheckbox4" v-model="filterSelectedDocuments" class="form-check-input"
              type="checkbox">
          <label class="form-check-label" for="filterSelectedDocumentsCheckbox4">
            {{ $t('dashboard.study.filterUsersFromPreviousDocuments') }}
          </label>
        </div>
        <BasicTable
            v-model="selectedReviewer"
            :columns="reviewerTableColumns"
            :data="reviewerTable"
            :options="reviewerTableOptions"
            :max-table-height="400"
        />
      </div>
      <div v-else>
        <BasicForm
            ref="selectionModeForm"
            v-model="reviewerSelectionMode"
            :fields="reviewerSelectionModeFields"
        />

        <div v-if="reviewerSelectionMode['mode'] === 'role'">
          <div class="mt-2">
            {{ $t('dashboard.study.defineTheNumberOfReviews') }}
          </div>
          <BasicForm
              v-if="roleSelectionFields.length > 0"
              ref="roleBasedSelectionForm"
              v-model="roleSelection"
              class="mt-4"
              :fields="roleSelectionFields"
          />
          <div v-else>
            <p class="text-center text-danger mt-4">{{ $t('dashboard.study.noRolesAvailable') }}</p>
            <p class="text-center">{{ $t('dashboard.study.selectReviewersOrChangeMode') }}</p>
          </div>
        </div>
        <div v-else-if="reviewerSelectionMode['mode'] === 'reviewer'">
          <div class="mt-2">
            {{ $t('dashboard.study.discontributeDocuments') }}
          </div>
          <div class="mb-4">
            {{ $t('dashboard.study.remainingAssignments') }} <strong>{{ remainingAssignments }}</strong>
          </div>

          <BasicForm
              ref="reviewerBasedSelectionForm"
              v-model="reviewerSelection"
              :fields="reviewerSelectionFields"
          />
        </div>
        <div v-else>
          {{ $t('dashboard.study.selectMode') }}
        </div>
      </div>
    </template>

    <template #step-5>
      <div v-if="assignmentType === 'study_session'">
        <BasicForm
            ref="selectionModeForm"
            v-model="reviewerSelectionMode"
            :fields="reviewerSelectionModeFields"
        />

        <div v-if="reviewerSelectionMode['mode'] === 'role'">
          <div class="mt-2">
            {{ $t('dashboard.study.defineTheNumberOfReviews') }}
          </div>
          <BasicForm
              v-if="roleSelectionFields.length > 0"
              ref="roleBasedSelectionForm"
              v-model="roleSelection"
              class="mt-4"
              :fields="roleSelectionFields"
          />
          <div v-else>
            <p class="text-center text-danger mt-4">{{ $t('dashboard.study.noRolesAvailable') }}</p>
            <p class="text-center">{{ $t('dashboard.study.selectReviewersOrChangeMode') }}</p>
          </div>
        </div>
        <div v-else-if="reviewerSelectionMode['mode'] === 'reviewer'">
          <div class="mt-2">
            {{ $t('dashboard.study.discontributeDocuments') }}
          </div>
          <div class="mb-4">
            {{ $t('dashboard.study.remainingAssignments') }} <strong>{{ remainingAssignments }}</strong>
          </div>

          <BasicForm
              ref="reviewerBasedSelectionForm"
              v-model="reviewerSelection"
              :fields="reviewerSelectionFields"
          />
        </div>
        <div v-else>
          {{ $t('dashboard.study.selectMode') }}
        </div>
      </div>
      <div v-else>
        <p>
          {{ $t('dashboard.study.createAssignmentConfirmPrompt') }}
        </p>
        <p v-if="reviewerSelectionMode.mode !== 'session_user'" class="text-danger">
          <strong>{{ $t('dashboard.study.warning') }}</strong> {{ $t('dashboard.study.notReviewOwnDocument') }}
          <br>
          {{ $t('dashboard.study.warning1') }} <br>
          {{ $t('dashboard.study.warning2') }}
        </p>
        <p v-else class="text-warning">
          <strong>{{ $t('dashboard.study.warning') }}</strong> {{ $t('dashboard.study.sessionUserSelectionWarning') }}
          <br>
          <span v-if="unmatchedReviewersForSessions.length > 0" class="text-danger">
            {{ $t('dashboard.study.reviewersWithoutMatchingStudySessions') }}
            <ul>
              <li v-for="reviewer in unmatchedReviewersForSessions" :key="reviewer.id">
                {{ reviewer.firstName }} {{ reviewer.lastName }} (ID: {{ reviewer.id }})
              </li>
            </ul>
          </span>
          <span v-else>
            {{ $t('dashboard.study.allReviewersHaveMatchingStudySessions') }}
          </span>
        </p>

        <div class="container">
          <div class="row mb-2">
            <div class="col-2"><strong>{{ $t('dashboard.study.template') }}</strong></div>
            <div class="col-8">{{ template.name }}</div>
          </div>
          <div class="row mb-2">
            <div class="col-2"><strong>{{ $t('dashboard.study.workflow') }}</strong></div>
            <div class="col-8">{{ workflow.name }}</div>
          </div>
          <div class="row mb-2">
            <div class="col-2"><strong>{{ $t('dashboard.study.documents') }}</strong></div>
            <div class="col-8">{{ selectedAssignments.length }}</div>
          </div>
          <div class="row mb-2">
            <div class="col-2"><strong>{{ $t('dashboard.study.reviewers') }}</strong></div>
            <div class="col-8">{{ selectedReviewer.length }}</div>
          </div>
          <div class="row mb-2">
            <div class="col-2"><strong>{{ $t('dashboard.study.reviewsToCreate') }}</strong></div>
            <div class="col-8">{{ numberOfReviews }}</div>
          </div>
          <div class="row mb-2">
            <div class="col-2"><strong>{{ $t('dashboard.study.selectionMode') }}</strong></div>
            <div class="col-8">
              {{
                reviewerSelectionModeFields[0].options.find(field => field.value === reviewerSelectionMode.mode).name
              }}
            </div>
          </div>
          <div v-if="reviewerSelectionMode.mode === 'role'">
            <div class="row mb-2">
              <div class="col-2"><strong>{{ $t('dashboard.study.roles') }}</strong></div>
              <div class="col-8">
                <ul>
                  <li v-for="(value, key) in listOfSelectedRoles" :key="key">
                    - {{ value.role }}: {{ value.value }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div v-if="reviewerSelectionMode.mode === 'reviewer'">
            <div class="row mb-2">
              <div class="col-2"><strong>{{ $t('dashboard.study.reviewers') }}</strong></div>
              <div class="col-8">
                <ul>
                  <li v-for="(value, key) in listOfSelectedReviewers" :key="key">
                    - {{ value.reviewer }}: {{ value.value }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #step-6>
      <p>
        {{ $t('dashboard.study.createAssignmentConfirmPrompt') }}
      </p>
      <p v-if="reviewerSelectionMode.mode !== 'session_user'" class="text-danger">
        <strong>{{ $t('dashboard.study.warning') }}</strong> {{ $t('dashboard.study.notReviewOwnDocument') }}
        <br>
        {{ $t('dashboard.study.warning1') }} <br>
        {{ $t('dashboard.study.warning2') }}
      </p>
      <p v-else class="text-warning">
        <strong>{{ $t('dashboard.study.warning') }}</strong> {{ $t('dashboard.study.sessionUserSelectionWarning') }}
        <br>
        <span v-if="unmatchedReviewersForSessions.length > 0" class="text-danger">
          {{ $t('dashboard.study.reviewersWithoutMatchingStudySessions') }}
          <ul>
            <li v-for="reviewer in unmatchedReviewersForSessions" :key="reviewer.id">
              {{ reviewer.firstName }} {{ reviewer.lastName }} (ID: {{ reviewer.id }})
            </li>
          </ul>
        </span>
        <span v-else>
          {{ $t('dashboard.study.allReviewersHaveMatchingStudySessions') }}
        </span>
      </p>

      <div class="container">
        <div class="row mb-2">
          <div class="col-2"><strong>{{ $t('dashboard.study.template') }}</strong></div>
          <div class="col-8">{{ template.name }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-2"><strong>{{ $t('dashboard.study.workflow') }}</strong></div>
          <div class="col-8">{{ workflow.name }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-2"><strong>{{ $t('dashboard.study.documents') }}</strong></div>
          <div class="col-8">{{ selectedAssignments.length }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-2"><strong>{{ $t('dashboard.study.reviewers') }}</strong></div>
          <div class="col-8">{{ selectedReviewer.length }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-2"><strong>{{ $t('dashboard.study.reviewsToCreate') }}</strong></div>
          <div class="col-8">{{ numberOfReviews }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-2"><strong>{{ $t('dashboard.study.selectionMode') }}</strong></div>
          <div class="col-8">
            {{
              reviewerSelectionModeFields[0].options.find(field => field.value === reviewerSelectionMode.mode).name
            }}
          </div>
        </div>
        <div v-if="reviewerSelectionMode.mode === 'role'">
          <div class="row mb-2">
            <div class="col-2"><strong>{{ $t('dashboard.study.roles') }}</strong></div>
            <div class="col-8">
              <ul>
                <li v-for="(value, key) in listOfSelectedRoles" :key="key">
                  - {{ value.role }}: {{ value.value }}
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div v-if="reviewerSelectionMode.mode === 'reviewer'">
          <div class="row mb-2">
            <div class="col-2"><strong>{{ $t('dashboard.study.reviewers') }}</strong></div>
            <div class="col-8">
              <ul>
                <li v-for="(value, key) in listOfSelectedReviewers" :key="key">
                  - {{ value.reviewer }}: {{ value.value }}
                </li>
              </ul>
            </div>
          </div>
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
import {downloadObjectsAs, resolveApiMessage} from "@/assets/utils";

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
  }, {
    table: "user",
  }, {
    table: "study",
    filter: [{
      key: "template",
      value: true
    }]
  },
    "submission",
    {
      table: "template",
    }
  ],
  components: {StepperModal, BasicTable, BasicForm, FormSelect},
  data() {
    return {
      selectedReviewer: [],
      reviewerSelectionMode: {},
      roleSelection: {},
      templateSelection: {},
      assignmentTypeSelection: {},
      selectedAssignments: [],
      reviewerSelection: {},
      targetWorkflowId: null,
      workflowMapping: {},
      filterHasDocuments: false,
      filterSelectedDocuments: false,
      enableEmailNotification: false,
      newStudyOwner: 'session_owner',
      documentTableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        scrollY: true,
        scrollX: true,
        onlyOneRowSelectable: false,
        search: true,
        pagination: 10,
      },
      reviewerTableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        scrollY: true,
        scrollX: true,
        onlyOneRowSelectable: false,
        search: true,
        pagination: 10,
      },
    };
  },
  computed: {
    assignmentType() {
      return this.assignmentTypeSelection.type || 'document';
    },
    stepValid() {
      if (this.assignmentType === 'study_session') {
        return [
          this.workflowStepsAssignment.length !== 0 && !!this.assignmentType,
          !!this.targetWorkflowId && this.isWorkflowMappingComplete,
          this.selectedAssignments.length > 0,
          this.selectedReviewer.length > 0,
          this.selectionValid,
          this.unmatchedReviewersForSessions.length === 0
        ];
      }
      return [
        this.workflowStepsAssignment.length !== 0 && !!this.assignmentType,
        this.selectedAssignments.length > 0,
        this.selectedReviewer.length > 0,
        this.selectionValid,
        true
      ];
    },
    isWorkflowMappingComplete() {
      if (!this.targetWorkflowId) return false;
      return this.workflowSteps.every((step) => {
        return this.workflowMapping[step.id] !== undefined && this.workflowMapping[step.id] !== null;
      });
    },
    selectionValid() {
      if (this.reviewerSelectionMode && this.reviewerSelectionMode.mode === 'reviewer') {
        return this.remainingAssignments === 0;
      } else if (this.reviewerSelectionMode && this.reviewerSelectionMode.mode === 'role') {
        return Object.values(this.roleSelection).map((value) => parseInt(value, 0)).reduce((a, b) => a + b, 0) > 0;
      } else if (this.reviewerSelectionMode && this.reviewerSelectionMode.mode === 'session_user') {
        // For session_user mode, no additional validation needed
        return true;
      }
      return false;
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
        return this.selectedAssignments.map((submission) => {
          return this.workflowSteps.map((c, index) => {
            if (index === 0) {
              const primaryDocId = this.getPrimaryDocumentId(submission.id);
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
        });
      } else {
        return this.selectedAssignments.map((document) => {
          return this.workflowSteps.map((c, index) => {
            return {
              documentId: (index === 0) ? document.id : null,
              workflowStepId: c.id
            }
          });
        });
      }
    },
    numberOfReviews() {
      if (this.reviewerSelectionMode.mode === 'role') {
        return Object.values(this.roleSelection).map((value) => parseInt(value, 0)).reduce((a, b) => a + b, 0) * this.selectedAssignments.length
      } else {
        return Object.values(this.reviewerSelection).map((value) => parseInt(value, 0)).reduce((a, b) => a + b, 0)
      }
    },
    documents() {
      return this.$store.getters["table/document/getFiltered"]((d) => d.readyForReview);
    },
    submissions() {
      return this.$store.getters["table/submission/getAll"];
    },
    currentTableData() {
      if (this.assignmentType === 'submission') return this.submissionsTable;
      if (this.assignmentType === 'study_session') return this.studySessionsTable;
      return this.documentsTable;
    },
    currentTableColumns() {
      if (this.assignmentType === 'submission') return this.submissionColumns;
      if (this.assignmentType === 'study_session') return this.studySessionsTableColumns;
      return this.documentsTableColumns;
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
            const studyOwner = this.$store.getters["table/user/get"](study.userId);
            const submission = this.getSubmission(session.studyId);
            return {
              id: session.id,
              studyId: session.studyId,
              userId: this.newStudyOwner === 'session_owner' ? user.id : studyOwner.id,
              completeUserName: user ? `${user.firstName} ${user.lastName}` : this.$t('dashboard.study.unknownUser'),
              firstName: user ? user.firstName : this.$t('common.unknown'),
              lastName: user ? user.lastName : this.$t('common.unknown'),
              studyCompleteUserName: studyOwner ? `${studyOwner.firstName} ${studyOwner.lastName}` : this.$t('dashboard.study.unknownUser'),
              studyUserId: studyOwner.userId,
              studyFirstName: studyOwner ? studyOwner.firstName : this.$t('common.unknown'),
              studyLastName: studyOwner ? studyOwner.lastName : this.$t('common.unknown'),
              workflowType: this.getWorkflowType(study.workflowId),
              submissionGroup: submission && submission.group ? submission.group : this.$t('common.na'),
              status: session.end === null ? "Running" : "Finished",
              createdAt: new Date(session.createdAt).toLocaleString(),
            };
          });
    },
    studySessionsTableColumns() {
      return [
        {name: this.$t('common.id'), key: "id"},
        {name: this.$t('dashboard.study.sessionUserName'), key: "completeUserName", sortable: true},
        {name: this.$t('dashboard.study.studyOwnerUserName'), key: "studyCompleteUserName", sortable: true},
        {name: this.$t('dashboard.study.workflowType'), key: "workflowType", sortable: true},
        {name: this.$t('common.createdAt'), key: "createdAt", sortable: true},
        {name: this.$t('dashboard.study.submissionGroup'), key: "submissionGroup", sortable: true, filter: this.groupFilterOptions},
        {
          name: this.$t('common.status'),
          key: "status",
          type: "badge",
          sortable: true,
          typeOptions: {
            keyMapping: {
              Running: this.$t('dashboard.study.running'),
              Finished: this.$t('dashboard.study.finished'),
            },
            classMapping: {
              Running: "bg-primary",
              Finished: "bg-success",
            }
          }
        },
      ];
    },
    documentsTable() {
      return this.documents.filter((d) => d.type === 0).map((d) => {
        let newD = {...d};
        newD.type = d.type === 0 ? this.$t('documents.types.pdf') : this.$t('documents.types.html');
        const user = this.$store.getters["table/user/get"](d.userId)
        newD.firstName = (user) ? user.firstName : this.$t('common.unknown');
        newD.lastName = (user) ? user.lastName : this.$t('common.unknown');
        return newD;
      })
    },
    documentsTableColumns() {
      return [
        {name: this.$t('common.id'), key: "id"},
        {name: this.$t('documents.document'), key: "name"},
        {name: this.$t('common.firstName'), key: "firstName"},
        {name: this.$t('common.lastName'), key: "lastName"},
      ]
    },
    submissionsTable() {
      return this.submissions.map((s) => {
        let newS = {...s};
        const user = this.$store.getters["table/user/get"](s.userId);
        newS.name = s.name || this.$t('dashboard.study.submissionWithId', { id: s.id });
        newS.userName = user ? user.userName : this.$t('common.na');
        newS.firstName = user ? user.firstName : this.$t('common.unknown');
        newS.lastName = user ? user.lastName : this.$t('common.unknown');
        newS.group = (s.group !== null && s.group !== undefined && s.group !== '') ? s.group : '';
        return newS;
      });
    },
    submissionColumns() {
      return [
        {name: this.$t('common.id'), key: "id"},
        {name: this.$t('common.userName'), key: "userName"},
        {name: this.$t('common.firstName'), key: "firstName"},
        {name: this.$t('common.lastName'), key: "lastName"},
        {name: this.$t('common.groupId'), key: "group", filter: this.groupFilterOptions},
        {name: this.$t('common.createdAt'), key: "createdAt"},
      ]
    },
    reviewerTable() {
      return this.reviewer.map((r) => {
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
      })
          .filter((reviewer) => {
            if (!this.filterHasDocuments && !this.filterSelectedDocuments) {
              return true;
            }
            if (this.filterHasDocuments && reviewer.documents < 1) {
              return false;
            }
            return !(this.filterSelectedDocuments && !this.selectedAssignmentUserIds.includes(reviewer.id));
          })
    },
    selectedAssignmentUserIds() {
      if (this.newStudyOwner !== 'study_owner') {
        return this.selectedAssignments.map((assignment) => {
          const study = this.$store.getters["table/study/get"](assignment.studyId);
          return study ? study.userId : null;
        }).filter(userId => userId !== null);
      } else {
        return this.selectedAssignments.map((assignment) => assignment.userId);
      }
    },
    roles() {
      return this.$store.getters["admin/getSystemRoles"] || [];
    },
    reviewerRoles() { // unique roles of all possible reviewers
      return [...new Set(this.reviewerTable.flatMap(obj => {
        return obj.rolesNames.split(/,\s*/).filter(n => n !== "");
      }))];
    },
    selectedReviewerRoles() { // unique roles assigned to reviewers
      return [...new Set(this.selectedReviewer.flatMap(obj => obj.roles))];
    },
    reviewerTableColumns() {
      return [
        {name: this.$t('common.id'), key: "id"},
        {name: this.$t('common.extId'), key: "extId"},
        {name: this.$t('common.firstName'), key: "firstName"},
        {name: this.$t('common.lastName'), key: "lastName"},
        {name: this.$t('dashboard.projects.numberOfAssignments'), key: "studySessions"},
        {
          name: this.$t('dashboard.study.documents'),
          key: "documents",
          filter: {
            type: "numeric",
            defaultOperator: "gte",
            defaultValue: 0,
          },
        },
        {
          name: this.$t('dashboard.study.roles'),
          key: "rolesNames",
          filter: this.reviewerRoles.map(r => ({key: r, name: r})),
        },
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
        options.unshift({key: '', name: this.$t('nlp.inputFiles.noGroupId')});
      }

      return options;
    },
    reviewer() {
      return this.$store.getters["table/user/getAll"];
    },
    steps() {
      if (this.assignmentType === 'study_session') {
        return [
          {title: this.$t('dashboard.study.templateSelection')},
          {title: this.$t('dashboard.study.workflowMapping')},
          {title: this.$t('dashboard.study.studySessionSelection')},
          {title: this.$t('dashboard.study.reviewerSelection')},
          {title: this.$t('dashboard.study.distribution')},
          {title: this.$t('common.confirmation')}
        ];
      }
      return [
        {title: this.$t('dashboard.study.templateSelection')},
        {title: this.$t('dashboard.study.documentSelection')},
        {title: this.$t('dashboard.study.reviewerSelection')},
        {title: this.$t('dashboard.study.distribution')},
        {title: this.$t('common.confirmation')}
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
    reviewerNumberOfAssignments() {
      return Object.values(this.reviewerSelection).map((value) => parseInt(value, 0)).reduce((a, b) => a + b, 0)
    },
    remainingAssignments() {
      return this.selectedAssignments.length - this.reviewerNumberOfAssignments;
    },
    listOfSelectedRoles() {
      return Object.keys(this.roleSelection).map((key) => {
        return {
          role: this.roles.find((role) => role.id === parseInt(key)).name,
          value: this.roleSelection[key]
        }
      })
    },
    listOfSelectedReviewers() {
      return Object.keys(this.reviewerSelection).map((key) => {
        return {
          reviewer: this.reviewer.find(reviewer => reviewer.id === parseInt(key)).firstName + " " + this.reviewer.find(reviewer => reviewer.id === parseInt(key)).lastName,
          value: this.reviewerSelection[key]
        }
      })
    },
    unmatchedReviewersForSessions() {
      if (this.assignmentType !== 'study_session' || this.reviewerSelectionMode.mode !== 'session_user') {
        return [];
      }

      const selectedSessionUserIds = new Set(
          this.selectedAssignments.map(session => {
            const studySession = this.getStudySession(session.id);
            return studySession ? studySession.userId : null;
          }).filter(userId => userId !== null)
      );

      return this.selectedReviewer.filter(reviewer => {
        return !selectedSessionUserIds.has(reviewer.id);
      });
    },
    templateSelectionFields() {
      return [
        {
          key: "template",
          label: this.$t('studies.template'),
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
          {value: 'document', name: this.$t('documents.title')},
          {value: 'submission', name: this.$t('nlp.inputFiles.submissions')},
          {value: 'study_session', name: this.$t('dashboard.study.studySessions')}
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
          {value: null, name: this.$t('dashboard.study.noEmailWillBeSent')},
          ...this.emailTemplates.map(t => ({
            value: t.id,
            name: t.name
          }))
        ]
      };
    },
    reviewerSelectionModeFields() {
      const baseOptions = [
        {
          name: this.$t('dashboard.study.roleBasedSelection'),
          value: "role"
        },
        {name: this.$t('dashboard.study.reviewerBasedSelection'), value: "reviewer"},
      ];

      // Add session_user option only for study_session assignment type
      if (this.assignmentType === 'study_session') {
        baseOptions.push({
          name: this.$t('dashboard.study.sessionUserBasedSelection'),
          value: "session_user"
        });
      }

      return [
        {
          key: "mode",
          label: this.$t('dashboard.study.reviewerSelectionMode'),
          type: "select",
          options: baseOptions,
          required: true,
        },
      ]
    },
    roleSelectionFields() {
      return this.selectedReviewerRoles.map(roleId => ({
        key: this.roles.find((role) => role.id === roleId).id,
        label: this.$t('dashboard.study.nameOfReviewsForRole') + this.roles.find((role) => role.id === roleId).name,
        type: "slider",
        class: 'custom-slider-class',
        min: 0,
        max: 10,
        step: 1,
        unit: this.$t('dashboard.study.reviews')
      }));
    },
    reviewerSelectionFields() {
      return this.selectedReviewer.map(user => ({
        key: user.id,
        label: this.$t('dashboard.study.nameofReviewsForUsers') + user.firstName + " " + user.lastName,
        type: "slider",
        class: 'custom-slider-class',
        min: 0,
        max: Number(this.remainingAssignments + Number(this.reviewerSelection[user.id])),
        step: 1,
        unit: this.$t('dashboard.study.reviews')
      }));
    },
  },
  watch: {
    selectedReviewer: {
      handler() {
        this.reviewerSelection = {};
        this.roleSelection = {};
      },
      deep: true
    },
    assignmentType(newType, oldType) {
      if (oldType && newType !== oldType) {
        this.selectedAssignments = [];
      }
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

          while (document && document.parentDocumentId !== null) {
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
    getWorkflowType(workflowId) {
      const workflow = this.$store.getters["table/workflow/get"](workflowId);
      return workflow ? workflow.name : this.$t('common.unknown');
    },
    getStepTypeName(stepType) {
      switch (stepType) {
        case 1:
          return this.$t('dashboard.study.annotator');
        case 2:
          return this.$t('dashboard.study.editor');
        default:
          return this.$t('common.unknown');
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
            name: this.$t('dashboard.study.workflowStepOption', {
              index: stepPositionMap.get(step.id),
              type: this.getStepTypeName(step.stepType)
            }),
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
              name: this.$t('dashboard.study.revisedDocument'),
              value: 'previousSubmission',
            });
          }
        }
      }

      return options;
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
    getStudySession(sessionId) {
      return this.$store.getters["table/study_session/get"](sessionId);
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
      this.reviewerSelection = {};
      this.roleSelection = {};
      this.selectedReviewer = [];
      this.selectedAssignments = [];
      this.assignmentTypeSelection = {};
      this.emailTemplateSelection = null;
      this.targetWorkflowId = null;
      this.workflowMapping = {};
    },
    createAssignments() {
      // Start progress tracking with a unique ID
      const progressId = this.$refs.assignmentStepper.startProgress();

      const socketData = {
        template: this.template,
        selectedReviewer: this.selectedReviewer,
        selectedAssignments: this.selectedAssignments,
        reviewerSelection: this.reviewerSelection,
        roleSelection: this.roleSelection,
        mode: this.reviewerSelectionMode.mode,
        roles: this.roles,
        assignmentType: this.assignmentType,
        enableEmailNotification: this.enableEmailNotification,
        progressId: progressId, // Pass progress ID to backend for progress updates
      };

      // Add workflowMapping for study_session, documents for others
      if (this.assignmentType === 'study_session') {
        socketData.targetWorkflowId = this.targetWorkflowId;
        socketData.workflowMapping = this.workflowMapping;
      } else {
        socketData.documents = this.workflowStepsAssignments;
      }

      this.$socket.emit("assignmentCreateBulk", socketData, (res) => {
        this.$refs.assignmentStepper.stopProgress();
        if (res.success) {
          if (this.reviewerSelectionMode.mode === 'role') {

            const filename = "assignments";
            const returnData = Object.keys(res.data).map((assignmentId) => {
              let assignment = null;
              if (this.assignmentType === 'document') {
                assignment = this.documentsTable.find((document) => document.id === Number(assignmentId));
              } else {
                assignment = this.submissionsTable.find((submission) => submission.id === Number(assignmentId));
              }
              if (!assignment) {
                console.error(`Assignment with ID ${assignmentId} not found.`);
                return null;
              }

              const assignmentUser = this.reviewer.find((reviewer) => reviewer.id === assignment.userId);
              const reviewer = res.data[assignmentId];

              const csv = {
                "assignedToName": assignmentUser.firstName + " " + assignmentUser.lastName,
                "assignedToFirstName": assignmentUser.firstName,
                "assignedToLastName": assignmentUser.lastName,
              }

              reviewer.forEach((reviewerId, index) => {
                const reviewerUser = this.reviewer.find((reviewer) => reviewer.id === Number(reviewerId));
                csv[`reviewer_${index + 1}`] = reviewerUser.firstName + " " + reviewerUser.lastName;
              });

              return csv;
            });

            downloadObjectsAs(returnData, filename, "csv");
          }
          this.$refs.assignmentStepper.close();
          this.eventBus.emit("toast", {
            title: this.$t('dashboard.study.assignmentCreated'),
            message: this.$t('dashboard.study.assignmentCreatedMessage'),
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: this.$t('dashboard.study.failedToCreateAssignment'),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      })
    }
  },

}
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

.list-group-item {
  cursor: default;
}

.list-group-item:hover {
  background-color: transparent;
}
</style>