<template>
  <StepperModal
    ref="assignmentStepper"
    :steps="steps"
    :validation="stepValid"
    @submit="createAssignments"
    xl>
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
    </template>

    <template #step-2>
      <div class="table-scroll-container">
        <BasicTable
          v-model="selectedAssignments"
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
          :options="reviewerTableOptions"/>
      </div>
    </template>

    <template #step-4>
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
    </template>

    <template #step-5>
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
        <strong>Documents:</strong> {{ selectedAssignments.length }}
      </div>
      <div>
        <strong>Reviewers:</strong> {{ selectedReviewer.length }}
      </div>
      <div>
        <strong>Number of reviews that will be created:</strong>
        {{ reviewerNumberOfAssignments }} <!-- TODO calculate for each mode -->
      </div>
      <div>
        <strong>Selection Mode:</strong>
        <!--{{ reviewerSelectionModeFields[0].options.find(field => field.value === reviewerSelectionMode.mode).name }}-->
      </div>
      <div v-if="reviewerSelectionMode.mode === 'role'">
        <strong>Roles:</strong>
        <ul>
          <li v-for="(value, key) in listOfSelectedRoles" :key="key">
            {{ value.role }}: {{ value.value }}
          </li>
        </ul>
      </div>
      <div v-else>
        <strong>Reviewers:</strong>
        <ul>
          <li v-for="(value, key) in listOfSelectedReviewers" :key="key">
            {{ value.reviewer }}: {{ value.value }}
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
  }
  ],
  components: {StepperModal, BasicTable, BasicForm},
  emits: ["updateUser"],
  data() {
    return {
      selectedReviewer: [],
      reviewerSelectionMode: {},
      roleSelection: {},
      templateSelection: {},
      selectedAssignments: [],
      reviewerSelection: {},
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
    stepValid() {
      return [
        this.workflowStepsAssignment.length !== 0,
        this.selectedAssignments.length > 0,
        this.selectedReviewer.length > 0,
        this.reviewerSelectionMode.mode !== undefined &&
        (this.reviewerSelectionMode.mode === 'reviewer' ?
          this.remainingAssignments === 0 :
          Object.values(this.roleSelection).map((value) => parseInt(value, 0)).reduce((a, b) => a + b, 0) > 0)
      ];
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
    reviewerTable() {
      return this.reviewer.map((r) => {
        let newR = {...r};
        newR.documents = this.documents.filter((d) => d.userId === r.id).length;
        newR.rolesNames = r.roles.map((role) => this.roles.find((r) => r.id === role).name);
        newR.rolesNames = newR.rolesNames.join(", ");
        return newR;
      })
    },
    roles() {
      return this.$store.getters["admin/getSystemRoles"];
    },
    reviewerRoles() { // unique roles of all possible reviewers
      return [...new Set(this.reviewer.flatMap(obj => obj.roles))];
    },
    selectedReviewerRoles() { // unique roles assigned to reviewers
      return this.selectedReviewer.flatMap(obj => obj.roles);
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
          // filter for roles is not working, maybe it is because of an array
          // TODO need special kind of filter for array includes
          /*filter: this.reviewerRoles.length > 0 ? this.reviewerRoles.map((role) => ({
            key: "roles",
            name: role,
          })) : undefined*/
        },
      ]
    },
    reviewer() {
      return this.$store.getters["table/user/getAll"];
    },
    steps() {
      return [
        {title: "Template Selection"},
        {title: "Document Selection"},
        {title: "Reviewer Selection"},
        {title: "Distribution"},
        {title: "Confirmation"}
      ];
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
    reviewerSelectionModeFields() {
      return [
        {
          key: "mode",
          label: "Reviewer Selection Mode",
          type: "select",
          options: [
            {name: "Role-based selection (the number of reviews each role should do)", value: "role"},
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
        max: this.selectedAssignments.length, //TODO auto adapt max
        step: 1,
        unit: 'review(s)'
      }));
    },
    reviewerSelectionFields() {
      let data = [];
      for (const user of this.selectedReviewer) {
        data.push({
          key: user.id,
          label: "Number of reviews for user: " + user.firstName + " " + user.lastName,
          type: "slider",
          class: 'custom-slider-class',
          min: 0,
          max: this.selectedAssignments.length, // TODO auto adapt max
          step: 1,
          unit: 'review(s)'
        })
      }
      return data;
    },
  },
  /* //TODO delete if adapted auto adapt max values
  watch: {
    hiwiValues: {
      handler(newValue) {
        const oldValues = this.perviousHiwiValues;

        for (const key in newValue) {
          if (oldValues[key] > newValue[key]) {
            const difference = Math.abs(oldValues[key] - newValue[key]);
            for (let i = 0; i < this.hiwiSelectionData.length; i++) {
              if (this.hiwiSelectionData[i].key != key) {
                this.hiwiSelectionData[i].max = this.hiwiSelectionData[i].max + difference
                if (this.hiwiSelectionData[i].max < 0) {
                  this.hiwiSelectionData[i].max = 0
                }
              }
            }
            break;
          }
          if (oldValues[key] < newValue[key]) {
            const difference = Math.abs(oldValues[key] - newValue[key]);
            for (let i = 0; i < this.hiwiSelectionData.length; i++) {
              if (this.hiwiSelectionData[i].key != key) {
                this.hiwiSelectionData[i].max = this.hiwiSelectionData[i].max - difference
                if (this.hiwiSelectionData[i].max < 0) {
                  this.hiwiSelectionData[i].max = 0
                }
              }
            }
            break;
          }
        }
        this.perviousHiwiValues = {...newValue}
      },
      deep: true
    },



  }, */
  mounted() { // TODO make sure all data is loaded
    //this.$socket.emit("assignmentGetAssignmentInfosFromUser")
  },
  methods: {
    open() {
      this.reset();
      this.$refs.assignmentStepper.open();
    },
    reset() {
      this.selectedReviewer = [];
      this.reviewerSelectionMode = {};
      this.roleSelection = {};
      this.templateSelection = {};
      this.selectedAssignments = [];
      this.reviewerSelection = {};
    },
    createAssignments() { // TODO send assignment creation to backend
      let data = {}
      data.createdByUserId = this.$store.getters["auth/getUserId"]
      data.assignments = this.selectedAssignments
      data.template = this.template
      let dictionary = {}
      Object.keys(this.sliderValues).forEach(key => {
        if (!Number.isInteger(+key) && key !== 'length') {
          dictionary[key] = this.sliderValues[key];
        }
      });
      data.reviewsPerRole = dictionary
      if (this.selectedOption === 'hiwi') {
        const convertedHiwiValues = Object.fromEntries(
          Object.entries(this.hiwiValues).filter(([key, value]) => value !== undefined)
        );
        data.reviewers = convertedHiwiValues
        this.$socket.emit("assignmentAssignHiwis", data, (response) => {
        })
      } else {
        data.reviewers = this.selectedReviewers
        console.log(data, "DATA")
        this.$socket.emit("assignmentAssignPeerReviews", data, (response) => {
        })
      }

      this.$refs.modal.close();
    }
  },

}
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