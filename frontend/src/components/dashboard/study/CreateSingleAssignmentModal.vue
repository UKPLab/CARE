<template>
  <BasicModal
    ref="modal"
    @hide="resetModal"
    xl
  >
    <template #title>
      <span>Create Assignment</span>
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
        
        <div class="table-scroll-container">
          <h4>Choose a template!</h4>
            <div class="template-container">
            <label for="template-dropdown">Choose a template:</label>
            <div class="template-dropdown">
            <select v-model="selectedTemplate" id="template-dropdown">
              <option v-for="template in templateNames" :key="template" :value="template">{{ template }}</option>
            </select>
            </div>
          </div>
          <h4>Select assignment to review!</h4>
          <BasicTable
            :columns="columnsStepZero"
            :data="assignments"
            :options="tableOptionsZero"
            @row-selection="(assignments) => (selectedAssignment = assignments)"
          />
        </div>
        
        </div>
      
        <!-- Step1: Choose Reviewers -->
        <div
          v-if="currentStep === 1"
          class="file-upload-container"
        >
        <h4>Select reviewers!</h4>
        <input
      type="text"
      v-model="searchTerm"
      placeholder="Search reviewers"
      class="search-input"
    />
      <div class="table-scroll-container">
            <BasicTable
              :columns="columnsStepOne"
              :data="filteredReviewers"
              :options="tableOptionsOne"
              @row-selection="(filteredReviewers) => (selectedUsers = filteredReviewers)"
            />
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
      <div v-if="currentStep != 1" >
      <BasicButton
        title="Next"
        class="btn btn-primary"
        :disabled="isDisabled"
        @click="nextStep"
      />
    </div>
    <div v-if="currentStep === 1" >
      <BasicButton
        title="Create Assignment"
        class="btn btn-primary"
        @click="createAssignment()"
        :disabled="isDisabledAssignment"
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
    this.$socket.emit("assignmentGetAssignmentInfosFromUser")
    this.filteredUsers = this.users
},
  computed: {
    templates() {
        return this.$store.getters["table/study/getAll"].filter(item => item.template === true)
      },
    users() {
      return this.$store.getters["admin/getAssignmentUserInfos"].filter(user => user.role != null);
    },
    steps() {
      return [
        { title: "Assignment Selection" },
        { title: "Reviewer Selection" }
      ];
    },
    isDisabled() {
      if (this.currentStep === 0) {
        return this.selectedAssignment === null || this.selectedTemplate === "";
      }
      if (this.currentStep === 1) {
        return !this.selectedReviewers.length > 0
      }
        
        
      return false;
    },
    isDisabledAssignment() {
      return this.selectedUsers.length === 0
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
      }
      return [
      roleFilterColumn,
        { name: "ID", key: "id" },
        { name: "Assignment", key: "documentName" },
        { name: "First Name", key: "firstName" },
        { name: "Last Name", key: "lastName" },
        
        
      ]},
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
      filteredReviewers() {
        return this.reviewers.filter((reviewer) => {
          return this.searchTerm === "" || reviewer.firstName.toLowerCase().includes(this.searchTerm.toLowerCase()) || reviewer.lastName.toLowerCase().includes(this.searchTerm.toLowerCase()) || reviewer.userName.toLowerCase().includes(this.searchTerm.toLowerCase());
        });
      }
  },
  data() {
    return {
      searchTerm: "",
      templateNames: [],
      selectedTemplate: "",
      showInputFields: false,
      selectedUsers: [],
      firstNameInput: "",
      lastNameInput: "",
      userNameInput: "",
      currentStep: 0,
      assignments: [],
      selectedAssignment: null,
      reviewers: [],
      selectedReviewers: [],
      tableOptionsZero: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        scrollY: true,
        scrollX: true,
        onlyOneRowSelectable: true,
      },
      tableOptionsOne: {
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
      this.selectedAssignment = null;
      this.selectedReviewers = [];
      this.assignments = [];
      this.reviewers = [];
      this.sliderValues = []
      this.users = [];
      this.selectedUsers = [];
      this.filteredUsers = [];
      this.firstNameInput = "";
      this.lastNameInput = "";
      this.userNameInput = "";
    },
    prevStep() {
      if (this.currentStep > 0) {
        this.currentStep--;
      }
      switch(this.currentStep) {
        case 0:
          this.selectedAssignment = {}
          break;
        case 1:
          this.selectedReviewers = []
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
      }
      
    },
    handleStepZero() {
      this.templateNames = this.templates.map(template => template.name)
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
      filterUsers() {
        const firstNameFilter = this.firstNameInput.toLowerCase();
        const lastNameFilter = this.lastNameInput.toLowerCase();
        const userNameFilter = this.userNameInput.toLowerCase();

        this.filteredUsers = this.users.filter(user => {
          const isAlreadySelected = this.selectedUsers.some(selectedUser => selectedUser.id === user.id);

          return (
            !isAlreadySelected && // Exclude users already in selectedUsers
            (!firstNameFilter || user.firstName.toLowerCase().includes(firstNameFilter)) &&
            (!lastNameFilter || user.lastName.toLowerCase().includes(lastNameFilter)) &&
            (!userNameFilter || user.userName.toLowerCase().includes(userNameFilter))
          );
        });
},
    selectUser(user) {
      user.manage = [
      {
              icon: "trash",
              options: {
                iconOnly: true,
                specifiers: {
                  "btn-outline-secondary": true,
                },
              },
              title: "Delete document...",
              action: "deleteDoc",
            },
      ]
      this.selectedUsers.push(user);
      this.clearInputs();
      this.showInputFields = false;
    },
    removeUser(index) {
      this.selectedUsers.splice(index, 1);
    },
    clearInputs() {
      this.firstNameInput = '';
      this.lastNameInput = '';
      this.userNameInput = '';
      this.filteredUsers = [];
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
    createAssignment() {
      let data = {}
      data.assignment = this.selectedAssignment[0]
      data.reviewers = this.selectedUsers.map(user => user.id)
      data.template = this.templates.find(template => template.name === this.selectedTemplate)
      data.createdByUserId = this.$store.getters["auth/getUserId"]
      this.$socket.emit("assignmentPeerReview", data, (response) => {
      }) 
      this.$refs.modal.close();
    },
    action(data) {
      switch(data.action) {
        case "deleteDoc":
          this.selectedUsers.splice(data.params, 1);
          this.selectedUsers.
          break;
      }
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
.selected-user {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
button {
  margin-left: 10px;
}

.tabel-flex {
  display: flex;
}

.template-container {
  margin-bottom: 20px;
  margin-top: 20px;
  display: flex;
}

.template-dropdown {
  margin-left: 10px;
}

</style>
