<template>
  <StepperModal
      ref="assignmentStepper"
      :steps="steps"
      :validation="stepValid"
      size="xl"
      @submit="createAssignments">
    <template #title>
      <h5 class="modal-title">Create bulk assignment</h5>
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
              v-for="(templateStep, index) in workflowSteps"
              :key="templateStep.id"
              class="mb-3"
          >
            <label class="form-label">
              <strong>Source Step {{ index + 1 }} ({{ getStepTypeName(templateStep.stepType) }}) → Target Step:</strong>
            </label>
            <FormSelect
                v-model="workflowMapping[templateStep.id]"
                :options="{ options: getTargetStepOptions(templateStep.stepType) }"
            />
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

    <template  #step-3>
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
          <input v-model="filterHasDocuments" class="form-check-input" type="checkbox" id="filterHasDocumentsCheckbox">
          <label class="form-check-label" for="filterHasDocumentsCheckbox">
            Filter only users with documents
          </label>
          <br>
          <input v-model="filterSelectedDocuments" class="form-check-input" type="checkbox"
                 id="filterSelectedDocumentsCheckbox">
          <label class="form-check-label" for="filterSelectedDocumentsCheckbox">
            Filter only users from previous selected documents
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
          <input v-model="filterHasDocuments" class="form-check-input" type="checkbox" id="filterHasDocumentsCheckbox4">
          <label class="form-check-label" for="filterHasDocumentsCheckbox4">
            Filter only users with documents
          </label>
          <br>
          <input v-model="filterSelectedDocuments" class="form-check-input" type="checkbox"
                 id="filterSelectedDocumentsCheckbox4">
          <label class="form-check-label" for="filterSelectedDocumentsCheckbox4">
            Filter only users from previous selected documents
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
            Define the number of reviews that each user of the role should perform:
          </div>
          <BasicForm
              v-if="roleSelectionFields.length > 0"
              ref="roleBasedSelectionForm"
              v-model="roleSelection"
              class="mt-4"
              :fields="roleSelectionFields"
          />
          <div v-else>
            <p class="text-center text-danger mt-4">There are no roles available!</p>
            <p class="text-center">Please select reviewers with roles or change selection mode!</p>
          </div>
        </div>
        <div v-else-if="reviewerSelectionMode['mode'] === 'reviewer'">
          <div class="mt-2">
            Distribute the documents between the selected reviewers:
          </div>
          <div class="mb-4">
            Remaining Assignments: <strong>{{ this.remainingAssignments }}</strong>
          </div>

          <BasicForm
              ref="reviewerBasedSelectionForm"
              v-model="reviewerSelection"
              :fields="reviewerSelectionFields"
          />
        </div>
        <div v-else>
          Please select a reviewer selection mode
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
            Define the number of reviews that each user of the role should perform:
          </div>
          <BasicForm
              v-if="roleSelectionFields.length > 0"
              ref="roleBasedSelectionForm"
              v-model="roleSelection"
              class="mt-4"
              :fields="roleSelectionFields"
          />
          <div v-else>
            <p class="text-center text-danger mt-4">There are no roles available!</p>
            <p class="text-center">Please select reviewers with roles or change selection mode!</p>
          </div>
        </div>
        <div v-else-if="reviewerSelectionMode['mode'] === 'reviewer'">
          <div class="mt-2">
            Distribute the documents between the selected reviewers:
          </div>
          <div class="mb-4">
            Remaining Assignments: <strong>{{ this.remainingAssignments }}</strong>
          </div>

          <BasicForm
              ref="reviewerBasedSelectionForm"
              v-model="reviewerSelection"
              :fields="reviewerSelectionFields"
          />
        </div>
        <div v-else>
          Please select a reviewer selection mode
        </div>
      </div>
      <div v-else>
        <p>
          Are you sure you want to create the assignment with the following details?
        </p>
        <p class="text-danger">
          <strong>Warning:</strong> The assignment process will make sure that a reviewer not reviews their own document.
          <br>
          This could lead to a failure in the assignment process, <br>
          so make sure that the values are set correct for a successful assignment.
        </p>

        <div class="container">
          <div class="row mb-2">
            <div class="col-2"><strong>Template:</strong></div>
            <div class="col-8">{{ template.name }}</div>
          </div>
          <div class="row mb-2">
            <div class="col-2"><strong>Workflow:</strong></div>
            <div class="col-8">{{ workflow.name }}</div>
          </div>
          <div class="row mb-2">
            <div class="col-2"><strong>Documents:</strong></div>
            <div class="col-8">{{ selectedAssignments.length }}</div>
          </div>
          <div class="row mb-2">
            <div class="col-2"><strong>Reviewers:</strong></div>
            <div class="col-8">{{ selectedReviewer.length }}</div>
          </div>
          <div class="row mb-2">
            <div class="col-2"><strong>Reviews to create:</strong></div>
            <div class="col-8">{{ numberOfReviews }}</div>
          </div>
          <div class="row mb-2">
            <div class="col-2"><strong>Selection Mode:</strong></div>
            <div class="col-8">
              {{ reviewerSelectionModeFields[0].options.find(field => field.value === reviewerSelectionMode.mode).name }}
            </div>
          </div>
          <div v-if="reviewerSelectionMode.mode === 'role'">
            <div class="row mb-2">
              <div class="col-2"><strong>Roles:</strong></div>
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
              <div class="col-2"><strong>Reviewers:</strong></div>
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
        Are you sure you want to create the assignment with the following details?
      </p>
      <p class="text-danger">
        <strong>Warning:</strong> The assignment process will make sure that a reviewer not reviews their own document.
        <br>
        This could lead to a failure in the assignment process, <br>
        so make sure that the values are set correct for a successful assignment.
      </p>

      <div class="container">
        <div class="row mb-2">
          <div class="col-2"><strong>Template:</strong></div>
          <div class="col-8">{{ template.name }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-2"><strong>Workflow:</strong></div>
          <div class="col-8">{{ workflow.name }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-2"><strong>Documents:</strong></div>
          <div class="col-8">{{ selectedAssignments.length }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-2"><strong>Reviewers:</strong></div>
          <div class="col-8">{{ selectedReviewer.length }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-2"><strong>Reviews to create:</strong></div>
          <div class="col-8">{{ numberOfReviews }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-2"><strong>Selection Mode:</strong></div>
          <div class="col-8">
            {{ reviewerSelectionModeFields[0].options.find(field => field.value === reviewerSelectionMode.mode).name }}
          </div>
        </div>
        <div v-if="reviewerSelectionMode.mode === 'role'">
          <div class="row mb-2">
            <div class="col-2"><strong>Roles:</strong></div>
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
            <div class="col-2"><strong>Reviewers:</strong></div>
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
import {downloadObjectsAs} from "@/assets/utils";

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
    "submission"
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
        search: true
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
        search: true
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
          true
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
      return this.workflowSteps.every((step, index) => {
        return this.workflowMapping[step.id] !== undefined && this.workflowMapping[step.id] !== null;
      });
    },
    selectionValid() {
      if (this.reviewerSelectionMode && this.reviewerSelectionMode.mode === 'reviewer') {
        return this.remainingAssignments === 0;
      } else if (this.reviewerSelectionMode && this.reviewerSelectionMode.mode === 'role') {
        return Object.values(this.roleSelection).map((value) => parseInt(value, 0)).reduce((a, b) => a + b, 0) > 0;
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
      console.log(this.$store.getters["table/workflow_step/getFiltered"](item => item.workflowId === this.template.workflowId))
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
          
          return {
            id: session.id,
            studyId: session.studyId,
            userId: session.userId,
            firstName: user ? user.firstName : 'Unknown',
            lastName: user ? user.lastName : 'Unknown',
            workflowType: this.getWorkflowType(study.workflowId),
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
    documentsTable() {
      return this.documents.filter((d) => d.type !== 4).map((d) => {
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
        {name: "User Name", key: "userName"},
        {name: "First Name", key: "firstName"},
        {name: "Last Name", key: "lastName"},
        {name: "Group ID", key: "group", filter: this.groupFilterOptions},
        {name: "Created At", key: "createdAt"},
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
      return this.selectedAssignments.map((assignment) => assignment.userId);
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
        {name: "ID", key: "id"},
        {name: "extId", key: "extId"},
        {name: "First Name", key: "firstName"},
        {name: "Last Name", key: "lastName"},
        {name: "Number of Assignments", key: "studySessions"},
        {
          name: "Documents",
          key: "documents",
          filter: {
            type: "numeric",
            defaultOperator: "gte",
            defaultValue: 0,
          },
        },
        {
          name: "Roles",
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
        options.unshift({key: '', name: 'No GroupID'});
      }

      return options;
    },
    reviewer() {
      return this.$store.getters["table/user/getAll"];
    },
    steps() {
      if (this.assignmentType === 'study_session') {
        return [
          {title: "Template Selection"},
          {title: "Workflow Mapping"},
          {title: "Study Session Selection"},
          {title: "Reviewer Selection"},
          {title: "Distribution"},
          {title: "Confirmation"}
        ];
      }
      return [
        {title: "Template Selection"},
        {title: "Document Selection"},
        {title: "Reviewer Selection"},
        {title: "Distribution"},
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
          {value: 'study_session', name: 'Study Sessions'}
        ]
      };
    },
    reviewerSelectionModeFields() {
      return [
        {
          key: "mode",
          label: "Reviewer Selection Mode",
          type: "select",
          options: [
            {
              name: "Role-based selection (the number of documents that should be reviewed by each user of the selected roles)",
              value: "role"
            },
            {name: "Reviewer-based selection (distribute document between the selected reviewers)", value: "reviewer"},
          ],
          required: true,
        },
      ]
    },
    roleSelectionFields() {
      return this.selectedReviewerRoles.map(roleId => ({
        key: this.roles.find((role) => role.id === roleId).id,
        label: "Number of reviews for role: " + this.roles.find((role) => role.id === roleId).name,
        type: "slider",
        class: 'custom-slider-class',
        min: 0,
        max: 10,
        step: 1,
        unit: 'review(s)'
      }));
    },
    reviewerSelectionFields() {
      return this.selectedReviewer.map(user => ({
        key: user.id,
        label: "Number of reviews for user: " + user.firstName + " " + user.lastName,
        type: "slider",
        class: 'custom-slider-class',
        min: 0,
        max: Number(this.remainingAssignments + Number(this.reviewerSelection[user.id])),
        step: 1,
        unit: 'review(s)'
      }));
    },
  },
  watch: {
    workflowMapping: {
      handler() {
        console.log("Workflow mapping changed:", this.workflowMapping);
      },
      deep: true
    },
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
    getWorkflowType(workflowId) {
        const workflow = this.$store.getters["table/workflow/get"](workflowId);
        return workflow ? workflow.name : "Unknown";
    },
    getStepTypeName(stepType) {
      switch (stepType) {
        case 1: return 'Annotator';
        case 2: return 'Editor';
        default: return 'Unknown';
      }
    }, 
    getTargetStepOptions(stepType) {
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
      return orderedSteps
        .filter(step => step.stepType === stepType)
        .map((step) => ({
          name: `<Workflow> Step ${stepPositionMap.get(step.id)} (${this.getStepTypeName(step.stepType)})`,
          value: step.id,
        }));
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
      const docs = this.$store.getters["table/document/getFiltered"](
          (d) => d.submissionId === submissionId && d.readyForReview && !d.deleted && d.documentType === 0
      );
      return docs && docs.length !== 0 ? docs[0].id : null;
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
      this.targetWorkflowId = null;
      this.workflowMapping = {};
    },
    createAssignments() {
      console.log("Creating bulk assignments...", this.workflowMapping);
      this.$refs.assignmentStepper.setWaiting(true);
      
      const socketData = {
        template: this.template,
        selectedReviewer: this.selectedReviewer,
        selectedAssignments: this.selectedAssignments,
        reviewerSelection: this.reviewerSelection,
        roleSelection: this.roleSelection,
        mode: this.reviewerSelectionMode.mode,
        roles: this.roles,
        assignmentType: this.assignmentType,
      };
      
      // Add workflowMapping for study_session, documents for others
      if (this.assignmentType === 'study_session') {
        socketData.targetWorkflowId = this.targetWorkflowId;
        socketData.workflowMapping = this.workflowMapping;
      } else {
        socketData.documents = this.workflowStepsAssignments;
      }
      
      this.$socket.emit("assignmentCreateBulk", socketData, (res) => {
        this.$refs.assignmentStepper.setWaiting(false);
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