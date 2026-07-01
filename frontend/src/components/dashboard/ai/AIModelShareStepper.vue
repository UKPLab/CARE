<template>
  <StepperModal
    ref="shareStepper"
    :steps="shareSteps"
    :validation="shareStepValidation"
    submit-text="Save"
    @submit="saveShare"
  >
    <template #title>
      Share {{ resourceLabel }}
    </template>
    <template #step-1>
      <div v-if="selectedShareModel" class="mb-3">
        <strong>{{ resourceLabel }}:</strong> {{ selectedShareModel.name }}
      </div>
      <div class="mb-3">
        <label class="form-label d-block">Share by</label>
        <div class="form-check form-check-inline">
          <input id="shareByUsers" v-model="shareForm.mode" class="form-check-input" type="radio" value="users" />
          <label class="form-check-label" for="shareByUsers">Users</label>
        </div>
        <div class="form-check form-check-inline">
          <input id="shareByRoles" v-model="shareForm.mode" class="form-check-input" type="radio" value="roles" />
          <label class="form-check-label" for="shareByRoles">Roles</label>
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label" for="shareExpiryDate">Expiry Date</label>
        <input
          id="shareExpiryDate"
          v-model="shareForm.expiryDate"
          class="form-control"
          type="date"
          :min="minShareExpiryDate"
        />
        <small class="text-muted">Required. Access expires on this date.</small>
      </div>
      <small class="text-muted">Next step: select {{ shareAudienceLabel.toLowerCase() }}.</small>
    </template>
    <template #step-2>
      <div v-if="isLoadingShareData" class="text-muted mb-2">
        Loading share options...
      </div>
      <div v-else-if="shareForm.mode === 'users'" @click="syncSelectionFromTable" @change="syncSelectionFromTable">
        <BasicTable
          ref="shareSelectionTable"
          :model-value="selectedRowsForTable"
          :columns="shareSelectionColumns"
          :data="shareSelectionData"
          :options="shareSelectionTableOptions"
          :max-table-height="360"
          @update:model-value="onSelectionRowsUpdate"
        />
      </div>
      <div v-else-if="shareForm.mode === 'roles'" @click="syncSelectionFromTable" @change="syncSelectionFromTable">
        <BasicTable
          ref="shareSelectionTable"
          :model-value="selectedRowsForTable"
          :columns="shareSelectionColumns"
          :data="shareSelectionData"
          :options="shareSelectionTableOptions"
          :max-table-height="360"
          @update:model-value="onSelectionRowsUpdate"
        />
      </div>
    </template>
    <template #step-3>
      <div class="mb-3">
        <div><strong>{{ resourceLabel }}:</strong> {{ selectedShareModel?.name || "-" }}</div>
        <div><strong>Audience Type:</strong> {{ shareAudienceLabel }}</div>
        <div><strong>Selected:</strong> {{ activeSelectionIds.length }}</div>
        <div><strong>Expiry Date:</strong> {{ shareExpiryDateLabel }}</div>
      </div>
      <BasicTable
        :columns="shareSelectionColumns"
        :data="activeShareSelections"
        :options="shareReviewTableOptions"
        :max-table-height="360"
      />
    </template>
  </StepperModal>
</template>

<script>
/**
 * Guided stepper configuring share audience (users vs roles) and synchronized expiry UX.
 *
 * @author Akash Gundapuneni
 */

import BasicTable from "@/basic/Table.vue";
import StepperModal from "@/basic/modal/StepperModal.vue";

export default {
  name: "AIModelShareStepper",
  components: {
    BasicTable,
    StepperModal,
  },
  props: {
    currentUserId: {
      type: Number,
      required: true,
    },
    resourceLabel: {
      type: String,
      required: true,
    },
    resourceIdKey: {
      type: String,
      required: true,
    },
    shareOptionsCommand: {
      type: String,
      required: true,
    },
    shareConfigCommand: {
      type: String,
      required: true,
    },
    saveShareCommand: {
      type: String,
      required: true,
    },
    ownerOnlyMessage: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      shareForm: this.getEmptyShareForm(),
      shareTargets: {
        users: [],
        roles: [],
      },
      selectedUserIds: [],
      selectedRoleIds: [],
      shareSelectionTableOptions: {
        striped: true,
        hover: true,
        pagination: 10,
        selectableRows: true,
        search: true,
      },
      shareReviewTableOptions: {
        striped: true,
        hover: true,
        pagination: 10,
      },
      selectedShareModel: null,
      isLoadingShareData: false,
      isSavingShare: false,
    };
  },
  computed: {
    shareSteps() {
      return [
        { title: "Share Settings" },
        { title: `Select ${this.shareAudienceLabel}` },
        { title: "Review & Save" },
      ];
    },
    shareStepValidation() {
      return [
        !!this.shareForm.mode && !!this.shareForm.expiryDate,
        !this.isLoadingShareData && this.activeSelectionIds.length > 0,
        !this.isSavingShare,
      ];
    },
    shareSelectionColumns() {
      if (this.shareForm.mode === "roles") {
        return [
          { name: "Role", key: "label", sortable: true },
          { name: "Type", key: "type", sortable: true },
        ];
      }
      return [
        { name: "Name", key: "label", sortable: true },
        { name: "Type", key: "type", sortable: true },
      ];
    },
    shareSelectionData() {
      if (this.shareForm.mode === "roles") {
        return this.shareTargets.roles.map((role) => ({ ...role, type: "Role" }));
      }
      return this.shareTargets.users.map((user) => ({ ...user, type: "User" }));
    },
    activeSelectionIds() {
      if (this.shareForm.mode === "roles") {
        return this.selectedRoleIds;
      }
      return this.selectedUserIds;
    },
    selectedIdSet() {
      return new Set(
        (this.activeSelectionIds || [])
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
      );
    },
    selectedRowsForTable() {
      return this.shareSelectionData.filter((row) => this.selectedIdSet.has(Number(row.id)));
    },
    activeShareSelections() {
      return this.selectedRowsForTable;
    },
    shareAudienceLabel() {
      if (this.shareForm.mode === "roles") return "Roles";
      return "Users";
    },
    minShareExpiryDate() {
      return this.toDateInputString(new Date());
    },
    shareExpiryDateLabel() {
      if (!this.shareForm.expiryDate) return "-";
      const date = new Date(`${this.shareForm.expiryDate}T00:00:00`);
      if (Number.isNaN(date.getTime())) return this.shareForm.expiryDate;
      return date.toLocaleDateString();
    },
    resourceLabelLower() {
      return this.resourceLabel.toLowerCase();
    },
  },
  methods: {
    getEmptyShareForm() {
      return {
        mode: "users",
        expiryDate: "",
      };
    },
    toDateInputString(value) {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) {
        return "";
      }
      const pad = (number) => String(number).padStart(2, "0");
      const year = date.getFullYear();
      const month = pad(date.getMonth() + 1);
      const day = pad(date.getDate());
      return `${year}-${month}-${day}`;
    },
    normalizeIdList(ids) {
      return [...new Set((ids || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
    },
    onSelectionRowsUpdate(rows) {
      const nextIds = this.normalizeIdList((rows || []).map((row) => row.id));
      if (this.shareForm.mode === "roles") {
        this.selectedRoleIds = nextIds;
      } else {
        this.selectedUserIds = nextIds;
      }
    },
    syncSelectionFromTable() {
      const tableRef = this.$refs.shareSelectionTable;
      const selectedRows = Array.isArray(tableRef?.currentData) ? tableRef.currentData : null;
      if (selectedRows) {
        this.onSelectionRowsUpdate(selectedRows);
      }
    },
    emitAiServiceCommand(command, data = {}) {
      return new Promise((resolve, reject) => {
        this.$socket.emit("serviceCommand", {
          service: "AIService",
          command,
          data,
        }, (result) => {
          if (result?.success) {
            resolve(result.data);
          } else {
            reject(new Error(result?.message || "AI service request failed"));
          }
        });
      });
    },
    async open(row) {
      if (!row?.id) {
        this.toastError("Invalid model selected");
        return;
      }
      if (Number(row.userId) !== Number(this.currentUserId)) {
        this.toastError(this.ownerOnlyMessage);
        return;
      }

      this.selectedShareModel = row;
      this.shareForm = this.getEmptyShareForm();
      this.selectedUserIds = [];
      this.selectedRoleIds = [];
      this.isLoadingShareData = true;
      this.$refs.shareStepper.open();

      try {
        const [targets, shareConfig] = await Promise.all([
          this.emitAiServiceCommand(this.shareOptionsCommand),
          this.emitAiServiceCommand(this.shareConfigCommand, { [this.resourceIdKey]: row.id }),
        ]);

        this.shareTargets = {
          users: Array.isArray(targets?.users) ? targets.users : [],
          roles: Array.isArray(targets?.roles) ? targets.roles : [],
        };
        this.shareForm = {
          mode: ["users", "roles"].includes(shareConfig?.mode) ? shareConfig.mode : "users",
          expiryDate: shareConfig?.expiryDate ? this.toDateInputString(shareConfig.expiryDate) : "",
        };
        this.selectedUserIds = this.normalizeIdList(shareConfig?.userIds);
        this.selectedRoleIds = this.normalizeIdList(shareConfig?.roleIds);
      } catch (error) {
        this.toastError(error.message || `Failed to load ${this.resourceLabelLower} share data`);
      } finally {
        this.isLoadingShareData = false;
      }
    },
    async saveShare() {
      if (!this.selectedShareModel?.id) {
        this.toastError("No model selected");
        return;
      }

      const payload = {
        [this.resourceIdKey]: this.selectedShareModel.id,
        mode: this.shareForm.mode,
        expiryDate: this.shareForm.expiryDate,
      };
      if (!this.shareForm.expiryDate) {
        this.toastError("Please select an expiry date");
        return;
      }
      if (this.shareForm.mode === "roles") {
        const roleIds = [...this.selectedRoleIds];
        if (roleIds.length === 0) {
          this.toastError("Please select at least one role");
          return;
        }
        payload.roleIds = roleIds;
      } else {
        const userIds = [...this.selectedUserIds];
        if (userIds.length === 0) {
          this.toastError("Please select at least one user");
          return;
        }
        payload.userIds = userIds;
      }

      this.isSavingShare = true;
      try {
        this.$refs.shareStepper.setWaiting(true);
        await this.emitAiServiceCommand(this.saveShareCommand, payload);
        this.$refs.shareStepper.close();
        this.eventBus.emit("toast", {
          title: "Success",
          message: `${this.resourceLabel} sharing updated`,
          variant: "success",
        });
      } catch (error) {
        this.toastError(error.message || `Failed to save ${this.resourceLabelLower} sharing`);
      } finally {
        this.$refs.shareStepper.setWaiting(false);
        this.isSavingShare = false;
      }
    },
    toastError(message) {
      this.eventBus.emit("toast", {
        title: "Error",
        message,
        variant: "danger",
      });
    },
  },
};
</script>
