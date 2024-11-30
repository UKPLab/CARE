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
      <div class="content-container">
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
import BasicTable from "@/basic/Table.vue";
import BasicForm from "@/basic/Form.vue";
import FormSlider from "@/basic/form/Slider.vue";
import {defineAsyncComponent} from "vue";

/**
 * Modal for bulk creating assignments
 * @author: Alexander Bürkle
 */
export default {
  name: "ImportModal",
  fetch_data: ["study"],
  components: { BasicModal, BasicButton, BasicIcon, BasicTable, BasicForm, FormSlider, "StudySessionModal": defineAsyncComponent(() => import("./StudySessionModal.vue")) },
  emits: ["updateUser"],
  mounted() {
    //this.$socket.emit("assignmentGetAssignmentInfosFromUser")
},
inject: {
    mainModal: {
      default: null
    },
  },
  computed: {
    users() {
      return this.$store.getters["admin/getAssignmentUserInfos"].filter(user => user.role != null);
    }, 
      columnsStepOne() { 
      const usersWithAssignments = this.users.filter((user) => user.numberAssignments > 0);
      const roles = usersWithAssignments.map((user) => user.role);
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
      this.mainModal?.hide()
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
              title: "Delete user session...",
              action: "deleteSession",
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
              title: "Delete user session...",
              action: "deleteSession",
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
      data.deletedReviewers = this.deleteUsers
      data.studyId = this.idStudy
      this.$socket.emit("assignmentEditReviewer", data)
      this.mainModal?.show()
      this.$refs.modal.close()
    },
    action(data) {
      switch(data.action) {
        case "deleteSession":
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



.table-scroll-container {
max-height: 500px; 
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
</style>
