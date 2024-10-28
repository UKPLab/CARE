<template>
    <BasicModal
      ref="modal"
      @hide="resetModal"
      xl
    >
      <template #title>
        <span>Bulk Create Assignments</span>
      </template>
      <template #body>
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
        <div class="content-container">
          <!-- Step0: Choose Assignments -->
          <div
            v-if="currentStep === 0"
            class="file-upload-container"
          >
          <h4>Select assignments to review!</h4>
          <div class="table-scroll-container">
            <BasicTable
              :columns="columnsStepZero"
              :data="assignments"
              :options="tableOptions"
              @row-selection="(assignments) => (selectedAssignments = assignments)"
            />
          </div>
          
          </div>
          <!-- Step1: Choose Reviewers -->
          <div
            v-if="currentStep === 1"
            class="preview-table-container"
          >
          <h4>Select reviewers!</h4>
          <div class="table-scroll-container">
            <BasicTable
              :columns="columnsStepOne"
              :data="reviewers"
              :options="tableOptions"
              @row-selection="(reviewers) => (selectedReviewers = reviewers)"
            />
          </div>
          
          </div>
          <!-- Step2: Choose number of reviewers per assignment -->
          <div
            v-if="currentStep === 2"
            class="review-count-container"
          >
          <BasicForm
            ref="form"
            :fields="sliders"
            v-model="sliderValues"
            
            />
          </div>
          <!-- Step3: Choose template to create assignment -->
          <div
            v-if="currentStep === 3"
            class="result-container"
          >

            <h3>Choose a template for the assignment creation!</h3>
            <div>
            <label for="template-dropdown">Choose a template:</label>
            <select v-model="selectedTemplate" id="template-dropdown">
              <option v-for="template in templateNames" :key="template" :value="template">{{ template }}</option>
            </select>
          </div>
              
            
          </div>
        </div>
      </template>
      <template #footer>
        <BasicButton
          title="Previous"
          class="btn btn-secondary"
          @click="prevStep"
        />
        <div v-if="currentStep != 3" >
        <BasicButton
          title="Next"
          class="btn btn-primary"
          :disabled="isDisabled"
          @click="nextStep"
        />
      </div>
      <div v-if="currentStep === 3" >
        <BasicButton
          title="Create Assignments"
          class="btn btn-primary"
          @click="createAssignments()"
        />
      </div>
      </template>
    </BasicModal>
  </template>
  
  <script>
  import BasicModal from "@/basic/Modal.vue";
  import BasicButton from "@/basic/Button.vue";
  import BasicIcon from "@/basic/Icon.vue";
  import BasicTable from "@/basic/table/Table.vue";
  import BasicForm from "@/basic/Form.vue";
  import FormSlider from "@/basic/form/Slider.vue";
  
  /**
   * Modal for bulk creating assignments
   * @author: Alexander Bürkle, Linyin Huang
   */
  export default {
    name: "ImportModal",
    fetch_data: ["study"],
    components: { BasicModal, BasicButton, BasicIcon, BasicTable, BasicForm, FormSlider},
    emits: ["updateUser"],
    mounted() {
      console.log("MOUNTED")
      this.$socket.emit("assignmentGetAssignmentInfosFromUser")
  },
    computed: {
      users() {
        return this.$store.getters["admin/getAssignmentUserInfos"].filter(user => user.role != null);
      },
      steps() {
        return [
          { title: "Assignment Selection" },
          { title: "Reviewer Selection" },
          { title: "Review Count" },
          { title: "Template Selection" },
        ];
      },
      isDisabled() {
        if (this.currentStep === 0) {
          return !this.selectedAssignments.length > 0;
        }
        if (this.currentStep === 1) {
          return !this.selectedReviewers.length > 0
        }
          
          
        return false;
      },
      columnsStepOne() { 
        const uniqueRoles = [...new Set(this.users.map((user) => user.role).filter((role) => role != null))];
        const roleFilterColumn = {
          name: "Role",
          key: "role",
          width: "1",
          filter: uniqueRoles.map((role) => ({ key: role, name: role })),
        };
        
        return [
        roleFilterColumn,
          {
            name: "Has Assignments",
            key: "hasAssignments",
            width: "1",
            filter: [
              { key: "true", name: "With Assignments" },
              { key: "false", name: "No Assignments" },
            ],
          },
          { name: "ID", key: "id" },
          { name: "First Name", key: "firstName" },
          { name: "Last Name", key: "lastName" },
          {
            name: "Number of Assignments",
            key: "numberAssignments",
          },
        ]
      },
      columnsStepZero() { 
        const usersWithAssignments = this.users.filter((user) => user.numberAssignments > 0);
        const roles = usersWithAssignments.map((user) => user.role);
        const uniqueRoles = [...new Set(roles)];
        const roleFilterColumn = {
          name: "Role",
          key: "role",
          width: "1",
          filter: uniqueRoles.map((role) => ({ key: role, name: role })),
        };
        
        return [
        roleFilterColumn,
          { name: "ID", key: "id" },
          { name: "Assignment", key: "documentName" },
          { name: "First Name", key: "firstName" },
          { name: "Last Name", key: "lastName" },
          
          
        ]},
      sliderMaxValue() {
        return parseInt(this.$store.getters["settings/getValue"]('assignment.role.slider.max'));
      },
      templates() {
        return this.$store.getters["table/study/getAll"].filter(item => item.template === true)
      }
      
    },
    data() {
      return {
        templateNames: [],
        sliders: [
        
      ],
        currentStep: 0,
        assignments: [],
        selectedAssignments: [],
        reviewers: [],
        selectedReviewers: [],
        selectedTemplate: '',
        sliderValues: {},
        tableOptions: {
          striped: true,
          hover: true,
          bordered: false,
          borderless: false,
          small: false,
          selectableRows: true,
          scrollY: true,
          scrollX: true
        },
      };
    },
    
    methods: {
      open(type) {
        this.importType = type;
        this.$refs.modal.open();
        this.handleStepZero()
        
      },
      resetModal() {
        this.currentStep = 0;
        this.selectedAssignments = [];
        this.selectedReviewers = [];
        this.assignments = [];
        this.reviewers = [];
        this.sliderValues = []
        this.users = [];
      },
      prevStep() {
        if (this.currentStep > 0) {
          this.currentStep--;
        }
        switch(this.currentStep) {
          case 0:
            this.selectedAssignments = []
            break;
          case 1:
            this.selectedReviewers = []
            this.sliders = []
            break;
          case 2:
            
            break;
        }
      },
      nextStep() {
        if (this.currentStep >= 4) return;
  
        this.currentStep++;
        switch (this.currentStep) {
          case 0:
            this.handleStepZero();
            break;
          case 1:
            this.handleStepOne()
            break;
          case 2:
            this.handleStepTwo();
            break;
          case 3:
            this.handleStepThree();
            break;
        }
        
      },
      handleStepZero() {
        const assignment = this.users.filter((user) => user.numberAssignments > 0);
        this.assignments = this.splitUsersByDocuments(assignment);
      },
      handleStepOne() {
        this.reviewers = this.createReviewers(this.users)
        this.reviewers.forEach(rev => {
              rev.hasAssignments = rev.numberAssignments > 0 ? "Has Assignments" : "No Assignment"
            });
        ;
        },
      handleStepTwo() {
        const roleCounts = this.selectedReviewers.reduce((acc, obj) => {
          const role = obj.role;
          acc[role] = (acc[role] || 0) + 1;
          return acc;
        }, {});

        for(const role in roleCounts) {
          this.sliders.push({ key: role, min: 0, max: roleCounts[role], step: 1, class: 'custom-slider-class', unit: '' ,
           label: "Number of " + role + "s per review", type:"slider", default: parseInt(this.$store.getters["settings/getValue"]('assignment.role.slider.default'), 3)})
        }
      },
      handleStepThree() {
        this.templateNames = this.templates.map(template => template.name)
      },
      splitUsersByDocuments(users) {
        const result = [];
        users.forEach(user => {
          if (user.documents.length > 1) {
            user.documents.forEach(doc => {
              const newUser = { ...user, documentName: doc.name }; 
              result.push(newUser);
            });
          } else {
            user.documentName = user.documents[0].name;
            result.push(user);
          }
        });
        return result;
            },
      createReviewers(users) {
        return users
      },
      createAssignments() {
        let data = {}
        data.assignments = this.selectedAssignments
        data.reviewers = this.selectedReviewers
        data.template = this.templates.find(template => template.name === this.selectedTemplate)
        let dictionary = {}
        Object.keys(this.sliderValues).forEach(key => {
      if (!Number.isInteger(+key) && key !== 'length') {
        dictionary[key] = this.sliderValues[key];
      }
    });
        data.reviewsPerRole = dictionary
        console.log(data)
        this.$socket.emit("assignPeerReviews", data, (response) => {
            console.log(response)
        }) 
      }
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


/* Set max-height and enable scrolling for the table */
.table-scroll-container {
  max-height: 500px; /* Set your desired height */
  overflow-y: auto;  /* Enable vertical scrolling */
}

.custom-slider-class {
  width: 100%;
  border: 2px solid #3498db; /* Add a visible blue border */
  border-radius: 8px; /* Add rounded corners */
  padding: 2px; /* Add padding to ensure the border is visible */
}
  
  
  
  /* Preview */
  .preview-table-container {
    height: 100%;
    white-space: nowrap;
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
  
  .link-container {
    margin-top: 15px;
    button:first-child {
      margin-right: 0.5rem;
    }
  }

  .result-container h3 {
  font-size: 2rem; /* Adjust this value to change the font size of the h3 */
  margin-bottom: 20px; /* Adds space below the h3 heading */
}

.result-container label {
  font-size: 1.2rem; /* Adjust this to change the label font size */
  margin-right: 10px; /* Adds space between the label and the dropdown */
}

.result-container select {
  margin-top: 10px; /* Adds space between the label and dropdown */
  padding: 5px; /* Optional: Adds padding to the dropdown for better spacing */
}
  </style>
  