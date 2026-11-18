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
        :mode="shareForm.mode"
        :current-user-id="currentUserId"
        :selected-ids="activeSelectionIds"
        @update:selected-ids="onSelectionIdsUpdate"
      />
    </template>
    <template #step-3>
      <AIShareReviewStep
        :resource-label="resourceLabel"
        :resource-name="selectedShareModel?.name || ''"
        :audience-label="shareAudienceLabel"
        :expiry-date="shareForm.expiryDate"
        :cost-limit="shareForm.costLimit"
        :mode="shareForm.mode"
        :current-user-id="currentUserId"
        :selected-ids="activeSelectionIds"
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
    activeSelectionIds() {
      if (this.shareForm.mode === "roles") {
        return this.selectedRoleIds;
      }
      return this.selectedUserIds;
    },
    shareAudienceLabel() {
      if (this.shareForm.mode === "roles") return this.$t("ai.common.roles");
      return this.$t("ai.common.users");
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
    onSelectionIdsUpdate(ids) {
      if (this.shareForm.mode === "roles") {
        this.selectedRoleIds = ids;
      } else {
        this.selectedUserIds = ids;
      }
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
    shareCapKey() {
      return this.resourceIdKey === "aiHookId" ? "aiHookShareId" : "aiModelShareId";
    },
    findExistingResourceShareCap(resourceId) {
      const shares = this.getShareRows((share) =>
        Number(share[this.resourceIdKey]) === Number(resourceId) && !share.deleted
      );
      const shareKey = this.shareCapKey();
      for (const share of shares) {
        const cap = this.findExistingShareCap(shareKey, share.id);
        const value = cap ? Number(cap.costLimit) : NaN;
        if (Number.isFinite(value)) return value;
      }
      return null;
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
        const config = this.buildShareConfig(row.id);
        this.shareForm = {
          mode: config.mode,
          expiryDate: config.expiryDate ? this.toDateInputString(config.expiryDate) : "",
          costLimit: this.findExistingResourceShareCap(row.id),
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

        // Apply or clear the per-recipient cap on every share in this batch.
        const costLimitValue = Number(this.shareForm.costLimit);
        const wantsCap = Number.isFinite(costLimitValue) && costLimitValue > 0;
        const shareKey = this.shareCapKey();
        for (const shareId of sharedIds) {
          const existingCap = this.findExistingShareCap(shareKey, shareId);
          if (wantsCap) {
            const capData = existingCap
              ? { id: existingCap.id, costLimit: costLimitValue }
              : { [shareKey]: Number(shareId), limitType: 0, costLimit: costLimitValue };
            await this.emitAppDataUpdate("ai_budget", capData);
          } else if (existingCap) {
            await this.emitAppDataUpdate("ai_budget", { id: existingCap.id, deleted: true });
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
