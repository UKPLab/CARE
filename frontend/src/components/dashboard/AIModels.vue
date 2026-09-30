<template>
  <div>
    <BasicCard :title="$t('ai.models.credentialsTitle')" class="mb-3">
      <template #headerElements>
        <BasicButton
          class="btn-primary btn-sm"
          :title="$t('ai.models.addCredentialTitle')"
          icon="plus"
          :text="$t('ai.models.addCredential')"
          @click="openCredentialModal()"
        />
      </template>
      <template #body>
        <BasicTable
          :columns="credentialColumns"
          :data="credentialRows"
          :options="tableOptions"
          :buttons="credentialButtons"
          @action="onCredentialAction"
        />
      </template>
    </BasicCard>

    <BasicCard :title="$t('ai.models.modelsTitle')">
      <template #headerElements>
        <BasicButton
          class="btn-primary btn-sm"
          :title="$t('ai.models.addModelTitle')"
          icon="plus"
          :text="$t('ai.models.addModel')"
          @click="openModelModal()"
        />
      </template>
      <template #body>
        <BasicTable
          :columns="modelColumns"
          :data="modelRows"
          :options="tableOptions"
          :buttons="modelButtons"
          @action="onModelAction"
        />
      </template>
    </BasicCard>

    <AICredential ref="aiCredential" />

    <AIModel
      ref="aiModel"
      :credential-rows="credentialRows"
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

import BasicCard from "@/basic/dashboard/card/Card.vue";
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import AICredential from "@/components/dashboard/ai/AICredential.vue";
import AIModel from "@/components/dashboard/ai/AIModel.vue";
import AIModelShareStepper from "@/components/dashboard/ai/share/AIModelShareStepper.vue";
import AIOverview from "@/components/dashboard/ai/AIOverview.vue";
import { resolveApiMessage } from "@/assets/utils";

export default {
  name: "DashboardAIModels",
  subscribeTable: ["ai_credential", "ai_model"],
  components: {
    BasicCard,
    BasicButton,
    BasicTable,
    ConfirmModal,
    AICredential,
    AIModel,
    AIModelShareStepper,
    AIOverview,
  },
  data() {
    return {
      tableOptions: {
        striped: true,
        hover: true,
        pagination: 10,
      },
    };
  },
  computed: {
    credentialColumns() {
      return [
        { name: this.$t("ai.common.name"), key: "name", sortable: true },
        { name: this.$t("ai.common.provider"), key: "provider", sortable: true },
        { name: this.$t("ai.models.baseUrl"), key: "apiBaseUrl", sortable: true },
        { name: this.$t("ai.models.version"), key: "apiVersion", sortable: true },
        { name: this.$t("ai.common.models"), key: "modelCount", type: "badge" },
        { name: this.$t("ai.common.status"), key: "status", type: "badge" },
        { name: this.$t("ai.common.created"), key: "createdAt", type: "datetime", sortable: true },
      ];
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
    credentialRows() {
      return this.credentials.map((credential) => ({
        ...credential,
        status: {
          text: credential.enabled ? this.$t("ai.status.enabled") : this.$t("ai.status.disabled"),
          class: credential.enabled ? "bg-success" : "bg-secondary",
        },
        modelCount: {
          text: String(this.models.filter((m) => m.aiCredentialId === credential.id).length),
          class: "bg-primary",
        },
      }));
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
    credentialButtons() {
      return [
        {
          icon: "pencil",
          title: this.$t("ai.actions.editCredential"),
          action: "editCredential",
          options: { iconOnly: true, specifiers: { "btn-outline-secondary": true } },
        },
        {
          icon: "toggle2-on",
          title: this.$t("ai.actions.disableCredential"),
          action: "toggleCredential",
          filter: [{ key: "enabled", value: true }],
          options: { iconOnly: true, specifiers: { "btn-outline-success": true } },
        },
        {
          icon: "toggle2-off",
          title: this.$t("ai.actions.enableCredential"),
          action: "toggleCredential",
          filter: [{ key: "enabled", value: false }],
          options: { iconOnly: true, specifiers: { "btn-outline-warning": true } },
        },
        {
          icon: "trash",
          title: this.$t("ai.actions.deleteCredential"),
          action: "deleteCredential",
          options: { iconOnly: true, specifiers: { "btn-outline-danger": true } },
        },
      ];
    },
    modelButtons() {
      return [
        {
          icon: "pencil",
          title: this.$t("ai.actions.editModel"),
          action: "editModel",
          filter: [{ key: "userId", value: this.currentUserId }],
          options: { iconOnly: true, specifiers: { "btn-outline-secondary": true } },
        },
        {
          icon: "info-circle",
          title: this.$t("ai.actions.modelOverview"),
          action: "modelOverview",
          options: { iconOnly: true, specifiers: { "btn-outline-info": true } },
        },
        {
          icon: "toggle2-on",
          title: this.$t("ai.actions.disableModel"),
          action: "toggleModel",
          filter: [{ key: "enabled", value: true }, { key: "userId", value: this.currentUserId }],
          filterMode: "and",
          options: { iconOnly: true, specifiers: { "btn-outline-success": true } },
        },
        {
          icon: "toggle2-off",
          title: this.$t("ai.actions.enableModel"),
          action: "toggleModel",
          filter: [{ key: "enabled", value: false }, { key: "userId", value: this.currentUserId }],
          filterMode: "and",
          options: { iconOnly: true, specifiers: { "btn-outline-warning": true } },
        },
        {
          icon: "share",
          title: this.$t("ai.actions.shareModel"),
          action: "shareModel",
          filter: [{ key: "userId", value: this.currentUserId }],
          options: { iconOnly: true, specifiers: { "btn-outline-primary": true } },
        },
        {
          icon: "trash",
          title: this.$t("ai.actions.deleteModel"),
          action: "deleteModel",
          filter: [{ key: "userId", value: this.currentUserId }],
          options: { iconOnly: true, specifiers: { "btn-outline-danger": true } },
        },
      ];
    },
  },
  methods: {
    onCredentialAction(data) {
      switch (data.action) {
        case "editCredential":
          this.openCredentialModal(data.params);
          break;
        case "toggleCredential":
          this.toggleCredential(data.params);
          break;
        case "deleteCredential":
          this.deleteCredential(data.params);
          break;
      }
    },
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
    openCredentialModal(row = null) {
      this.$refs.aiCredential.open(row);
    },
    toggleCredential(row) {
      this.$socket.emit("appDataUpdate", {
        table: "ai_credential",
        data: {
          id: row.id,
          enabled: !row.enabled,
        },
      }, (result) => {
        if (!result.success) {
          this.toastError(resolveApiMessage(result, "ai.errors.updateCredential"));
        }
      });
    },
    deleteCredential(row) {
      this.$refs.confirmModal.open(
        this.$t("ai.confirm.deleteCredentialTitle"),
        this.$t("ai.confirm.deleteCredential", { name: row.name }),
        "",
        (confirmed) => {
          if (!confirmed) return;
          this.$socket.emit("appDataUpdate", {
            table: "ai_credential",
            data: {
              id: row.id,
              deleted: true,
            },
          }, (result) => {
            if (result.success) {
              this.toastSuccess(this.$t("ai.messages.credentialDeleted"));
            } else {
              this.toastError(resolveApiMessage(result, "ai.errors.deleteCredential"));
            }
          });
        }
      );
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
