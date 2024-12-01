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
    </template>
    <template #step-2>
      <div class="table-scroll-container">
        <BasicTable
          v-model="selectedAssignment"
          :columns="documentsTableColumns"
          :data="documentsTable"
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
        <strong>Workflow Assignments:</strong>
        <ul>
          <li
            v-for="(stepAssignment, index) in workflowStepsAssignments"
            :key="stepAssignment.id"
          >
            - Workflow Step {{ index + 1 }}:
            <span v-if="stepAssignment.documentId">
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
            v-for="reviewer in selectedReviewer">
            - {{ reviewer.firstName }} {{ reviewer.lastName }}
          </li>
        </ul>
      </div>
    </template>
  </StepperModal>
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import BasicForm from "@/basic/Form.vue";
import StepperModal from "@/basic/modal/StepperModal.vue";

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
      include: [{
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
    }],
  components: {StepperModal, BasicTable, BasicForm},
  data() {
    return {
      templateSelection: {},
      selectedAssignment: [],
      selectedReviewer: [],
      documentTableOptions: {
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
        search: true,
      },
    };
  },
  computed: {
    stepValid() {
      return [
        this.workflowStepsAssignment.length !== 0,
        this.selectedAssignment.length === 1,
        this.selectedReviewer.length > 0,
      ];
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
      return this.workflowSteps.map((c, index) => {
        return {
          documentId: (index === 0) ? this.selectedAssignment[0].id : null,
          id: c.id
        }
      });
    },
    documents() {
      return this.$store.getters["table/document/getFiltered"]((d) => d.readyForReview);
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
    reviewers() {
      return this.$store.getters["table/user/getAll"];
    },
    reviewerTable() {
      return this.reviewers.map((r) => {
        let newR = {...r};
        newR.documents = this.documents.filter((d) => d.userId === r.id).length;
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
      ]
    },
    steps() {
      return [
        {title: "Template Selection"},
        {title: "Assignment Selection"},
        {title: "Reviewer Selection"},
        {title: "Confirmation"},
      ];
    },
  },
  methods: {
    open() {
      this.reset();
      this.$refs.assignmentStepper.open();
    },
    reset() {
      this.selectedAssignment = [];
      this.selectedReviewer = [];
    },
    createAssignment() {
      this.$refs.assignmentStepper.setWaiting(true);
      this.$socket.emit("assignmentCreate", {
        template: this.template,
        reviewer: this.selectedReviewer,
        assignments: this.selectedAssignment,
        documents: this.workflowStepsAssignments
      }, (res) => {
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
