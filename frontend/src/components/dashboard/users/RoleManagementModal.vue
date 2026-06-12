<template>
  <BasicModal
    ref="modal"
    name="RoleManagementModal"
  >
    <template #title>
      <span>Create Role</span>
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
          title="Cancel"
          @click="$refs.modal.close()"
        />
        <BasicButton
          class="btn btn-primary"
          title="Create Role"
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
          label: "Role Name",
          type: "text",
          required: true,
          placeholder: "Enter role name",
          description: "Create a new system role.",
        },
        {
          key: "description",
          label: "Description",
          type: "text",
          required: false,
          placeholder: "Optional role description",
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
          title: "Role already exists",
          message: "A role with this name already exists.",
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
              title: "Role created",
              message: "Role has been successfully created.",
              variant: "success",
            });
            this.$emit("update-user");
            this.$refs.modal.close();
          } else {
            this.eventBus.emit("toast", {
              title: "Failed to create role",
              message: result.message,
              variant: "danger",
            });
          }
        }
      );
    },
  },
};
</script>
