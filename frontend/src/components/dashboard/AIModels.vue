<template>
  <div>
    <AICredentialList class="mb-3" />

    <DashboardListPage
      :title="$t('ai.models.modelsTitle')"
      :empty-action="emptyModelAction"
      :columns="modelColumns"
      :data="modelRows"
      :buttons="modelButtons"
      @action="onModelAction"
    >
      <template #headerActions>
        <BasicButton
          class="btn-primary btn-sm"
          :title="$t('ai.models.addModelTitle')"
          icon="plus"
          :text="$t('ai.models.addModel')"
          @click="openModelModal()"
        />
      </template>
    </DashboardListPage>

    <AIModel
      ref="aiModel"
      :credential-rows="credentials"
    />

    <AIModelShareStepper
      ref="shareModelStepper"
      :current-user-id="currentUserId"
      :resource-label="$t('ai.resources.model')"
      resource-id-key="aiModelId"
      share-table="ai_model_share"
    />

    <AIOverview ref="aiOverview" />

    <ConfirmModal ref="confirmModal" />
  </div>
</template>

<script>
/**
 * Coordinates credential and model dashboards, modals, sharing flows, and destructive confirmations.
 *
 * @author Akash Gundapuneni
 */

import DashboardListPage from "@/basic/dashboard/ListPage.vue";
import BasicButton from "@/basic/Button.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import AICredentialList from "@/components/dashboard/ai/AICredentialList.vue";
import AIModel from "@/components/dashboard/ai/AIModel.vue";
import AIModelShareStepper from "@/components/dashboard/ai/share/AIModelShareStepper.vue";
import AIOverview from "@/components/dashboard/ai/AIOverview.vue";
import { resolveApiMessage } from "@/assets/utils";
import { dashboardRowAction, dashboardRowButton } from "@/basic/dashboard/actions.js";

export default {
  name: "DashboardAIModels",
  subscribeTable: ["ai_credential", "ai_model"],
  components: {
    DashboardListPage,
    BasicButton,
    ConfirmModal,
    AICredentialList,
    AIModel,
    AIModelShareStepper,
    AIOverview,
  },
  computed: {
    /** Same as the header create button; offered while the table is empty. */
    emptyModelAction() {
      return {
        label: this.$t('ai.models.addModel'),
        icon: "plus-lg",
        handler: () => this.openModelModal(),
      };
    },
    modelColumns() {
      return [
        { name: this.$t("ai.common.name"), key: "name", sortable: true },
        { name: this.$t("ai.common.provider"), key: "provider", sortable: true },
        { name: this.$t("ai.models.modelId"), key: "model", sortable: true },
        { name: this.$t("ai.common.credential"), key: "credentialName", sortable: true },
        { name: this.$t("ai.common.sharedBy"), key: "sharedBy", sortable: true },
        { name: this.$t("ai.common.status"), key: "status", type: "badge" },
        { name: this.$t("ai.common.created"), key: "createdAt", type: "datetime", sortable: true },
      ];
    },
    currentUserId() {
      return this.$store.getters["auth/getUserId"];
    },
    credentials() {
      return this.$store.getters["table/ai_credential/getAll"] || [];
    },
    models() {
      return this.$store.getters["table/ai_model/getAll"] || [];
    },
    ownerLabelsByUserId() {
      const users = this.$store.getters["table/user/getAll"] || [];
      return users.reduce((acc, user) => {
        const label = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.userName;
        if (label) {
          acc[String(user.id)] = label;
        }
        return acc;
      }, {});
    },
    modelRows() {
      const credentialsById = this.credentials.reduce((acc, credential) => {
        acc[credential.id] = credential;
        return acc;
      }, {});
      const me = Number(this.currentUserId);

      return this.models.map((model) => {
        const ownerId = Number(model.userId);
        const sharedBy =
          ownerId === me ? "—" : (this.ownerLabelsByUserId[String(ownerId)] || "—");

        return {
          ...model,
          provider: credentialsById[model.aiCredentialId]?.provider || "",
          credentialName: model.aiCredentialId ? (credentialsById[model.aiCredentialId]?.name || this.$t("ai.common.unknown")) : this.$t("ai.common.none"),
          sharedBy,
          status: {
            text: model.enabled ? this.$t("ai.status.enabled") : this.$t("ai.status.disabled"),
            class: model.enabled ? "bg-success" : "bg-secondary",
          },
        };
      });
    },
    modelButtons() {
      return [
        dashboardRowAction("edit", {
          title: this.$t("ai.actions.editModel"),
          action: "editModel",
          filter: [{ key: "userId", value: this.currentUserId }],
        }),
        dashboardRowButton("info-circle", {
          title: this.$t("ai.actions.modelOverview"),
          action: "modelOverview",
        }),
        dashboardRowButton("toggle2-on", {
          title: this.$t("ai.actions.disableModel"),
          action: "toggleModel",
          filter: [{ key: "enabled", value: true }, { key: "userId", value: this.currentUserId }],
          filterMode: "and",
        }),
        dashboardRowButton("toggle2-off", {
          title: this.$t("ai.actions.enableModel"),
          action: "toggleModel",
          filter: [{ key: "enabled", value: false }, { key: "userId", value: this.currentUserId }],
          filterMode: "and",
        }, "warning"),
        dashboardRowAction("share", {
          title: this.$t("ai.actions.shareModel"),
          action: "shareModel",
          filter: [{ key: "userId", value: this.currentUserId }],
        }),
        dashboardRowAction("delete", {
          title: this.$t("ai.actions.deleteModel"),
          action: "deleteModel",
          filter: [{ key: "userId", value: this.currentUserId }],
        }),
      ];
    },
  },
  methods: {
    onModelAction(data) {
      switch (data.action) {
        case "modelOverview":
          this.$refs.aiOverview.open(data.params);
          break;
        case "editModel":
          this.openModelModal(data.params);
          break;
        case "toggleModel":
          this.toggleModel(data.params);
          break;
        case "deleteModel":
          this.deleteModel(data.params);
          break;
        case "shareModel":
          this.$refs.shareModelStepper.open(data.params);
          break;
      }
    },
    openModelModal(row = null) {
      this.$refs.aiModel.open(row);
    },
    toggleModel(row) {
      this.$socket.emit("appDataUpdate", {
        table: "ai_model",
        data: {
          id: row.id,
          enabled: !row.enabled,
        },
      }, (result) => {
        if (!result.success) {
          this.toastError(resolveApiMessage(result, "ai.errors.updateModel"));
        }
      });
    },
    deleteModel(row) {
      this.$refs.confirmModal.open(
        this.$t("ai.confirm.deleteModelTitle"),
        this.$t("ai.confirm.deleteModel", { name: row.name }),
        "",
        (confirmed) => {
          if (!confirmed) return;
          this.$socket.emit("appDataUpdate", {
            table: "ai_model",
            data: {
              id: row.id,
              deleted: true,
            },
          }, (result) => {
            if (result.success) {
              this.toastSuccess(this.$t("ai.messages.modelDeleted"));
            } else {
              this.toastError(resolveApiMessage(result, "ai.errors.deleteModel"));
            }
          });
        }
      );
    },
    toastSuccess(message) {
      this.eventBus.emit("toast", {
        title: this.$t("ai.common.success"),
        message,
        variant: "success",
      });
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
