<template>
  <BasicModal
      ref="modal"
      name="DetailsModal"
      @hide="resetForm">
    <template #title>
      <slot name="title">
        <span>Edit User</span>
      </slot>
    </template>
    <template #body>
      <BasicForm
          ref="form"
          v-model="formData"
          :fields="formFields"
      />
      <div class="detail-table-container">
        <BasicTable
            :columns="columns"
            :data="[userDetails]"
            :options="options"
            :max-table-height="'60vh'"
        />
      </div>
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
            title="Save"
            @click="submit"
        />
      </span>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicForm from "@/basic/Form.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";

/**
 * Modal for viewing and editing user data
 *
 * @author: Linyin Huang
 */
export default {
  name: "DetailsModal",
  components: {BasicModal, BasicForm, BasicTable, BasicButton},
  data() {
    return {
      userId: 0,
      formData: {
        userName: "",
        firstName: "",
        lastName: "",
        email: "",
        roles: [],
      },
      userDetails: {},
      formFields: [
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
        {name: "Accept Terms", key: "acceptTerms"},
        {name: "Accept Stats", key: "acceptStats"},
        {name: "Last Login", key: "lastLoginAt"},
        {name: "Created At", key: "createdAt"},
        {name: "Updated At", key: "updatedAt"},
        {name: "Deleted At", key: "deletedAt"},
      ],
    };
  },
  computed: {
    systemRoles() {
      return this.$store.getters["admin/getSystemRoles"];
    },
  },
  mounted() {
    const options = this.systemRoles.map((role) => ({
      value: role.name,
      label: role.name.charAt(0).toUpperCase() + role.name.slice(1),
    }));
    const index = this.formFields.findIndex(({key}) => key === "roles");
    this.formFields[index].options = options;
  },
  methods: {
    /**
     * Open the modal and load a writable draft from the Vuex user row.
     * @param {number} userId - User id to edit
     */
    open(userId) {
      this.userId = userId;
      this.loadFormFromStore(userId);
      this.$refs.modal.open();
    },
    /**
     * Copy store user into local formData / userDetails (draft for editing).
     * @param {number} userId - User id
     */
    loadFormFromStore(userId) {
      const user = this.$store.getters["table/user/get"](userId);
      if (!user) {
        this.formData = {
          userName: "",
          firstName: "",
          lastName: "",
          email: "",
          roles: [],
        };
        this.userDetails = {};
        return;
      }
      const formatDate = (date) => (date ? new Date(date).toLocaleDateString() : "-");
      this.formData = {
        userName: user.userName || "",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        roles: (user.roles || [])
            .map((roleId) => this.systemRoles.find((r) => r.id === roleId)?.name)
            .filter(Boolean),
      };
      this.userDetails = {
        acceptTerms: user.acceptTerms,
        acceptStats: user.acceptStats,
        lastLoginAt: formatDate(user.lastLoginAt),
        createdAt: formatDate(user.createdAt),
        updatedAt: formatDate(user.updatedAt),
        deletedAt: formatDate(user.deletedAt),
      };
    },
    submit() {
      if (!this.$refs.form.validate()) {
        return;
      }
      const userId = this.userId;
      const {firstName, lastName, email, roles} = this.formData;
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
            message: "Successfully updated user!",
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
    resetForm() {
      this.formData = {
        userName: "",
        firstName: "",
        lastName: "",
        email: "",
        roles: [],
      };
      this.userDetails = {};
      this.userId = 0;
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
