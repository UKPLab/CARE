<template>
  <BasicModal ref="modal" name="PasswordModal" @hide="resetForm">
    <template #title>
      <span>Reset Password</span>
    </template>
    <template #body>
      <BasicForm
        ref="form"
        v-model="data"
        :fields="fields"
        @submit.prevent="submit"
      />
    </template>
    <template #footer>
      <span class="btn-group">
        <BasicButton
          title="Cancel"
          class="btn btn-secondary"
          @click="$refs.modal.close()"
        />
        <BasicButton
          title="Confirm"
          class="btn btn-primary"
          @click="submit"
        />
      </span>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicForm from "@/basic/Form.vue";
import BasicButton from "@/basic/Button.vue";

/**
 * Modal for resetting user's password
 *
 * @author: Linyin Huang, Jannik Holmer
 */
export default {
  name: "PasswordModal",
  components: { BasicModal, BasicForm, BasicButton },
  data() {
    return {
      userId: 0,
      data: {},
      allFields: [
        {
          key:"oldPassword",
          type: "password",
          label: "Current Password",
          required: true,
          placeholder: "",
        },
        {
          key: "password",
          type: "password",
          label: "New Password",
          required: true,
          placeholder: "",
          pattern: ".{8,}",
          default: "",
        },
        {
          key: "confirmPassword",
          type: "password",
          label: "Confirm Password",
          required: true,
          placeholder: "",
          pattern: ".{8,}",
          default: "",
        }
      ],
    };
  },
  computed: {
    isAdmin() {
      return this.$store.getters['auth/isAdmin'];
    },
    fields() {
      const thisUserID = this.$store.getters['auth/getUserId'];
      if (this.isAdmin && !(this.userId === thisUserID)) {
        return this.allFields.filter(field => field.key !== 'oldPassword');
      } else {
        return this.allFields;
      }
    }
  },
  methods: {
    open(id) {
      this.userId = id;
      this.$refs.modal.open();
    },
    submit() {
      if(!this.$refs.form.validate() || !this.validatePassword()) return;
      const {
        modelValue: { password, oldPassword },
      } = this.$refs.form;
      const userId = this.userId;
      if (!password) return;
      this.$socket.emit("userResetPwd", { userId, password, oldPassword }, (response) => {
        if (response.success) {
          this.$refs.modal.close();
          this.eventBus.emit("toast", {
            title: "Password updated",
            message: "Successfully reset password!",
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to reset password",
            message: response.message,
            variant: "danger",
          });
        }
      });
    },
    resetForm() {
      this.$refs.form.modelValue.password = '';
      this.$refs.form.modelValue.confirmPassword = '';
      this.$refs.form.modelValue.oldPassword = "";
      this.eventBus.emit("resetFormField");
    },
    validatePassword() {
      const { confirmPassword, password } = this.$refs.form.modelValue;
      if (password !== confirmPassword) {
        this.eventBus.emit("toast", {
          title: "Validation Error",
          message: "Passwords do not match",
          variant: "danger",
        });
        return false;
      }
      return true;
    }
  },
};
</script>

<style scoped></style>
