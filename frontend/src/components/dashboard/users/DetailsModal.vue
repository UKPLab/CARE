<template>
  <BasicModal ref="modal">
    <template #title>
      <slot name="title">
        <span>Edit User</span>
      </slot>
    </template>
    <template #body>
      <BasicForm
        ref="form"
        v-model="userInfo"
        :fields="fields"
      />
      <table>
        <tr>
          <th>Accept Terms</th>
          <th>Accept Stats</th>
          <th>Last Login</th>
        </tr>
        <tr>
          <td>{{ userInfo.acceptTerms }}</td>
          <td>{{ userInfo.acceptStats }}</td>
          <td>{{ userInfo.lastLoginAt }}</td>
        </tr>
        <tr>
          <th>Created At</th>
          <th>Updated At</th>
          <th>Deleted At</th>
        </tr>
        <tr>
          <td>{{ userInfo.createdAt }}</td>
          <td>{{ userInfo.updatedAt }}</td>
          <td>{{ userInfo.deletedAt }}</td>
        </tr>
      </table>
    </template>
    <template #footer>
      <span class="btn-group">
        <button
          type="button"
          class="btn btn-secondary"
          @click="$refs.modal.close()"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          @click="submit"
        >
          Save
        </button>
      </span>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicForm from "@/basic/Form.vue";

/**
 * Modal for viewing and editing user data
 *
 * @author: Linyin Huang
 */
export default {
  name: "DetailsModal",
  components: { BasicModal, BasicForm },
  data() {
    return {
      userId: 0,
      userInfo: {},
      fields: [
        {
          key: "userName",
          label: "Username:",
          type: "text",
          required: true,
          readOnly: true,
        },
        {
          key: "firstName",
          label: "First Name:",
          type: "text",
          required: true,
        },
        {
          key: "lastName",
          label: "Last Name:",
          type: "text",
          required: true,
        },
        {
          key: "email",
          label: "Email:",
          type: "text",
          required: true,
        },
        {
          key: "roles",
          label: "Roles:",
          type: "checkbox",
          required: true,
          readOnly: false,
          options: [
            { value: "admin", label: "Admin" },
            { value: "teacher", label: "Teacher" },
            { value: "mentor", label: "Mentor" },
            { value: "student", label: "Student" },
          ],
        },
      ],
    };
  },
  computed: {
    userInfo() {
      const userInfo = this.$store.getters["admin/getUserDetails"];
      const formatDate = (date) =>
        date ? new Date(date).toLocaleDateString() : "-";
      return {
        ...userInfo,
        createdAt: formatDate(userInfo.createdAt),
        updatedAt: formatDate(userInfo.updatedAt),
        lastLoginAt: formatDate(userInfo.lastLoginAt),
        deletedAt: formatDate(userInfo.deletedAt),
      };
    },
  },

  methods: {
    open(userId) {
      this.userId = userId;
      this.$refs.modal.open();
      this.getUserDetails(userId);
    },
    submit() {
      if(!this.$refs.form.validate()) return;
      const userId = this.userId;
      const { modelValue } = this.$refs.form;
      const { firstName, lastName, email, roles } = modelValue;
      const userData = {
        firstName,
        lastName,
        email,
        roles,
      };
      this.$refs.modal.waiting = true;
      this.$socket.emit(
        "updateUserDetails",
        { userId, userData },
        (response) => {
          if (response.success) {
            this.$refs.modal.waiting = false;
            this.$refs.modal.close();
            this.eventBus.emit("toast", {
              title: "User updated",
              message: response.message,
              variant: "success",
            });
          } else {
            this.$refs.modal.waiting = false;
            this.eventBus.emit("toast", {
              title: "Fail to update",
              message: response.message,
              variant: "danger",
            });
          }
        }
      );
    },
    getUserDetails(userId) {
      this.$socket.emit("requestUserDetails", userId);
    },
  },
};
</script>

<style scoped>
table {
  margin-top: 15px;
  width: 100%;
}
th,
td {
  padding: 10px;
  text-align: left;
  border: 1px solid #ddd;
}
</style>
