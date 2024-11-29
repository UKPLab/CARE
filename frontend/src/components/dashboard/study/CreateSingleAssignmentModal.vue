<template>
  <BasicModal
    ref="modal"
    xl
    @hide="reset"
  >
    <template #title>
      <span>Create Assignment</span>
    </template>
    <template #body>
      <div class="content-container">
        <div v-if="templates.length === 0">
          <p class="text-center text-danger">There are not study templates available!</p>
          <p class="text-center">Please create a study template to proceed!</p>
        </div>
        <div v-else>

          <!-- Stepper -->
          <div class="stepper">
            <div
              v-for="(step, index) in steps"
              :key="index"
              :data-index="index + 1"
              :class="{ active: currentStep === index }"
            >
              {{ step.title }}
            </div>
          </div>
          <!-- Content -->
          <div v-if="currentStep === 0">
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
          </div>
          <!-- Step 1: Choose Assignment -->
          <div
            v-if="currentStep === 1"
            class="file-upload-container"
          >
            <div class="table-scroll-container">
              <BasicTable
                v-model="selectedAssignment"
                :columns="documentsTableColumns"
                :data="documentsTable"
                :options="documentTableOptions"
              />
            </div>
          </div>
          <!-- Step 2: Choose Reviewers -->
          <div
            v-if="currentStep === 2"
            class="file-upload-container"
          >
            <div class="table-scroll-container">
              <BasicTable
                v-model="selectedReviewer"
                :columns="reviewerTableColumns"
                :data="reviewerTable"
                :options="reviewerTableOptions"
              />
            </div>
          </div>
          <!-- Step 3: Confirmation -->
          <div v-if="currentStep === 3">
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
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <BasicButton
        v-if="templates.length === 0"
        title="Close"
        class="btn btn-secondary"
        @click="$refs.modal.close()"
      />
      <BasicButton
        v-if="currentStep !== 0"
        title="Previous"
        class="btn btn-secondary"
        @click="prevStep"
      />
      <BasicButton
        v-if="currentStep !== 3"
        title="Next"
        class="btn btn-primary"
        :disabled="isDisabled"
        @click="nextStep"
      />
      <BasicButton
        v-if="currentStep === 3"
        title="Create Assignment"
        class="btn btn-primary"
        @click="createAssignment"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";
import BasicForm from "@/basic/Form.vue";

/**
 * Modal for bulk creating assignments
 * @author: Dennis Zyska, Alexander Bürkle, Linyin Huang
 */
export default {
  name: "ImportModal",
  fetchData: [{
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
  components: {BasicModal, BasicButton, BasicTable, BasicForm},
  data() {
    return {
      currentStep: 0,
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
        onlyOneRowSelectable: true,
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
        search: true,
      },
    };
  },
  computed: {
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
        const user = this.$store.getters["admin/user/get"](d.userId)
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
      return this.$store.getters["admin/user/getAll"];
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
    isDisabled() {
      if (this.currentStep === 0) {
        return this.workflowStepsAssignment.length === 0;
      }
      if (this.currentStep === 1) {
        return this.selectedAssignment.length !== 1;
      }
      if (this.currentStep === 2) {
        return this.selectedReviewer.length === 0;
      }
      return false;
    },
  },
  methods: {
    open() {
      this.$refs.modal.open();
    },
    reset() {
      this.currentStep = 0;
      this.selectedAssignment = [];
      this.selectedReviewer = [];
    },
    prevStep() {
      if (this.currentStep > 0) {
        this.currentStep--;
      }
    },
    nextStep() {
      if (this.currentStep >= 4) return;
      this.currentStep++;
    },

    createAssignment() {
      this.$refs.modal.waiting = true;
      this.$socket.emit("assignmentCreate", {
        template: this.template,
        reviewer: this.selectedReviewer,
        assignments: this.selectedAssignment,
        documents: this.workflowStepsAssignments
      }, (res) => {
        this.$refs.modal.waiting = false;
        if (res.success) {
          this.$refs.modal.close();
          this.eventBus.emit("toast", {
            title: "Assignment created",
            message: "The assignment has been created successfully",
            type: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to create assignment",
            message: res.message,
            type: "error",
          });
        }
      })
    },
  },

};
</script>

<style scoped>
/* Stepper */
.stepper {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  position: relative;

  &:after {
    content: "";
    position: absolute;
    top: 15px;
    left: 0;
    right: 0;
    height: 2px;
    background-color: #ccc;
  }
}

.stepper div {
  z-index: 1;
  background-color: white;
  padding: 0 5px;

  &:before {
    --dimension: 30px;
    content: attr(data-index);
    margin-right: 6px;
    display: inline-flex;
    width: var(--dimension);
    height: var(--dimension);
    border-radius: 50%;
    align-items: center;
    justify-content: center;
    border: 1px solid #6c6b6b;
  }

  &:first-child {
    padding-left: 0;
  }

  &:last-child {
    padding-right: 0;
  }
}

.stepper div.active {
  --btn-color: #0d6efd;
  border-color: var(--btn-color);

  &:before {
    color: white;
    background-color: var(--btn-color);
    border-color: var(--btn-color);
  }
}

.content-container {
  height: 500px;
  margin-bottom: 20px;
}

.table-scroll-container {
  height: 400px;
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
