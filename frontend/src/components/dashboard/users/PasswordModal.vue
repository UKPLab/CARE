<template>
  <BasicModal ref="modal" @hide="resetForm">
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
          Confirm
        </button>
      </span>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicForm from "@/basic/Form.vue";

/**
 * Modal for resetting user's password
 *
 * @author: Linyin Huang
 */
export default {
  name: "PasswordModal",
  components: { BasicModal, BasicForm },
  data() {
    return {
      userId: 0,
      data: {},
      fields: [
        {
          key: "password",
          type: "password",
          required: true,
          placeholder: "",
          pattern: ".{8,}",
          default: "",
        },
      ],
    };
  },
  methods: {
    open(id) {
      this.userId = id;
      this.$refs.modal.open();
    },
    submit() {
      if(!this.$refs.form.validate()) return;
      const {
        modelValue: { password },
      } = this.$refs.form;
      const userId = this.userId;
      if (!password) return;
      this.$socket.emit("resetUserPwd", { userId, password }, (response) => {
        if (response.success) {
          this.$refs.modal.close();
          this.eventBus.emit("toast", {
            title: "Password updated",
            message: response.message,
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: "Fail to reset password",
            message: response.message,
            variant: "danger",
          });
        }
      });
    },
    resetForm() {
      this.$refs.form.modelValue.password = '';
      this.eventBus.emit("resetFormField");
    }
  },
};
</script>

<style scoped></style>
