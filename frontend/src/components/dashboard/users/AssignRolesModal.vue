<template>
  <StepperModal
    ref="stepperModal"
    :steps="steps"
    :validation="validation"
    submit-text="Assign Roles"
    @submit="submit"
  >
    <template #title>
      <h5 class="modal-title">Assign Roles</h5>
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
          <h6>Manage rights for <strong class="text-primary">{{ selectedRoleName }}</strong> role</h6>
          <small class="text-muted">
            Select the rights for this role. Note: All users have basic <strong>"user"</strong> rights by default.
          </small>
        </div>
        <BasicTable
          :columns="rightsColumns"
          :data="allRights"
          v-model="roleRights"
          :options="rightsTableOptions"
        />
      </div>
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicForm from "@/basic/Form.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";

export default {
  name: "AssignRolesModal",
  subscribeTable: ["user_role", "user_right"],
  components: {
    StepperModal,
    BasicForm,
    BasicTable,
    BasicButton,
  },
  emits: ["updateUser"],
  data() {
    return {
      formData: {
        roleId: null,
      },
      roleRights: [],
      originalRoleRights: [],
      allRights: [],
      steps: [
        { title: "Select Role" },
        { title: "Manage Rights" },
      ],
      rightsColumns: [
        { name: "Right Name", key: "name", sortable: true },
        { name: "Description", key: "description" },
      ],
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
          label: "Select Role",
          type: "select",
          required: true,
          options: this.availableRoles.filter(role => !role.deleted && role.name !== "admin").map(role => ({
            value: role.id,
            name: role.name,
          })),
          description: "Choose a role to assign to the user.",
        },
      ];
    },
    availableRoles() {
      return this.$store.getters["table/user_role/getAll"].filter(role => !role.deleted);
    },
    selectedRoleName() {
      const role = this.availableRoles.find(r => r.id === this.formData.roleId);
      return role ? role.name : "";
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
            title: "Error",
            message: "Failed to load available rights",
            variant: "danger",
          });
        }
      });
    },
    loadRoleRights(roleId) {
      this.$socket.emit("userGetRoleBasedRights", { roleId }, (response) => {
        if (response.success) {
          
          // Get the selected right names from the role_right_matching response
          const selectedRightNames = response.data.map(item => item.userRightName);
          
          // Filter allRights to only include the ones that are selected for this role
          this.roleRights = this.allRights.filter(right => 
            selectedRightNames.includes(right.name)
          );
          
          // Store the original rights for comparison
          this.originalRoleRights = JSON.parse(JSON.stringify(this.roleRights));
        } else {
          this.eventBus.emit("toast", {
            title: "Error",
            message: "Failed to load role rights",
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
        title: "Role Rights Updated",
        message: "Role rights have been successfully updated",
        variant: "success",
      });
      
      this.$emit("updateUser");
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
              title: "Error",
              message: result.message || "Failed to assign role rights",
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
