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
          <!-- Step0: Upload -->
           
          <div
            v-if="currentStep === 0"
            class="file-upload-container"
          >
          <h4>Select Students</h4>
          <div class="table-scroll-container">
            <BasicTable
              :columns="columns"
              :data="users"
              :options="tableOptions"
              @row-selection="(users) => (selectedUsers = users)"
            />
          </div>
          
          </div>
          <!-- Step1: Preview -->
          <div
            v-if="currentStep === 1"
            class="preview-table-container"
          >
          <h4>Select Tutors</h4>
          <div class="table-scroll-container">
            <BasicTable
              :columns="columns"
              :data="mentors"
              :options="tableOptions"
              @row-selection="(mentors) => (selectedMentors = mentors)"
            />
          </div>
          
          </div>
          <!-- Step2:  -->
          <div
            v-if="currentStep === 2"
            class="review-count-container"
          >
          <div v-for="(slider, index) in sliders" :key="slider.key">
      <FormSlider
        v-model="sliderValues[index]" 
        :options="getSliderOptions(slider, index)"
      />

          </div>
          </div>
          <!-- Step3:  -->
          <div
            v-if="currentStep === 3"
            class="result-container"
          >
            <h3>Peer Reviews created!</h3>
              
            
          </div>
        </div>
      </template>
      <template #footer>
        <BasicButton
          title="Previous"
          class="btn btn-secondary"
          @click="prevStep"
        />
        <BasicButton
          title="Next"
          class="btn btn-primary"
          :disabled="isDisabled"
          @click="nextStep"
        />
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
   * Modal for bulk creating users through csv file and Moodle API
   * @author: Linyin Huang
   */
  export default {
    name: "ImportModal",
    components: { BasicModal, BasicButton, BasicIcon, BasicTable, BasicForm, FormSlider},
    emits: ["updateUser"],
    data() {
      return {
        sliders: [
        { key: 'slider1', min: 0, max: this.sliderMaxValue, step: 1, class: 'custom-slider-class', unit: '' , label: "Number of reviews per student"},
        { key: 'slider2', min: 0, max: this.sliderMaxValue, step: 1, class: 'custom-slider-class', unit: '', label: "Number of reviews per mentor" },
      ],
        sliderOptions: {
          key: "my-slider",
          min: 0,
          max: this.sliderMaxValue,
          step: 1,
          class: "custom-slider-class",
          unit: "px", 
        },
        currentStep: 0,
        file: {
          state: 0,
          name: "",
          size: 0,
          errors: [],
        },
        users: [],
        mentors: [],
        selectedMentors: [],
        userData: {},
        selectedUsers: [],
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
        columns: [
          {
            name: "Status",
            key: "status",
            width: "1",
            filter: [
              { key: "new", name: "New" },
              { key: "duplicate", name: "Duplicate" },
            ],
          },
          { name: "ID", key: "id" },
          { name: "First Name", key: "firstName" },
          { name: "Last Name", key: "lastName" },
          { name: "Email", key: "email" },
          { name: "Assignment", key: "documentName" },
        ],
        updatedUserCount: null,
        createdUsers: [],
      };
    },
    computed: {
      userCount() {
        return {
          new: this.selectedUsers.filter((u) => u.status === "new").length,
          duplicate: this.selectedUsers.filter((u) => u.status === "duplicate").length,
        };
      },
      steps() {
        return [
          { title: "Student Selection" },
          { title: "Tutor Selection" },
          { title: "Review Count" },
          { title: "Confirm" },
        ];
      },
      isDisabled() {
        if (this.currentStep === 0) {
          return !this.selectedUsers.length > 0;
        }
          
        return false;
      },
      finalFields() {
        return [
          ...this.baseFields,
          {
            key: "assignmentID",
            label: "Assignment ID:",
            type: "text",
            required: true,
            placeholder: "assignment-id-placeholder",
          },
        ];
      },
      sliderMaxValue() {
        return parseInt(this.$store.getters["settings/getValue"]('assignment_role_slider_max'));
      },
      sliderValues() {
        const values = []
        values.push(parseInt(this.$store.getters["settings/getValue"]('assignment_role_slider_student_default')))
        values.push(parseInt(this.$store.getters["settings/getValue"]('assignment_role_slider_tutor_default')))
        return values;
      }
      
    },
    methods: {
      getSliderOptions(slider) {
      return {
        ...slider,
        max: this.sliderMaxValue, 
      }},
      open(type) {
        this.importType = type;
        this.$refs.modal.open();
        this.handleStepZero();
        
      },
      resetModal() {
        this.currentStep = 0;
        this.file = {
          state: 0,
          name: "",
          size: 0,
          errors: [],
        };
        this.users = [];
        this.selectedUsers = [];
        if (this.updatedUserCount) {
          this.updatedUserCount = null;
          this.createdUsers = [];
          this.$emit("updateUser");
        }
        if (this.importType === "moodle") {
          this.eventBus.emit("resetFormField");
        }
      },
      prevStep() {
        if (this.currentStep > 0) {
          this.currentStep--;
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
        /*this.$socket.emit("userGetByRole", "student", (response) => {
          console.log(response.users)
          this.users = response.users
        console.log(this.users)})
        */
        this.$socket.emit("getStudentsWithAssignment", (response) => {
          this.users = response.users
      
      })
      },
      handleStepOne() {
        this.$socket.emit("userGetByRole", "mentor", (response) => {
          this.mentors = response.users })
      },
      handleStepTwo() {
        
      },
      handleStepThree() {
        console.log(this.sliderValues)
        let data = {}
        data.assignments = this.selectedUsers.map(col => col.documentName);
        data.students = this.selectedUsers.map(col => col.id);
        data.tutors = this.selectedMentors.map(col => col.id);
        data.reviewsPerStudent = this.sliderValues[0]
        data.reviewsPerTutor = this.sliderValues[1]
        data.assignmentCreators = this.selectedUsers.map(col => ({
          documentName: col.documentName,
          id: col.id
        }));
        this.$socket.emit("assignPeerReviews", data, (response) => {
            console.log(response)
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
  
  /* Upload */
  .file-upload-container {
    width: 100%;
    margin: 0 auto;
    overflow-x: scroll;
    overflow-y: auto;
  }
  
  .drag-drop-area {
    margin-bottom: 0.5rem;
    border: 2px dashed #ccc;
    border-radius: 4px;
    padding: 1.25rem;
    text-align: center;
    cursor: pointer;
    transition: background-color 0.3s ease;
  }
  
  .drag-drop-area:hover {
    background-color: #f0f0f0;
  }
  
  .drag-drop-area p {
    margin: 0;
    font-size: 0.925rem;
    color: #666;
  }
  
  .template-link {
    cursor: pointer;
  }
  
  .file-info-container {
    margin-top: 0.9375rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 1px solid #dee2e6;
    background: #f2f2f2;
    border-radius: 4px;
  }
  
  .file-info {
    margin-left: 0.5rem;
    font-size: 0.925rem;
  }
  
  .file-info-container strong {
    margin: 0 0.5rem;
    color: #333;
  }
  
  .file-info-container button {
    background-color: transparent;
    color: firebrick;
    border: none;
    padding: 5px 10px;
    cursor: pointer;
  }
  
  .file-error-container {
    color: firebrick;
    > p {
      margin-bottom: 0.5rem;
    }
  }
  
  /* Preview */
  .preview-table-container {
    height: 100%;
    white-space: nowrap;
    overflow-x: scroll;
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
    justify-content: center;
    align-items: center;
    flex-direction: column;
  }
  
  .link-container {
    margin-top: 15px;
    button:first-child {
      margin-right: 0.5rem;
    }
  }
  </style>
  