<template>
  <BasicModal
      ref="modal"
      name="DetailsModal"
      @hide="resetForm">
    <template #title>
      <slot name="title">
        <span>{{ $t("users.editUser") }}</span>
      </slot>
    </template>
    <template #body>
      <BasicForm
          ref="form"
          v-model="userInfo"
          :fields="formFields"
      />
      <div class="detail-table-container">
        <BasicTable
            :columns="columns"
            :data="[userInfo]"
            :options="options"
            :max-table-height="'60vh'"
        />
      </div>
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
            :title="$t('common.save')"
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
import { resolveApiMessage } from "@/assets/utils";

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
      formFields: [
        {
          key: "userName",
          label: this.$t("dashboard.users.userNameLabel"),
          type: "text",
          required: true,
          readOnly: true,
        },
        {
          key: "firstName",
          label: this.$t("dashboard.users.firstNameLabel"),
          type: "text",
          required: true,
        },
        {
          key: "lastName",
          label: this.$t("dashboard.users.lastNameLabel"),
          type: "text",
          required: true,
        },
        {
          key: "email",
          label: this.$t("dashboard.users.emailLabel"),
          type: "text",
          required: true,
        },
        {
          key: "roles",
          label: this.$t("dashboard.study.roles"),
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
        {name: this.$t("users.columns.acceptTerms"), key: "acceptTerms"},
        {name: this.$t("users.columns.acceptStats"), key: "acceptStats"},
        {name: this.$t("users.columns.lastLogin"), key: "lastLoginAt"},
        {name: this.$t("common.createdAt"), key: "createdAt"},
        {name: this.$t("dashboard.users.updatedAt"), key: "updatedAt"},
        {name: this.$t("dashboard.users.deletedAt"), key: "deletedAt"},
      ],
    };
  },
  computed: {
    systemRoles() {
      return this.$store.getters["admin/getSystemRoles"];
    },
    userInfo(){
      const user = this.$store.getters["table/user/get"](this.userId);
      if (!user) {
        return {};
      }
      const formatDate = (date) => (date ? new Date(date).toLocaleDateString() : "-");
      return {
        ...user,
        roles: (user.roles || [])
            .map((roleId) => this.systemRoles.find((r) => r.id === roleId)?.name)
            .filter(Boolean),
        createdAt: formatDate(user.createdAt),
        updatedAt: formatDate(user.updatedAt),
        lastLoginAt: formatDate(user.lastLoginAt),
        deletedAt: formatDate(user.deletedAt),
      };
    },
  },
  mounted() {
    const options = this.systemRoles.map((role) => ({
      value: role.name,
      label: this.$te(`users.roles.${role.name}`)
        ? this.$t(`users.roles.${role.name}`)
        : role.name.charAt(0).toUpperCase() + role.name.slice(1),
    }));
    const index = this.formFields.findIndex(({key}) => key === "roles");
    this.formFields[index].options = options;
  },
  methods: {
    open(userId) {
      this.userId = userId;
      this.$refs.modal.open();
    },
    submit() {
      if (!this.$refs.form.validate()) {
        return;
      }
      const userId = this.userId;
      const {firstName, lastName, email, roles} = this.userInfo;
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
            title: this.$t("dashboard.users.userUpdated"),
            message: this.$t("dashboard.users.userUpdatedMessage"),
            variant: "success",
          });
        } else {
          this.$refs.modal.waiting = false;
          this.eventBus.emit("toast", {
            title: this.$t("errors.users.updateFailed"),
            message: resolveApiMessage(response),
            variant: "danger",
          });
        }
      });
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
