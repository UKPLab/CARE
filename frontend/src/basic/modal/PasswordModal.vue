<template>
  <BasicModal ref="modal" name="PasswordModal" @hide="resetForm">
    <template #title>
      <span>{{ $t('auth.resetPassword') }}</span>
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
          :title="$t('common.cancel')"
          class="btn btn-secondary"
          @click="$refs.modal.close()"
        />
        <BasicButton
          :title="$t('common.confirm')"
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
import { resolveApiMessage } from "@/assets/utils";

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
    };
  },
  computed: {
    isAdmin() {
      return this.$store.getters['auth/isAdmin'];
    },
    allFields() {
      return [
        {
          key:"oldPassword",
          type: "password",
          label: this.$t('auth.currentPassword'),
          required: true,
          placeholder: "",
        },
        {
          key: "password",
          type: "password",
          label: this.$t('auth.newPassword'),
          required: true,
          placeholder: "",
          pattern: ".{8,}",
          default: "",
        },
        {
          key: "confirmPassword",
          type: "password",
          label: this.$t('auth.confirmPassword'),
          required: true,
          placeholder: "",
          pattern: ".{8,}",
          default: "",
        }
      ];
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
            title: this.$t('modals.passwordUpdated'),
            message: this.$t('modals.passwordResetSuccess'),
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: this.$t('errors.auth.passwordResetFailed'),
            message: resolveApiMessage(response),
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
          title: this.$t('errors.validation.validationError'),
          message: this.$t('errors.validation.auth.passwordsDoNotMatch'),
          variant: "danger",
        });
        return false;
      }
      const hasInvalidCharacter = [...password].some((c) => {
        const codePoint = c.codePointAt(0) || 0;
        return codePoint <= 31 || codePoint === 127 || codePoint > 0xFFFF;
      });
      if (/^\s*$/.test(password) || hasInvalidCharacter) {
        this.eventBus.emit("toast", {
          title: this.$t('errors.validation.validationError'),
          message: this.$t('errors.validation.auth.passwordInvalidChars'),
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
