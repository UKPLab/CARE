<template>
  <BasicModal
    ref="editPeerReviewsModal"
    @hide="resetForm"
  >
    <template #title>
      <slot name="title">
        <span>Edit Review</span>
      </slot>
    </template>
    <template #body>
      
      <div class="form-group">
        <label for="docName">Document Name:</label>
        <input
          type="text"
          id="docName"
          v-model="userInfo.docName"
          placeholder="Enter document name"
          class="form-control"
          required
        />
      </div>

      <!-- Status Toggle Switch -->
      <div class="form-group toggle-container">
        <label>Status:</label>
        <div
          class="toggle-switch"
          :class="{ 'active': userInfo.status }"
          @click="toggleStatus"
        >
          <div class="switch" :class="{ 'on': userInfo.status }"></div>
        </div>
        <span class="status-label">{{ userInfo.status ? 'Finished' : 'In Progress' }}</span>
      </div>

      <div>
        <h5>Moderators:</h5>
        <div v-for="(role, index) in userInfo.roles" :key="index" class="role-container">
          <input
            type="text"
            v-model="userInfo.roles[index]"
            placeholder="Enter role"
            class="form-control"
          />
          <button class="btn btn-danger" @click="removeRole(index)">Remove</button>
        </div>
        <div class="button-group">
      <button class="btn btn-primary" @click="addRole()">Add</button>
    </div>
      </div>

      <div>
        <h5>Students:</h5>
        <div v-for="(student, index) in userInfo.students" :key="index" class="role-container">
          <input
            type="text"
            v-model="userInfo.students[index]"
            placeholder="Enter role"
            class="form-control"
          />
          <button class="btn btn-danger" @click="removeStudent(index)">Remove</button>
        </div>
        <div class="button-group">
      <button class="btn btn-primary" @click="addStudent()">Add</button>
    </div>
      </div>

      
    </template>
    <template #footer>
      <span class="btn-group">
        <BasicButton
          class="btn btn-secondary"
          title="Cancel"
          @click="$refs.modal.close()"
        />
        <BasicButton
          class="btn btn-primary"
          title="Save"
          @click="submit"
        />
      </span>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicForm from "@/basic/Form.vue";
import BasicTable from "@/basic/table/Table.vue";
import BasicButton from "@/basic/Button.vue";

/**
 * Modal for viewing and editing user data
 *
 * @author: Linyin Huang
 */
export default {
  name: "EditPeerReviewsModal",
  components: { BasicModal, BasicForm, BasicTable, BasicButton },
  emits: ["updateReviews"],
  data() {
    return {
      userId: 0,
      
      options: {
        striped: true,
        hover: true,
        bordered: true,
        borderless: false,
        small: false,
      },
      columns: [
        { name: "Accept Terms", key: "acceptTerms" },
        { name: "Accept Stats", key: "acceptStats" },
        { name: "Last Login", key: "lastLoginAt" },
        { name: "Created At", key: "createdAt" },
        { name: "Updated At", key: "updatedAt" },
        { name: "Deleted At", key: "deletedAt" },
      ],
      userInfo: {
        roles: [],
        students: [],
        status: false,
      },
      currentReview: {}
      
    };
  },
  computed: {
    userInfoComputed() {
      const userInfo = this.$store.getters["admin/getUserDetails"];
      const formatDate = (date) => (date ? new Date(date).toLocaleDateString() : "-");
      return {
        ...userInfo,
        createdAt: formatDate(userInfo.createdAt),
        updatedAt: formatDate(userInfo.updatedAt),
        lastLoginAt: formatDate(userInfo.lastLoginAt),
        deletedAt: formatDate(userInfo.deletedAt),
        roles: [''], // Initialize roles array if undefined
        docName: "Hello"
      };
    },
  },

  methods: {
    toggleStatus() {
      this.userInfo.status = !this.userInfo.status; // Toggle between finished and in progress
    },
    addRole() {
      this.userInfo.roles.push(''); // Add a new empty role
    },
    removeRole(index) {
      this.userInfo.roles.splice(index, 1); // Remove the role at the given index
    },
    addStudent() {
      this.userInfo.students.push(''); // Add a new empty role
    },
    removeStudent(index) {
      this.userInfo.students.splice(index, 1); // Remove the role at the given index
    },
    open(userId) {
      this.$refs.editPeerReviewsModal.openModal();
      this.populate(userId)
    },
    populate(data) {
      console.log(data)
      this.reset()
      this.currentReview = data;
      this.userInfo.docName = data.docName;
      this.userInfo.status = data.finished;
      for(let i = 0; i < data.students.length; i++)
    {
      this.userInfo.students.push(data.students[i])
    }
    for(let i = 0; i < data.mods.length; i++)
    {
      this.userInfo.roles.push(data.mods[i])
    }
      
    },
    submit() {
      console.log(this.currentReview)
      let data = {}
      data.id = this.currentReview.id;
      data.docName = this.userInfo.docName;
      data.finished = this.userInfo.status;
      data.students = this.userInfo.students
      data.mods = this.userInfo.roles
      data.manage = this.currentReview.manage
      this.$emit('updateReviews', data)
    },
    getUserDetails(userId) {
      this.$socket.emit("userGetDetails", userId);
    },
    resetForm() {
      this.eventBus.emit("resetFormField");
    },
    reset() {
      this.userInfo.docName = "";
      this.userInfo.status = false;
      this.userInfo.students = [];
      this.userInfo.roles = [];
    }
  },
};
</script>

<style scoped>


.role-container {
  display: grid; /* Use grid layout for the role container */
  grid-template-columns: 1fr auto; /* One column for input, one for button */
  gap: 10px; /* Space between input and button */
  margin-bottom: 10px; /* Add some space between role inputs */

}

.button-group {
  display: grid; /* Use grid layout for button group */
  grid-auto-flow: column; /* Arrange buttons in a row */
  gap: 10px; /* Space between buttons */
  margin-bottom: 10px;
}
/* Custom field styles */
.field-font {
  font-family: 'Arial', sans-serif; /* Change this to your desired font */
  font-size: 16px; /* Change font size as needed */
  color: #333; /* Change text color if needed */
}

.field-font input {
  font-family: inherit; /* Ensures input fields inherit the font style */
}
.detail-table-container {
  margin-top: 15px;
  overflow-x: auto;
  
}

.detail-table-container > :deep(table) {
  width: 50rem;
}

.detail-table-container > :deep(table) {
  width: 50rem;
}

/* Custom toggle switch styling */
.toggle-switch {
  display: inline-block;
  width: 50px; /* Width of the switch */
  height: 28px; /* Height of the switch */
  background-color: #ddd; /* Background color when off */
  border-radius: 34px; /* Rounded edges */
  position: relative; /* Position relative for the inner switch */
  cursor: pointer; /* Pointer cursor on hover */
  transition: background-color 0.3s; /* Transition for background color */
  margin-right: 10px;
  margin-left: 10px;
}

.toggle-switch.active {
  background-color: #4caf50; /* Background color when on (Finished) */
}

/* Custom toggle switch styling */
.toggle-container {
  display: flex; /* Use flexbox for alignment */
  align-items: center; /* Center items vertically */
}

.switch {
  position: absolute;
  width: 23px; /* Width of the inner switch */
  height: 23px; /* Height of the inner switch */
  background-color: white; /* Inner switch color */
  border-radius: 50%; /* Round shape */
  top: 2px; /* Positioning from top */
  left: 2px; /* Initial position */
  transition: transform 0.3s; /* Transition for movement */
  margin-right: 10px;
}

.form-group {
  font-size: 16px;
  margin-top: 10px;
  margin-bottom: 10px
}

.form-control {
  font-size: 16px;
}

.on {
  transform: translateX(26px); /* Move switch to the right when on */
}
</style>
