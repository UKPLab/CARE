<template>
  <StepperModal
    ref="shareStepper"
    :steps="shareSteps"
    :validation="shareStepValidation"
    :submit-text="$t('ai.common.save')"
    @submit="saveShare"
  >
    <template #title>
      {{ $t("ai.share.title", { resource: resourceLabel }) }}
    </template>
    <template #step-1>
      <AIShareSettingsStep
        v-model:share-form="shareForm"
        :resource-label="resourceLabel"
        :resource-name="selectedShareModel?.name || ''"
        :audience-label="shareAudienceLabel"
      />
    </template>
    <template #step-2>
      <AIShareSelectStep
        :loading="isLoadingShareData"
        :columns="shareSelectionColumns"
        :rows="shareSelectionData"
        :selected-rows="selectedRowsForTable"
        @update:selected-rows="onSelectionRowsUpdate"
      />
    </template>
    <template #step-3>
      <AIShareReviewStep
        :resource-label="resourceLabel"
        :resource-name="selectedShareModel?.name || ''"
        :audience-label="shareAudienceLabel"
        :expiry-date="shareForm.expiryDate"
        :cost-limit="shareForm.costLimit"
        :selected-count="activeSelectionIds.length"
        :columns="shareSelectionColumns"
        :selected-rows="selectedRowsForTable"
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

import StepperModal from "@/basic/modal/StepperModal.vue";
import AIShareSettingsStep from "./AIShareSettingsStep.vue";
import AIShareSelectStep from "./AIShareSelectStep.vue";
import AIShareReviewStep from "./AIShareReviewStep.vue";
import { resolveApiMessage } from "@/assets/utils";

export default {
  name: "AIModelShareStepper",
  subscribeTable: ["ai_budget", "ai_model_share", "ai_hook_share", "user_role", "user"],
  components: {
    StepperModal,
    AIShareSettingsStep,
    AIShareSelectStep,
    AIShareReviewStep,
  },
  props: {
    currentUserId: { type: Number, required: true },
    resourceLabel: { type: String, required: true },
    resourceIdKey: { type: String, required: true },
    shareTable: { type: String, required: true },
  },
  data() {
    return {
      shareForm: this.getEmptyShareForm(),
      shareTargets: { users: [], roles: [] },
      selectedUserIds: [],
      selectedRoleIds: [],
      selectedShareModel: null,
      isLoadingShareData: false,
      isSavingShare: false,
    };
  },
  computed: {
    shareSteps() {
      return [
        { title: this.$t("ai.share.steps.settings") },
        { title: this.$t("ai.share.steps.select", { audience: this.shareAudienceLabel }) },
        { title: this.$t("ai.share.steps.review") },
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
          { name: this.$t("ai.common.role"), key: "label", sortable: true },
          { name: this.$t("ai.share.type"), key: "type", sortable: true },
        ];
      }
      return [
        { name: this.$t("ai.common.name"), key: "label", sortable: true },
        { name: this.$t("ai.share.type"), key: "type", sortable: true },
      ];
    },
    shareSelectionData() {
      if (this.shareForm.mode === "roles") {
        return this.shareTargets.roles.map((role) => ({ ...role, type: this.$t("ai.common.role") }));
      }
      return this.shareTargets.users.map((user) => ({ ...user, type: this.$t("ai.common.user") }));
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
    shareAudienceLabel() {
      if (this.shareForm.mode === "roles") return this.$t("ai.common.roles");
      return this.$t("ai.common.users");
    },
    resourceLabelLower() {
      return this.resourceLabel.toLowerCase();
    },
    roleOptions() {
      return (this.$store.getters["table/user_role/getAll"] || [])
        .filter((role) => !role.deleted)
        .map((role) => ({ id: role.id, label: role.name || this.$t("ai.common.roleNumber", { id: role.id }) }));
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
          else reject(new Error(resolveApiMessage(result, "ai.errors.updateData")));
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
        this.toastError(this.$t("ai.errors.invalidResourceSelected", { resource: this.resourceLabel }));
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
        this.toastError(resolveApiMessage(error, "ai.errors.loadShareData"));
      } finally {
        this.isLoadingShareData = false;
      }
    },
    async saveShare() {
      if (!this.selectedShareModel?.id) {
        this.toastError(this.$t("ai.errors.noResourceSelected", { resource: this.resourceLabel }));
        return;
      }
      if (!this.shareForm.expiryDate) {
        this.toastError(this.$t("ai.errors.selectExpiryDate"));
        return;
      }

      const resourceId = this.selectedShareModel.id;
      const expiryDate = this.shareForm.expiryDate;
      let recipients;

      if (this.shareForm.mode === "roles") {
        const roleIds = [...this.selectedRoleIds];
        if (roleIds.length === 0) {
          this.toastError(this.$t("ai.errors.selectRole"));
          return;
        }
        recipients = roleIds.map((roleId) => ({ userId: null, roleId }));
      } else {
        const userIds = [...this.selectedUserIds];
        if (userIds.length === 0) {
          this.toastError(this.$t("ai.errors.selectUser"));
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
          title: this.$t("ai.common.success"),
          message: this.$t("ai.messages.sharingUpdated", { resource: this.resourceLabel }),
          variant: "success",
        });
      } catch (error) {
        this.toastError(resolveApiMessage(error, "ai.errors.saveSharing"));
      } finally {
        this.$refs.shareStepper.setWaiting(false);
        this.isSavingShare = false;
      }
    },
    toastError(message) {
      this.eventBus.emit("toast", {
        title: this.$t("ai.common.error"),
        message,
        variant: "danger",
      });
    },
  },
};
</script>
