<template>
  <BasicModal
    ref="modal"
    @hide="resetForm"
  >
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
      <div class="detail-table-container">
        <BasicTable
          :columns="columns"
          :data="[userInfo]"
          :options="options"
        />
      </div>
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
import BasicTable from "@/basic/table/Table.vue";

/**
 * Modal for viewing and editing user data
 *
 * @author: Linyin Huang
 */
export default {
  name: "DetailsModal",
  components: { BasicModal, BasicForm, BasicTable },
  data() {
    return {
      userId: 0,
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
    };
  },
  computed: {
    userInfo() {
      const userInfo = this.$store.getters["admin/getUserDetails"];
      const formatDate = (date) => (date ? new Date(date).toLocaleDateString() : "-");
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
      if (!this.$refs.form.validate()) {
        return;
      }
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
      this.$socket.emit("userUpdateDetails", { userId, userData }, (response) => {
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
      });
    },
    getUserDetails(userId) {
      this.$socket.emit("userGetDetails", userId);
    },
    resetForm() {
      this.eventBus.emit("resetFormField");
    },
  },
};
</script>

<style scoped>
.detail-table-container {
  margin-top: 15px;
  overflow-x: auto;
}

.detail-table-container > :deep(table) {
  width: 50rem;
}
</style>
