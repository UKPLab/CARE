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
          <td>2024-07-02</td>
          <td>2024-07-02</td>
          <td>2024-07-02</td>
        </tr>
        <tr>
          <th>Created At</th>
          <th>Updated At</th>
          <th>Deleted At</th>
        </tr>
        <tr>
          <td>2024-07-02</td>
          <td>2024-07-02</td>
          <td>2024-07-02</td>
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
        },
        {
          key: "lastName",
          label: "Last Name:",
          type: "text",
        },
        {
          key: "email",
          label: "Email:",
          type: "text",
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
      editTimeout: null,
    };
  },
  computed: {
    userInfo() {
      return this.$store.getters["admin/getUserDetails"];
    },
  },

  methods: {
    open(userId) {
      this.$refs.modal.open();
      this.getUserDetails(userId);
    },
    getUserDetails(userId) {
      this.$socket.emit("requestUserDetails", userId);
    },
    submit() {
      const { modelValue } = this.$refs.form;
      this.$socket.emit("testABC", modelValue);
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
