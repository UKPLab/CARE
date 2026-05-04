<template>
  <div>
    <BasicCard title="AI Credentials" class="mb-3">
      <template #headerElements>
        <BasicButton
          class="btn-primary btn-sm"
          title="Add AI credential"
          icon="plus"
          text="Add Credential"
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

    <BasicCard title="AI Models">
      <template #headerElements>
        <BasicButton
          class="btn-primary btn-sm"
          title="Add AI model"
          icon="plus"
          text="Add Model"
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
      :current-user-id="currentUserId"
      :credential-rows="credentialRows"
    />

    <AIModelShareStepper
      ref="shareModelStepper"
      :current-user-id="currentUserId"
    />

    <ConfirmModal ref="confirmModal" />
  </div>
</template>

<script>
import BasicCard from "@/basic/dashboard/card/Card.vue";
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import AICredential from "@/components/dashboard/ai-models/AICredential.vue";
import AIModel from "@/components/dashboard/ai-models/AIModel.vue";
import AIModelShareStepper from "@/components/dashboard/ai-models/AIModelShareStepper.vue";

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
  },
  data() {
    return {
      tableOptions: {
        striped: true,
        hover: true,
        pagination: 10,
      },
      credentialColumns: [
        { name: "Name", key: "name", sortable: true },
        { name: "Status", key: "status", type: "badge" },
        { name: "Base URL", key: "apiBaseUrl", sortable: true },
        { name: "Version", key: "apiVersion", sortable: true },
        { name: "Models", key: "modelCount", type: "badge" },
        { name: "Created", key: "createdAt", type: "datetime", sortable: true },
      ],
      modelColumns: [
        { name: "Name", key: "name", sortable: true },
        { name: "Provider", key: "provider", sortable: true },
        { name: "Model ID", key: "model", sortable: true },
        { name: "Credential", key: "credentialName", sortable: true },
        { name: "Status", key: "status", type: "badge" },
        { name: "Updated", key: "updatedAt", type: "datetime", sortable: true },
      ],
    };
  },
  computed: {
    currentUserId() {
      return this.$store.getters["auth/getUserId"];
    },
    credentials() {
      return this.$store.getters["table/ai_credential/getAll"] || [];
    },
    models() {
      return this.$store.getters["table/ai_model/getAll"] || [];
    },
    credentialRows() {
      return this.credentials.map((credential) => ({
        ...credential,
        apiBaseUrl: credential.apiBaseUrl || "-",
        apiVersion: credential.apiVersion || "-",
        status: {
          text: credential.enabled ? "Enabled" : "Disabled",
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
        acc[credential.id] = credential.name;
        return acc;
      }, {});

      return this.models.map((model) => ({
        ...model,
        credentialName: model.aiCredentialId ? (credentialsById[model.aiCredentialId] || "Unknown") : "None",
        status: {
          text: model.enabled ? "Enabled" : "Disabled",
          class: model.enabled ? "bg-success" : "bg-secondary",
        },
      }));
    },
    credentialButtons() {
      return [
        {
          icon: "pencil",
          title: "Edit credential",
          action: "editCredential",
          options: { iconOnly: true, specifiers: { "btn-outline-secondary": true } },
        },
        {
          icon: "toggle2-on",
          title: "Disable credential",
          action: "toggleCredential",
          filter: [{ key: "enabled", value: true }],
          options: { iconOnly: true, specifiers: { "btn-outline-success": true } },
        },
        {
          icon: "toggle2-off",
          title: "Enable credential",
          action: "toggleCredential",
          filter: [{ key: "enabled", value: false }],
          options: { iconOnly: true, specifiers: { "btn-outline-warning": true } },
        },
        {
          icon: "trash",
          title: "Delete credential",
          action: "deleteCredential",
          options: { iconOnly: true, specifiers: { "btn-outline-danger": true } },
        },
      ];
    },
    modelButtons() {
      return [
        {
          icon: "pencil",
          title: "Edit model",
          action: "editModel",
          filter: [{ key: "userId", value: this.currentUserId }],
          options: { iconOnly: true, specifiers: { "btn-outline-secondary": true } },
        },
        {
          icon: "toggle2-on",
          title: "Disable model",
          action: "toggleModel",
          filter: [{ key: "enabled", value: true }, { key: "userId", value: this.currentUserId }],
          filterMode: "and",
          options: { iconOnly: true, specifiers: { "btn-outline-success": true } },
        },
        {
          icon: "toggle2-off",
          title: "Enable model",
          action: "toggleModel",
          filter: [{ key: "enabled", value: false }, { key: "userId", value: this.currentUserId }],
          filterMode: "and",
          options: { iconOnly: true, specifiers: { "btn-outline-warning": true } },
        },
        {
          icon: "share",
          title: "Share model",
          action: "shareModel",
          filter: [{ key: "userId", value: this.currentUserId }],
          options: { iconOnly: true, specifiers: { "btn-outline-primary": true } },
        },
        {
          icon: "trash",
          title: "Delete model",
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
          this.toastError(result.message || "Failed to update credential");
        }
      });
    },
    deleteCredential(row) {
      this.$refs.confirmModal.open(
        "Delete Credential",
        `Delete credential "${row.name}"? Models linked to it will keep existing values, but cannot use this credential anymore.`,
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
              this.toastSuccess("Credential deleted");
            } else {
              this.toastError(result.message || "Failed to delete credential");
            }
          });
        }
      );
    },
    openModelModal(row = null) {
      this.$refs.aiModel.open(row);
    },
    toggleModel(row) {
      if (Number(row.userId) !== Number(this.currentUserId)) {
        this.toastError("Only model owners can update this model");
        return;
      }
      this.$socket.emit("appDataUpdate", {
        table: "ai_model",
        data: {
          id: row.id,
          enabled: !row.enabled,
        },
      }, (result) => {
        if (!result.success) {
          this.toastError(result.message || "Failed to update model");
        }
      });
    },
    deleteModel(row) {
      if (Number(row.userId) !== Number(this.currentUserId)) {
        this.toastError("Only model owners can delete this model");
        return;
      }
      this.$refs.confirmModal.open(
        "Delete Model",
        `Delete model "${row.name}"?`,
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
              this.toastSuccess("Model deleted");
            } else {
              this.toastError(result.message || "Failed to delete model");
            }
          });
        }
      );
    },
    toastSuccess(message) {
      this.eventBus.emit("toast", {
        title: "Success",
        message,
        variant: "success",
      });
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
