<template>
  <StepperModal
      ref="stepperModal"
      :steps="steps"
      :validation="validation"
      :submit-text="$t('users.rights.assignRights')"
      @submit="submit"
  >
    <template #title>
      <h5 class="modal-title">{{ $t('users.rights.managementTitle') }}</h5>
    </template>
    <template #step="{ index }">
      <div v-if="index === 0">
        <BasicForm
            ref="roleForm"
            v-model="formData"
            :fields="roleFields"
        />
      </div>
      <div v-else-if="index === 1">
        <div class="mb-3">
          <h6>
            {{ $t('users.rights.manageRightsFor') }}
            <strong class="text-primary">{{ selectedRoleName }}</strong>
            {{ $t('users.rights.role') }}
          </h6>
          <i18n-t
            keypath="users.rights.selectRightsNote"
            tag="small"
            class="text-muted"
          >
            <template #userRole>
              <strong>{{ $t('dashboard.users.userWithQuotes') }}</strong>
            </template>
          </i18n-t>
        </div>
        <BasicTable
            v-model="roleRights"
            :columns="rightsColumns"
            :data="allRights"
            :options="rightsTableOptions"
            :max-table-height="'60vh'"
        />
      </div>
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicForm from "@/basic/Form.vue";
import BasicTable from "@/basic/Table.vue";
import { resolveApiMessage } from "@/assets/utils";

export default {
  name: "AssignRolesModal",
  subscribeTable: ["user_role", "user_right"],
  components: {
    StepperModal,
    BasicForm,
    BasicTable,
  },
  data() {
    return {
      formData: {
        roleId: null,
      },
      roleRights: [],
      originalRoleRights: [],
      allRights: [],
      rightsTableOptions: {
        striped: true,
        hover: true,
        pagination: 10,
        search: true,
        selectableRows: true,
      },
    };
  },
  computed: {
    steps() {
      return [
        { title: this.$t('users.rights.selectRole') },
        { title: this.$t('users.rights.manageRights') },
      ];
    },
    rightsColumns() {
      return [
        { name: this.$t('users.rights.rightName'), key: "name", sortable: true },
        { name: this.$t('common.description'), key: "description" },
      ];
    },
    validation() {
      return [
        this.formData.roleId !== null,
        this.hasRightsChanged,
      ];
    },
    hasRightsChanged() {
      // Compare current roleRights with originalRoleRights
      if (this.roleRights.length !== this.originalRoleRights.length) {
        return true;
      }

      // Sort both arrays by name for comparison
      const currentNames = this.roleRights.map(r => r.name).sort();
      const originalNames = this.originalRoleRights.map(r => r.name).sort();

      // Check if arrays are different
      return !currentNames.every((name, index) => name === originalNames[index]);
    },
    roleFields() {
      return [
        {
          key: "roleId",
          label: this.$t('users.rights.selectRole'),
          type: "select",
          required: true,
          options: this.availableRoles.filter(role => !role.deleted && role.name !== "admin").map(role => ({
            value: role.id,
            name: this.$te(`users.roles.${role.name}`)
              ? this.$t(`users.roles.${role.name}`)
              : role.name,
          })),
          description: this.$t('users.rights.chooseRoleDescription'),
        },
      ];
    },
    availableRoles() {
      return this.$store.getters["table/user_role/getAll"].filter(role => !role.deleted);
    },
    selectedRoleName() {
      const role = this.availableRoles.find(r => r.id === this.formData.roleId);
      if (!role) {
        return "";
      }
      const key = `users.roles.${role.name}`;
      return this.$te(key) ? this.$t(key) : role.name;
    },
  },
  watch: {
    formData: {
      handler(newFormData) {
        if (newFormData.roleId) {
          this.loadRoleRights(newFormData.roleId);
        }
      },
      deep: true,
    },
  },
  mounted() {
    this.loadAllRights();
  },
  methods: {
    open() {
      this.formData.roleId = null;
      this.$refs.stepperModal.open();
    },
    loadAllRights() {
      this.$socket.emit("userGetAllRights", {}, (response) => {
        if (response.success) {
          this.allRights = response.data;
        } else {
          this.eventBus.emit("toast", {
            title: this.$t('common.error'),
            message: this.$t('users.rights.errors.loadAvailableRightsFailed'),
            variant: "danger",
          });
        }
      });
    },
    loadRoleRights(roleId) {
      this.$socket.emit("userGetRoleBasedRights", {roleId}, (response) => {
        if (response.success) {

          // Get the selected right names from the role_right_matching response
          const selectedRightNames = response.data.map(item => item.userRightName);

          // Filter allRights so v-model rows match :data
          this.roleRights = this.allRights.filter((right) =>
              selectedRightNames.includes(right.name)
          );

          // Store the original rights for comparison
          this.originalRoleRights = JSON.parse(JSON.stringify(this.roleRights));
        } else {
          this.eventBus.emit("toast", {
            title: this.$t('common.error'),
            message: this.$t('users.rights.errors.loadRoleRightsFailed'),
            variant: "danger",
          });
        }
      });
    },
    async submit() {
      if (!this.formData.roleId) {
        return;
      }

      this.$refs.stepperModal.setWaiting(true);

      // Update role rights
      await this.updateRoleRights();

      this.eventBus.emit("toast", {
        title: this.$t('users.rights.updatedTitle'),
        message: this.$t('users.rights.updatedMessage'),
        variant: "success",
      });

      this.$refs.stepperModal.setWaiting(false);
      this.$refs.stepperModal.close();
    },
    async updateRoleRights() {
      // Compare original rights with current selection to find changes
      const originalRightNames = this.originalRoleRights.map(r => r.name);
      const currentRightNames = this.roleRights.map(r => r.name);

      // Rights to add (in current selection but not in original)
      const newRights = currentRightNames.filter(name => !originalRightNames.includes(name));

      // Rights to remove (in original but not in current selection)
      const deletedRights = originalRightNames.filter(name => !currentRightNames.includes(name));

      this.$socket.emit(
          "userAssignRoleRights",
          {
            roleId: this.formData.roleId,
            newRights: newRights,
            deletedRights: deletedRights,
          },
          (result) => {
            if (!result.success) {
              console.error("Failed to assign role rights:", result);
              this.eventBus.emit("toast", {
                title: this.$t('common.error'),
                message: resolveApiMessage(result, 'users.rights.errors.assignRoleRightsFailed'),
                variant: "danger",
              });
            }
          }
      );
    },
  },
};
</script>

<style scoped>
</style>
