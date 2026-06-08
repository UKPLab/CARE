<template>
  <BasicModal
    ref="modal"
    name="RoleManagementModal"
  >
    <template #title>
      <span>{{ $t('users.roleManagement.title') }}</span>
    </template>

    <template #body>
      <BasicForm
        ref="form"
        v-model="formData"
        :fields="formFields"
      />
    </template>

    <template #footer>
      <span class="btn-group">
        <BasicButton
          class="btn btn-secondary"
          :title="$t('common.cancel')"
          @click="$refs.modal.close()"
        />
        <BasicButton
          class="btn btn-primary"
          :title="$t('users.roleManagement.buttons.create')"
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

export default {
  name: "RoleManagementModal",
  components: { BasicModal, BasicForm, BasicButton },
  subscribeTable: ["user_role"],
  emits: ["update-user"],
  data() {
    return {
      formData: {
        name: "",
        description: "",
      },
    };
  },
  computed: {
    allRoles() {
      return (this.$store.getters["table/user_role/getAll"] || []).filter((role) => !role.deleted);
    },
    formFields() {
      return [
        {
          key: "name",
          label: this.$t("users.roleManagement.fields.name.label"),
          type: "text",
          required: true,
          placeholder: this.$t("users.roleManagement.fields.name.placeholder"),
          description: this.$t("users.roleManagement.fields.name.description"),
        },
        {
          key: "description",
          label: this.$t("common.description"),
          type: "text",
          required: false,
          placeholder: this.$t("users.roleManagement.fields.description.placeholder"),
        },
      ];
    },
  },
  methods: {
    open() {
      this.formData = {
        name: "",
        description: "",
      };
      this.$refs.modal.open();
    },
    submit() {
      if (!this.$refs.form.validate()) {
        return;
      }
      const normalizedName = (this.formData.name || "").trim();
      if (!normalizedName) {
        return;
      }

      const roleExists = this.allRoles.some(
        (role) => role.name && role.name.toLowerCase() === normalizedName.toLowerCase()
      );
      if (roleExists) {
        this.eventBus.emit("toast", {
          title: this.$t("users.roleManagement.toasts.alreadyExists.title"),
          message: this.$t("users.roleManagement.toasts.alreadyExists.message"),
          variant: "warning",
        });
        return;
      }

      this.$refs.modal.waiting = true;
      this.$socket.emit(
        "appDataUpdate",
        {
          table: "user_role",
          data: {
            name: normalizedName,
            description: this.formData.description || "",
          },
        },
        (result) => {
          this.$refs.modal.waiting = false;
          if (result.success) {
            this.eventBus.emit("toast", {
              title: this.$t("users.roleManagement.toasts.createSuccess.title"),
              message: this.$t("users.roleManagement.toasts.createSuccess.message"),
              variant: "success",
            });
            this.$emit("update-user");
            this.$refs.modal.close();
          } else {
            this.eventBus.emit("toast", {
              title: this.$t("users.roleManagement.toasts.createFailed"),
              message: resolveApiMessage(result),
              variant: "danger",
            });
          }
        }
      );
    },
  },
};
</script>
