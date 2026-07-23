<template>
  <BasicModal
      ref="modal"
      name="UserCreateModal"
      @hide="reset">
    <template #title>
      <span>{{$t('users.addUser')}}</span>
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
          :title="$t('common.cancel')"
          class="btn btn-secondary"
          @click="$refs.modal.close()"
      />
      <BasicButton
          :title="$t('common.add')"
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
import {resolveApiMessage} from "@/assets/utils";

/**
 * Modal for creating a single new user
 * @author: Linyin Huang, Dennis Zyska
 */
export default {
  name: "UserAddModal",
  components: {BasicModal, BasicButton, BasicForm},
  data() {
    return {
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
  formFields() {
    return [
      {
        key: "firstName",
        label: this.$t("dashboard.users.firstNameLabel"),
        type: "text",
        required: true,
        placeholder: this.$t("dashboard.users.placeholders.provideFirstName"),
      },
      {
        key: "lastName",
        label: this.$t("dashboard.users.lastNameLabel"),
        type: "text",
        required: true,
        placeholder: this.$t("dashboard.users.placeholders.provideLastName"),
      },
      {
        key: "userName",
        label: this.$t("dashboard.users.userNameLabel"),
        type: "text",
        required: true,
        pattern: "^[a-zA-Z0-9]+$",
        placeholder: this.$t("dashboard.users.placeholders.provideUsername"),
      },
      {
        key: "email",
        label: this.$t("dashboard.users.emailLabel"),
        type: "email",
        required: true,
        pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
        placeholder: this.$t("dashboard.users.placeholders.emailExample"),
      },
      {
        key: "password",
        label: this.$t("dashboard.users.passwordLabel"),
        type: "password",
        required: true,
        pattern: ".{8,}",
        placeholder: this.$t("dashboard.users.placeholders.passwordMinLength"),
      },
    ];
  },

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
            title: this.$t('dashboard.users.userCreationCompleted'),
            variant: "success",
            message: this.$t('dashboard.users.userCreationCompletedMessage'),
          });
          this.$refs.modal.close();
        } else {
          this.$refs.modal.waiting = false;
          this.eventBus.emit("toast", {
            title: this.$t('errors.users.userCreationFailed'),
            variant: "danger",
            message: resolveApiMessage(response, 'errors.users.userCreationFailed'),
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
