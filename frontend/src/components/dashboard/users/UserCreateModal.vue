<template>
  <BasicModal
      ref="modal"
      name="UserCreateModal"
      @hide="reset">
    <template #title>
      <span>Add User</span>
    </template>
    <template #body>
      <BasicForm
          ref="form"
          v-model="formData"
          :fields="formFields"
      />
    </template>
    <template #footer>
      <BasicButton
          title="Cancel"
          class="btn btn-secondary"
          @click="$refs.modal.close()"
      />
      <BasicButton
          title="Add"
          class="btn btn-primary"
          :disabled="isDisabled"
          @click="createUser"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicForm from "@/basic/Form.vue";

/**
 * Modal for creating a single new user
 * @author: Linyin Huang, Dennis Zyska
 */
export default {
  name: "UserAddModal",
  components: {BasicModal, BasicButton, BasicForm},
  emits: ["updateUser"],
  data() {
    return {
      formFields: [
        {
          key: "firstName",
          label: "First Name:",
          type: "text",
          required: true,
          placeholder: "please provide the first name",
        },
        {
          key: "lastName",
          label: "Last Name:",
          type: "text",
          required: true,
          placeholder: "please provide the last name",
        },
        {
          key: "userName",
          label: "Username:",
          type: "text",
          required: true,
          pattern: "^[a-zA-Z0-9]+$",
          placeholder: "please provide the username - no special characters",
        },
        {
          key: "email",
          label: "Email:",
          type: "email",
          required: true,
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          placeholder: "email@example.com",
        },
        {
          key: "password",
          label: "Password:",
          type: "password",
          required: true,
          pattern: ".{8,}",
          placeholder: "password should be at least 8 characters long",
        },
      ],
      formData: {
        firstName: "",
        lastName: "",
        userName: "",
        email: "",
        password: "",
        isCreatedByAdmin: true,
      },
    };
  },
  computed: {
    isDisabled() {
      return Object.values(this.formData).some((v) => v === "");
    },
  },
  methods: {
    open() {
      this.$refs.modal.open();
    },
    reset() {
      this.formData = {
        ...this.formData,
        firstName: "",
        lastName: "",
        userName: "",
        email: "",
        password: "",
      };
    },
    async createUser() {
      if (!this.$refs.form.validate()) return;
      this.$refs.modal.waiting = true;

      this.$socket.emit("userCreate", this.formData, (response) => {
        if (response.success) {
          this.eventBus.emit("toast", {
            title: "User Creation Completed",
            variant: "success",
            message: "The user creation was successful",
          });
          this.$refs.modal.close();
          this.$emit("updateUser");
        } else {
          this.$refs.modal.waiting = false;
          this.eventBus.emit("toast", {
            title: "User Creation Failed",
            variant: "danger",
            message: response.message,
          });
        }
      });
    },
  },
};
</script>

<style scoped>
.form-field {
  display: flex;
  align-items: center;
  margin: 25px 0;

  .form-label {
    flex-shrink: 0;
    margin-bottom: 0;
    margin-right: 0.5rem;
  }
}
</style>
