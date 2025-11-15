<template>
  <StepperModal
      ref="assignmentStepper"
      :steps="steps"
      :validation="stepValid"
      @submit="createAssignment"
      xl>
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
    </template>
    <template #step-2>
      <div class="table-scroll-container">
        <BasicTable
            v-model="selectedAssignment"
            :columns="currentTableColumns"
            :data="currentTableData"
            :options="documentTableOptions"
        />
      </div>
    </template>
    <template #step-3>
      <div class="table-scroll-container">
        <BasicTable
            v-model="selectedReviewer"
            :columns="reviewerTableColumns"
            :data="reviewerTable"
            :options="reviewerTableOptions"
        />
      </div>
    </template>
    <template #step-4>
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
      inject: [{
        table: "study_session",
        by: "userId",
        type: "count",
        as: "studySessions"
      }]
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
    };
  },
  computed: {
    assignmentType() {
      return this.assignmentTypeSelection.type || 'document';
    },
    stepValid() {
      const step1Valid = this.workflowStepsAssignment.length !== 0 && !!this.assignmentType;
      const step2Valid = this.selectedAssignment.length === 1;
      const step3Valid = this.selectedReviewer.length > 0;
      return [step1Valid, step2Valid, step3Valid, true];
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
          {value: 'submission', name: 'Submissions'}
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
              id: c.id
            };
          }
          return {
            documentId: null,
            id: c.id
          };
        });
      } else {
        return this.workflowSteps.map((c, index) => {
          return {
            documentId: (index === 0) ? this.selectedAssignment[0].id : null,
            id: c.id
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
      return this.assignmentType === 'submission' ? this.submissionsTable : this.documentsTable;
    },
    currentTableColumns() {
      return this.assignmentType === 'submission' ? this.submissionColumns : this.documentsTableColumns;
    },
    documentsTable() {
      return this.documents.map((d) => {
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
    reviewers() {
      return this.$store.getters["table/user/getAll"];
    },
    roles() {
      return this.$store.getters["admin/getSystemRoles"] || [];
    },
    reviewerTable() {
      return this.reviewers.map((r) => {
        let newR = {...r};
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
      return [
        {title: "Template Selection"},
        {title: "Assignment Selection"},
        {title: "Reviewer Selection"},
        {title: "Confirmation"}
      ];
    },
  },
  watch: {
    assignmentType(newType, oldType) {
      if (oldType && newType !== oldType) {
        this.selectedAssignment = [];
        this.baseFileSelections = {};
        this.inputGroupValid = false;
        this.validationConfigurationNames = {};
      }
    }
  },
  methods: {
    getPrimaryDocumentId(submissionId) {
      const docs = this.$store.getters["table/document/getFiltered"](
          (d) => d.submissionId === submissionId && d.readyForReview && !d.deleted
      );
      return docs && docs.length !== 0 ? docs[0].id : null;
    },
    open() {
      this.reset();
      this.$refs.assignmentStepper.open();
    },
    reset() {
      this.selectedAssignment = [];
      this.selectedReviewer = [];
      this.assignmentTypeSelection = {};
      this.baseFileSelections = {};
      this.inputGroupValid = false;
      this.validationConfigurationNames = {};
    },
    createAssignment() {
      this.$refs.assignmentStepper.setWaiting(true);

      const assignmentData = {
        template: this.template,
        assignmentType: this.assignmentType,
        reviewer: this.selectedReviewer,
        assignment: this.selectedAssignment[0],
        documents: this.workflowStepsAssignments,
      };

      this.$socket.emit("assignmentCreate", assignmentData, (res) => {
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
      })
    },
  },

};
</script>

<style scoped>
.table-scroll-container {
  max-height: 400px;
  overflow-y: auto;
}

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
