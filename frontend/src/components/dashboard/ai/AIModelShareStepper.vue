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
      <div class="border rounded p-3 mb-3">
        <label class="form-label" for="shareCostLimit">Cost limit per recipient ($)</label>
        <input
          id="shareCostLimit"
          v-model.number="shareForm.costLimit"
          class="form-control"
          type="number"
          min="0"
          step="0.01"
          placeholder="No limit"
        />
        <small class="text-muted">Optional. Same limit applied to every selected {{ shareAudienceLabel.toLowerCase() }}.</small>
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
        <div><strong>Expiry Date:</strong> {{ shareExpiryDateLabel }}</div>
        <div>
          <strong>Cost limit:</strong>
          {{ shareCostLimitLabel }}{{ shareTotalLimitLabel ? ` (${shareTotalLimitLabel} total)` : '' }}
        </div>
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
 * @author Akash Gundapuneni, Mohamed Rawhani
 */

import BasicTable from "@/basic/Table.vue";
import StepperModal from "@/basic/modal/StepperModal.vue";

export default {
  name: "AIModelShareStepper",
  subscribeTable: ["ai_budget", "ai_model_share", "ai_hook_share", "user_role", "user"],
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
    shareTable: {
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
    shareCostLimitLabel() {
      const value = Number(this.shareForm.costLimit);
      if (!Number.isFinite(value) || value <= 0) return "No limit";
      return `$${value.toFixed(2)}`;
    },
    shareTotalLimitLabel() {
      const value = Number(this.shareForm.costLimit);
      if (!Number.isFinite(value) || value <= 0 || this.activeSelectionIds.length <= 1) return "";
      return `$${(value * this.activeSelectionIds.length).toFixed(2)}`;
    },
    resourceLabelLower() {
      return this.resourceLabel.toLowerCase();
    },
    roleOptions() {
      return (this.$store.getters["table/user_role/getAll"] || [])
        .filter((role) => !role.deleted)
        .map((role) => ({ id: role.id, label: role.name || `Role ${role.id}` }));
    },
  },
  methods: {
    getEmptyShareForm() {
      return {
        mode: "users",
        expiryDate: "",
        costLimit: null,
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
    loadUserOptions() {
      const me = Number(this.currentUserId);
      return (this.$store.getters["table/user/getAll"] || [])
        .filter((user) => !user.deleted && Number(user.id) !== me)
        .map((user) => ({ id: user.id, label: user.userName }));
    },
    emitAppDataUpdate(table, data) {
      return new Promise((resolve, reject) => {
        this.$socket.emit("appDataUpdate", { table, data }, (result) => {
          if (result?.success) resolve(result.data);
          else reject(new Error(result?.message || "Failed to update data"));
        });
      });
    },
    getShareRows(matchFn) {
      const getter = this.$store.getters[`table/${this.shareTable}/getFiltered`];
      return getter ? getter(matchFn) : [];
    },
    findExistingShareCap(shareKey, shareId) {
      const getter = this.$store.getters["table/ai_budget/getFiltered"];
      if (!getter) return null;
      const matches = getter(
        (b) => !b.deleted
          && Number(b[shareKey]) === Number(shareId)
          && Number(b.limitType) === 0
      );
      return matches.length > 0 ? matches[0] : null;
    },
    findExistingShare(resourceId, recipient) {
      const matches = this.getShareRows((share) =>
        Number(share[this.resourceIdKey]) === Number(resourceId)
        && Number(share.userId || 0) === Number(recipient.userId || 0)
        && Number(share.roleId || 0) === Number(recipient.roleId || 0)
      );
      return matches.find((match) => !match.deleted) || matches[0] || null;
    },
    buildShareConfig(resourceId) {
      const shares = this.getShareRows((share) =>
        Number(share[this.resourceIdKey]) === Number(resourceId) && !share.deleted
      );
      const userIds = this.normalizeIdList(shares.map((share) => share.userId));
      const roleIds = this.normalizeIdList(shares.map((share) => share.roleId));
      const expiryCandidates = shares
        .map((share) => (share.expiryDate ? new Date(share.expiryDate) : null))
        .filter((date) => date && !Number.isNaN(date.getTime()));
      const expiryDate = expiryCandidates.length > 0
        ? new Date(Math.max(...expiryCandidates.map((date) => date.getTime())))
        : null;
      const mode = roleIds.length > 0 && userIds.length === 0 ? "roles" : "users";
      return { userIds, roleIds, expiryDate, mode };
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
        const users = this.loadUserOptions();
        this.shareTargets = { users, roles: this.roleOptions };

        const config = this.buildShareConfig(row.id);
        this.shareForm = {
          mode: config.mode,
          expiryDate: config.expiryDate ? this.toDateInputString(config.expiryDate) : "",
          costLimit: null,
        };
        this.selectedUserIds = config.userIds;
        this.selectedRoleIds = config.roleIds;
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
      if (!this.shareForm.expiryDate) {
        this.toastError("Please select an expiry date");
        return;
      }

      const resourceId = this.selectedShareModel.id;
      const expiryDate = this.shareForm.expiryDate;
      let recipients;

      if (this.shareForm.mode === "roles") {
        const roleIds = [...this.selectedRoleIds];
        if (roleIds.length === 0) {
          this.toastError("Please select at least one role");
          return;
        }
        recipients = roleIds.map((roleId) => ({ userId: null, roleId }));
      } else {
        const userIds = [...this.selectedUserIds];
        if (userIds.length === 0) {
          this.toastError("Please select at least one user");
          return;
        }
        recipients = userIds.map((userId) => ({ userId, roleId: null }));
      }

      this.isSavingShare = true;
      try {
        this.$refs.shareStepper.setWaiting(true);

        const sharedIds = [];
        for (const recipient of recipients) {
          const existing = this.findExistingShare(resourceId, recipient);
          const shareId = existing
            ? await this.emitAppDataUpdate(this.shareTable, {
              id: existing.id,
              expiryDate,
              deleted: false,
              deletedAt: null,
            })
            : await this.emitAppDataUpdate(this.shareTable, {
              [this.resourceIdKey]: resourceId,
              userId: recipient.userId,
              roleId: recipient.roleId,
              expiryDate,
            });
          sharedIds.push(shareId);
        }

        // Apply the per-recipient cost limit to every share row created/refreshed in this
        // batch, via the standard appDataUpdate path.
        const costLimitValue = Number(this.shareForm.costLimit);
        const wantsCap = Number.isFinite(costLimitValue) && costLimitValue > 0;
        if (wantsCap) {
          const shareKey = this.resourceIdKey === "aiHookId" ? "aiHookShareId" : "aiModelShareId";
          for (const shareId of sharedIds) {
            const existingCap = this.findExistingShareCap(shareKey, shareId);
            const capData = existingCap
              ? { id: existingCap.id, costLimit: costLimitValue }
              : { [shareKey]: Number(shareId), limitType: 0, costLimit: costLimitValue };
            await this.emitAppDataUpdate("ai_budget", capData);
          }
        }

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
