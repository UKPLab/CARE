<template>
  <BasicModal
    ref="modal"
    @hide="resetModal"
    xl
  >
    <template #title>
      <span>Assignment overview</span>
    </template>
    <template #body>
      <!-- Content -->
      <div class="content-container">
      
        <!-- Step1: Choose Reviewers -->
        <div
          class="table-scroll-container"
        >
        <h4>Select reviewers!</h4>
        <div class="form-group">
        <label for="firstName">First Name:</label>
        <input
          type="text"
          id="firstName"
          v-model="firstNameInput"
          @input="filterUsers"
          placeholder="Filter by First Name"
          class="form-control"
        />
        <label for="lastName">Last Name:</label>
        <input
          type="text"
          id="lastName"
          v-model="lastNameInput"
          @input="filterUsers"
          placeholder="Filter by Last Name"
          class="form-control"
        />
        <label for="userName">Username:</label>
        <input
          type="text"
          id="userName"
          v-model="userNameInput"
          @input="filterUsers"
          placeholder="Filter by Username"
          class="form-control"
        />

        <!-- Display Filtered Users -->
        <ul v-if="filteredUsers.length > 0" class="list-group mt-2">
          <li
            v-for="user in filteredUsers"
            :key="user.id"
            @click="selectUser(user)"
            class="list-group-item list-group-item-action"
          >
            {{ user.firstName }} {{ user.lastName }} ({{ user.userName }})
          </li>
        </ul>
      </div>

      <!-- Display Selected Users -->
      <div v-if="selectedUsers.length > 0" class="selected-users mt-3">
        <h5>Selected Reviewers:</h5>
      <div class="tabel-flex">
        <BasicTable
            :columns="columnsStepOne"
            :data="selectedUsers"
            :options="tableOptionsOne"
            @action="action"
          />
        </div>
      </div>
      </div>
    </div>
    </template>
    <template #footer>
      <div>
      <BasicButton
        title="Save"
        class="btn btn-primary"
        @click="save"
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
 * @author: Alexander Bürkle
 */
export default {
  name: "ImportModal",
  fetch_data: ["study"],
  components: { BasicModal, BasicButton, BasicIcon, BasicTable, BasicForm, FormSlider},
  emits: ["updateUser"],
  mounted() {
    this.$socket.emit("assignmentGetAssignmentInfosFromUser")
},
  computed: {
    users() {
      return this.$store.getters["admin/getAssignmentUserInfos"].filter(user => user.role != null);
    }, 
      columnsStepOne() { 
      const usersWithAssignments = this.users.filter((user) => user.numberAssignments > 0);
      const roles = usersWithAssignments.map((user) => user.role);
      const uniqueRoles = [...new Set(roles)];
      const roleFilterColumn = {
        name: "Role",
        key: "role",
        width: "1",
      }
      return [
      roleFilterColumn,
        { name: "ID", key: "id" },
        { name: "First Name", key: "firstName" },
        { name: "Last Name", key: "lastName" },
        {
          name: 'Manage',
          key: 'manage',
          type: "button-group",
        }
        
      ]},
  },
  data() {
    return {
      showInputFields: false,
      newUsers: [],
      deleteUsers: [],
      selectedUsers: [],
      filteredUsers: [],
      idStudy: null,
      firstNameInput: "",
      lastNameInput: "",
      userNameInput: "",
      tableOptionsZero: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        scrollY: true,
        scrollX: true
      },
      tableOptionsOne: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: false,
        scrollY: true,
        scrollX: true
      },
    };
  },
  
  methods: {
    open(id) {
      this.$refs.modal.open();
      this.handleStepZero(id)
      this.idStudy = id
    },
    resetModal() {
      this.selectedUsers = [];
      this.newUsers = [];
      this.deleteUsers = [];
      this.firstNameInput = "";
      this.lastNameInput = "";
      this.userNameInput = "";
      this.users = [];
      this.filteredUsers = [];
    },
    handleStepZero(id) {
      const userIds = this.$store.getters["table/study_session/getFiltered"](e => e.studyId === id).map(session => session.userId);
      const users = this.users.filter(user => userIds.includes(user.id)).map(users => ({
      ...users, 
      manage: [
      {
              icon: "trash",
              options: {
                iconOnly: true,
                specifiers: {
                  "btn-danger": true,
                },
              },
              title: "Delete document...",
              action: "deleteDoc",
            },
      ]
    }));;
      this.selectedUsers = users;
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
                  "btn-danger": true,
                },
              },
              title: "Delete document...",
              action: "deleteDoc",
            },
      ]
      this.selectedUsers.push(user);
      this.newUsers.push(user);
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
    save() {
      let data = {}
      data.newReviewers = this.newUsers
      data.deleteReviewers = this.deleteUsers
      data.studyId = this.idStudy
      this.$socket.emit("assignmentAddReviewer", data)
    },
    action(data) {
      switch(data.action) {
        case "deleteDoc":
          console.log(data.params)
          this.selectedUsers.splice(data.params, 1);
          const element = this.newUsers.splice(data.params, 1);
          if(!element.length > 0) {
            this.deleteUsers.push(data.params)
          }
          
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
  max-height: 500px; /* Set your desired height */
overflow-y: auto;
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

button.btn-danger {
  height: 100%; /* Make the button fill the height of the table row */
  line-height: 2; /* Adjust this value as needed for vertical text alignment */
  padding: 0; /* Remove extra padding for better fit */
  display: flex;
  align-items: center; /* Center the text vertically */
  justify-content: center; /* Center the text horizontally */
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
