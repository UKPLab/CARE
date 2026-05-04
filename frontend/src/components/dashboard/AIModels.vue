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

    <BasicModal ref="credentialModal" name="aiCredentialModal">
      <template #title>
        {{ credentialForm.id ? "Edit AI Credential" : "Add AI Credential" }}
      </template>
      <template #body>
        <div class="mb-3">
          <label class="form-label">Credential Name</label>
          <input
            v-model="credentialForm.name"
            type="text"
            class="form-control"
            placeholder="Credential name"
          />
        </div>
        <div class="mb-3">
          <label class="form-label">API Key</label>
          <input
            v-model="credentialForm.apiKey"
            type="password"
            class="form-control"
            :placeholder="credentialForm.id ? 'Leave empty to keep existing key' : 'API key'"
          />
        </div>
        <div class="mb-3">
          <label class="form-label">API Base URL (optional)</label>
          <input
            v-model="credentialForm.apiBaseUrl"
            type="text"
            class="form-control"
            placeholder="Provider base URL"
          />
        </div>
        <div class="mb-3">
          <label class="form-label">API Version (optional)</label>
          <input
            v-model="credentialForm.apiVersion"
            type="text"
            class="form-control"
            placeholder="Version (optional)"
          />
        </div>
        <div class="form-check">
          <input
            id="credentialEnabled"
            v-model="credentialForm.enabled"
            class="form-check-input"
            type="checkbox"
          />
          <label class="form-check-label" for="credentialEnabled">
            Enabled
          </label>
        </div>
      </template>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="$refs.credentialModal.close()">
          Cancel
        </button>
        <button class="btn btn-primary" type="button" @click="saveCredential">
          {{ credentialForm.id ? "Update" : "Create" }}
        </button>
      </template>
    </BasicModal>

    <BasicModal ref="modelModal" name="aiModelModal" size="lg">
      <template #title>
        {{ modelForm.id ? "Edit AI Model" : "Add AI Model" }}
      </template>
      <template #body>
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Name</label>
            <input
              v-model="modelForm.name"
              type="text"
              class="form-control"
            placeholder="Name"
            />
          </div>
          <div class="col-md-6">
            <label class="form-label">Provider</label>
            <input
              v-model="modelForm.provider"
              type="text"
              class="form-control"
            placeholder="Provider name"
            />
          </div>

          <div class="col-md-12">
            <label class="form-label">Credential</label>
            <select
              v-model="modelForm.aiCredentialId"
              class="form-select"
            >
              <option :value="null">Select credential</option>
              <option
                v-for="credential in selectableCredentialRows"
                :key="credential.id"
                :value="credential.id"
              >
                {{ credential.name }}
              </option>
            </select>
          </div>

          <div class="col-md-12">
            <label class="form-label">Model Name</label>
            <input
              v-model="modelForm.model"
              type="text"
              class="form-control"
            placeholder="Model name"
            />
          </div>

          <div class="col-md-12">
            <label class="form-label">Description (optional)</label>
            <textarea
              v-model="modelForm.description"
              class="form-control"
              rows="2"
            />
          </div>

          <div class="col-md-12">
            <label class="form-label">Additional Parameters (JSON, optional)</label>
            <textarea
              v-model="modelForm.additionalParameters"
              class="form-control"
              rows="4"
            placeholder="{}"
            />
          </div>

          <div class="col-md-12">
            <div class="form-check">
              <input
                id="modelEnabled"
                v-model="modelForm.enabled"
                class="form-check-input"
                type="checkbox"
              />
              <label class="form-check-label" for="modelEnabled">
                Enabled
              </label>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="$refs.modelModal.close()">
          Cancel
        </button>
        <button
          class="btn btn-outline-secondary"
          type="button"
          :disabled="isTestingModel"
          @click="testModel"
        >
          {{ isTestingModel ? "Testing..." : "Test Model" }}
        </button>
        <button class="btn btn-primary" type="button" @click="saveModel">
          {{ modelForm.id ? "Update" : "Create" }}
        </button>
      </template>
    </BasicModal>

    <ConfirmModal ref="confirmModal" />
  </div>
</template>

<script>
import BasicCard from "@/basic/dashboard/card/Card.vue";
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";
import BasicModal from "@/basic/Modal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";

export default {
  name: "DashboardAIModels",
  subscribeTable: ["ai_credential", "ai_model"],
  components: {
    BasicCard,
    BasicButton,
    BasicTable,
    BasicModal,
    ConfirmModal,
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
      credentialForm: this.getEmptyCredentialForm(),
      modelForm: this.getEmptyModelForm(),
      isTestingModel: false,
    };
  },
  computed: {
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
    selectableCredentialRows() {
      return this.credentialRows.filter((credential) =>
        credential.enabled || credential.id === this.modelForm.aiCredentialId
      );
    },
    credentialButtons() {
      return [
        {
          icon: "pencil",
          title: "Edit credential",
          action: "editCredential",
          options: { iconOnly: true, specifiers: { "btn-outline-dark": true } },
        },
        {
          icon: "toggle2-on",
          title: "Toggle credential",
          action: "toggleCredential",
          options: { iconOnly: true, specifiers: { "btn-outline-dark": true } },
        },
        {
          icon: "trash",
          title: "Delete credential",
          action: "deleteCredential",
          options: { iconOnly: true, specifiers: { "btn-outline-dark": true } },
        },
      ];
    },
    modelButtons() {
      return [
        {
          icon: "pencil",
          title: "Edit model",
          action: "editModel",
          options: { iconOnly: true, specifiers: { "btn-outline-dark": true } },
        },
        {
          icon: "toggle2-on",
          title: "Toggle model",
          action: "toggleModel",
          options: { iconOnly: true, specifiers: { "btn-outline-dark": true } },
        },
        {
          icon: "trash",
          title: "Delete model",
          action: "deleteModel",
          options: { iconOnly: true, specifiers: { "btn-outline-dark": true } },
        },
      ];
    },
  },
  methods: {
    getEmptyCredentialForm() {
      return {
        id: 0,
        name: "",
        apiKey: "",
        apiBaseUrl: "",
        apiVersion: "",
        enabled: true,
      };
    },
    getEmptyModelForm() {
      return {
        id: 0,
        name: "",
        provider: "",
        model: "",
        aiCredentialId: null,
        description: "",
        enabled: true,
        additionalParameters: "{}",
      };
    },
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
      }
    },
    openCredentialModal(row = null) {
      this.credentialForm = this.getEmptyCredentialForm();
      if (row) {
        this.credentialForm = {
          id: row.id,
          name: row.name || "",
          apiKey: "",
          apiBaseUrl: row.apiBaseUrl === "-" ? "" : (row.apiBaseUrl || ""),
          apiVersion: row.apiVersion === "-" ? "" : (row.apiVersion || ""),
          enabled: !!row.enabled,
        };
      }
      this.$refs.credentialModal.open();
    },
    saveCredential() {
      if (!this.credentialForm.name.trim()) {
        this.toastError("Credential name is required");
        return;
      }
      if (!this.credentialForm.id && !this.credentialForm.apiKey.trim()) {
        this.toastError("API key is required for new credentials");
        return;
      }

      const payload = {
        id: this.credentialForm.id || 0,
        name: this.credentialForm.name.trim(),
        apiBaseUrl: this.credentialForm.apiBaseUrl?.trim() || null,
        apiVersion: this.credentialForm.apiVersion?.trim() || null,
        enabled: !!this.credentialForm.enabled,
      };
      if (this.credentialForm.apiKey?.trim()) {
        payload.apiKey = this.credentialForm.apiKey.trim();
      }

      this.$socket.emit("appDataUpdate", {
        table: "ai_credential",
        data: payload,
      }, (result) => {
        if (result.success) {
          this.$refs.credentialModal.close();
          this.toastSuccess(this.credentialForm.id ? "Credential updated" : "Credential created");
        } else {
          this.toastError(result.message || "Failed to save credential");
        }
      });
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
      this.modelForm = this.getEmptyModelForm();
      if (row) {
        this.modelForm = {
          id: row.id,
          name: row.name || "",
          provider: row.provider || "",
          model: row.model || "",
          aiCredentialId: row.aiCredentialId || null,
          description: row.description || "",
          enabled: !!row.enabled,
          additionalParameters: JSON.stringify(row.additionalParameters || {}, null, 2),
        };
      }
      this.$refs.modelModal.open();
    },
    saveModel() {
      if (!this.modelForm.name.trim()) {
        this.toastError("Model name is required");
        return;
      }
      if (!this.modelForm.provider.trim()) {
        this.toastError("Provider is required");
        return;
      }
      if (!this.modelForm.model.trim()) {
        this.toastError("Model name is required");
        return;
      }
      if (!this.modelForm.aiCredentialId) {
        this.toastError("Credential is required");
        return;
      }

      let additionalParameters = {};
      if (this.modelForm.additionalParameters?.trim()) {
        try {
          additionalParameters = JSON.parse(this.modelForm.additionalParameters);
        } catch (_error) {
          this.toastError("Additional parameters must be valid JSON");
          return;
        }
      }

      const payload = {
        id: this.modelForm.id || 0,
        name: this.modelForm.name.trim(),
        provider: this.modelForm.provider.trim(),
        model: this.modelForm.model.trim(),
        aiCredentialId: this.modelForm.aiCredentialId,
        description: this.modelForm.description?.trim() || null,
        additionalParameters,
        enabled: !!this.modelForm.enabled,
      };

      this.$socket.emit("appDataUpdate", {
        table: "ai_model",
        data: payload,
      }, (result) => {
        if (result.success) {
          this.$refs.modelModal.close();
          this.toastSuccess(this.modelForm.id ? "Model updated" : "Model created");
        } else {
          this.toastError(result.message || "Failed to save model");
        }
      });
    },
    testModel() {
      if (!this.modelForm.model.trim()) {
        this.toastError("Model name is required");
        return;
      }
      if (!this.modelForm.aiCredentialId) {
        this.toastError("Credential is required");
        return;
      }

      let additionalParameters = {};
      if (this.modelForm.additionalParameters?.trim()) {
        try {
          additionalParameters = JSON.parse(this.modelForm.additionalParameters);
        } catch (_error) {
          this.toastError("Additional parameters must be valid JSON");
          return;
        }
      }

      this.isTestingModel = true;
      this.$socket.emit("serviceCommand", {
        service: "AIService",
        command: "testModel",
        data: {
          aiModelId: this.modelForm.id || null,
          credentialId: this.modelForm.aiCredentialId,
          provider: this.modelForm.provider?.trim() || null,
          model: this.modelForm.model.trim(),
          additionalParameters,
        },
      }, (result) => {
        this.isTestingModel = false;
        if (result?.success) {
          const outputText = result.data?.outputText ? String(result.data.outputText) : "";
          this.toastSuccess(outputText ? `Model test successful. Output: ${outputText}` : "Model test successful.");
        } else {
          this.toastError(result?.message || "Model test failed");
        }
      });
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
          this.toastError(result.message || "Failed to update model");
        }
      });
    },
    deleteModel(row) {
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
