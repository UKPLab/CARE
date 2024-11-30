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



    <template #step-0>
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

    <template #step-1>
      <div class="table-scroll-container">
        <BasicTable
          v-model="selectedAssignments"
          :columns="documentsTableColumns"
          :data="documentsTable"
          :options="documentTableOptions"
        />
      </div>
    </template>

    <template #step-2>
      <div class="table-scroll-container">
        <BasicTable
          v-model="selectedReviewer"
          :columns="reviewerTableColumns"
          :data="reviewerTable"
          :options="reviewerTableOptions"/>
      </div>
    </template>

  </StepperModal>

  <!--


          <div v-if="currentStep === 2">
            <h4>Select reviewers!</h4>
            <div class="table-scroll-container">
              <BasicTable 
              v-model="selectedReviewers"
              :columns="columnsStepOne" 
              :data="reviewers" 
              :options="tableOptions"
              @row-selection="(reviewers) => (selectedReviewers = reviewers)"/>
            </div>
          </div>
          
          
          <div v-if="currentStep === 3" class="table-scroll-container">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <BasicForm
              ref="templateSelectionForm"
              v-model="reviewerSelectionMode"
              :fields="reviewerSelectionFields"
            />

              <div v-if="reviewerSelectionMode.reviewerSelectionMode === 'hiwi'">
                <span style="margin-left: 10px;">Remaining Assignments: {{ this.remainingAssignments }}</span>
              </div>
            </div>
            <div class="table-scroll-container">
            <div v-if="reviewerSelectionMode.reviewerSelectionMode === 'general'">
              <BasicForm 
              ref="form" 
              v-model="sliderValues"
              :fields="roleSelectionSlider" />

            </div>
            <div v-if="reviewerSelectionMode.reviewerSelectionMode === 'hiwi'">
              <BasicForm ref="form" :fields="hiwiSelectionData" v-model="hiwiValues"/>
            </div>
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
        @click="prevStep"/>
      <BasicButton
        v-if="currentStep !== 3"
        title="Next"
        class="btn btn-primary"
        :disabled="isDisabled"
        @click="nextStep"/>
      <BasicButton
        v-if="currentStep === 3"
        title="Create Assignments"
        class="btn btn-primary"
        :disabled="isDisabledAssignments"
        @click="createAssignments()"
      />
    </template>
  </BasicModal>
  -->
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";
import BasicForm from "@/basic/Form.vue";
import StepperModal from "@/basic/modal/StepperModal.vue";

/**
 * Modal for bulk creating assignments
 * @author: Alexander Bürkle, Linyin Huang
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
  components: {StepperModal, BasicModal, BasicButton, BasicTable, BasicForm},
  emits: ["updateUser"],
  data() {
    return {
      selectedReviewer: [],


      templateSelection: {},
      reviewerSelectionMode: 'general',
      hiwiValues: [],
      perviousHiwiValues: [],
      currentStep: 0,
      assignments: [],
      selectedAssignments: [],
      sliderValues: {},
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
    stepValid() { //TODO: Implement validation
      return [
        this.workflowStepsAssignment.length !== 0,
        this.selectedAssignments.length > 0,
        this.selectedReviewer.length > 0,

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
    reviewerRoles() { // unique roles assigned to reviewers
      return [...new Set(this.reviewer.flatMap(obj => obj.roles))];
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
    reviewersOld() {
      let reviewers = this.$store.getters["admin/getAssignmentUserInfos"].filter(user => user.role != null);
      reviewers.forEach(rev => {
        rev.hasAssignments = rev.numberAssignments > 0 ? "Has Assignments" : "No Assignment"
      });
      return reviewers;
    },
    steps() {
      return [
        {title: "Template Selection"},
        {title: "Assignment Selection"},
        {title: "Review Count"},
        {title: "Template Selection"},
      ];
    },
    isDisabledAssignments() {
      if (this.reviewerSelectionMode.reviewerSelectionMode === 'general') {
        for (const key in this.sliderValues) {
          if (this.sliderValues[key] > 0) {
            return false;
          }
        }
        return true;
      } else {
        return this.remainingAssignments !== 0;
      }
    },

    columnsStepZero() {
      const usersWithAssignments = this.users.filter((user) => user.numberAssignments > 0);
      const roles = usersWithAssignments.map((user) => user.role);
      const uniqueRoles = [...new Set(roles)];
      const roleFilterColumn = {
        name: "Role",
        key: "role",
        width: "1",
        filter: uniqueRoles.map((role) => ({key: role, name: role})),
      };

      return [
        roleFilterColumn,
        {name: "ID", key: "id"},
        {name: "Assignment", key: "documentName"},
        {name: "First Name", key: "firstName"},
        {name: "Last Name", key: "lastName"},


      ]
    },
    remainingAssignments() {
      return this.selectedAssignments.length - Object.keys(this.hiwiValues).reduce((total, key) => {
        const value = Number(this.hiwiValues[key]);
        return total + (isNaN(value) ? 0 : value);
      }, 0);
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
    reviewerSelectionFields() {
      return [
        {
          key: "reviewerSelectionMode",
          label: "Reviewer Selection Mode",
          type: "select",
          options: [
            {name: "General", value: "general"},
            {name: "Hiwi", value: "hiwi"},
          ],
          required: true,
        },
      ]
    },
    hiwiSelectionData() {
      let data = [];
      for (const user of this.selectedReviewer) {
        data.push({
          key: user.id,
          label: user.firstName + " " + user.lastName,
          type: "slider",
          class: 'custom-slider-class',
          min: 0,
          max: this.selectedAssignments.length,
          step: 1,
          unit: ''
        })
      }
      return data;
    },
    roleSelectionSlider() {
      const roleCounts = this.selectedReviewer.reduce((acc, obj) => {
        const role = obj.role;
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {});

      let data = [];
      for (const role in roleCounts) {
        data.push({
          key: role,
          label: "Number of " + role + "s per review",
          type: "slider",
          class: 'custom-slider-class',
          min: 0,
          max: roleCounts[role],
          step: 1,
          unit: ''
        })
      }
      return data;
    }

  },
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

  },
  mounted() {
    //this.$socket.emit("assignmentGetAssignmentInfosFromUser")
  },
  methods: {
    open(type) {
      this.importType = type;
      this.$refs.assignmentStepper.open();
    },
    reset() {
      this.hiwiValues = []
      this.currentStep = 0;
      this.selectedAssignments = [];
      this.selectedReviewer = [];
      this.sliderValues = []
      this.users = [];
    },
    prevStep() {
      if (this.currentStep > 0) {
        this.currentStep--;
      }
    },
    nextStep() {
      if (this.currentStep >= 3) return;
      this.currentStep++;
    },
    createAssignments() {
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
  max-height: 500px;
  overflow-y: auto;
}

.custom-slider-class {
  width: 100%;
  border: 2px solid #3498db;
  border-radius: 8px;
  padding: 2px;
}


.review-count-container {
  height: 100%;
  white-space: nowrap;
  overflow-x: scroll;
  max-width: 50%;
}

.confirm-container,
.result-container {
  height: 100%;
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  flex-direction: column;
}

.result-container h3 {
  font-size: 2rem;
  margin-bottom: 20px;
}

.result-container label {
  font-size: 1.2rem;
  margin-right: 10px;
}

.result-container select {
  margin-top: 10px;
  padding: 5px;
}
</style>