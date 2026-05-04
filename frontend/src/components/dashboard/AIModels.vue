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

    <StepperModal
      ref="shareStepper"
      :steps="shareSteps"
      :validation="shareStepValidation"
      submit-text="Save"
      @submit="saveShare"
    >
      <template #title>
        Share AI Model
      </template>
      <template #step-1>
        <div v-if="selectedShareModel" class="mb-3">
          <strong>Model:</strong> {{ selectedShareModel.name }}
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
          <div class="form-check form-check-inline">
            <input id="shareByStudy" v-model="shareForm.mode" class="form-check-input" type="radio" value="study" />
            <label class="form-check-label" for="shareByStudy">Study</label>
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
        <div v-if="isLoadingShareData" class="text-muted mb-2">
          Loading share options...
        </div>
        <BasicTable
          v-else-if="shareForm.mode === 'users'"
          v-model="shareSelections.users"
          :columns="shareSelectionColumns"
          :data="shareSelectionData"
          :options="shareSelectionTableOptions"
          :max-table-height="360"
        />
        <BasicTable
          v-else-if="shareForm.mode === 'roles'"
          v-model="shareSelections.roles"
          :columns="shareSelectionColumns"
          :data="shareSelectionData"
          :options="shareSelectionTableOptions"
          :max-table-height="360"
        />
        <BasicTable
          v-else
          v-model="shareSelections.studies"
          :columns="shareSelectionColumns"
          :data="shareSelectionData"
          :options="shareStudyTableOptions"
          :max-table-height="360"
        />
      </template>
      <template #step-2>
        <div class="mb-3">
          <div><strong>Model:</strong> {{ selectedShareModel?.name || "-" }}</div>
          <div><strong>Audience Type:</strong> {{ shareAudienceLabel }}</div>
          <div><strong>Selected:</strong> {{ activeShareSelections.length }}</div>
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

    <ConfirmModal ref="confirmModal" />
  </div>
</template>

<script>
import BasicCard from "@/basic/dashboard/card/Card.vue";
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";
import BasicModal from "@/basic/Modal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import StepperModal from "@/basic/modal/StepperModal.vue";

export default {
  name: "DashboardAIModels",
  subscribeTable: ["ai_credential", "ai_model"],
  components: {
    BasicCard,
    BasicButton,
    BasicTable,
    BasicModal,
    ConfirmModal,
    StepperModal,
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
      shareForm: this.getEmptyShareForm(),
      shareTargets: {
        users: [],
        roles: [],
        studies: [],
      },
      shareSelections: {
        users: [],
        roles: [],
        studies: [],
      },
      shareSelectionTableOptions: {
        striped: true,
        hover: true,
        pagination: 10,
        selectableRows: true,
        search: true,
      },
      shareStudyTableOptions: {
        striped: true,
        hover: true,
        pagination: 10,
        selectableRows: true,
        singleSelect: true,
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
      isTestingModel: false,
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
    shareSteps() {
      return [
        { title: "Select Audience" },
        { title: "Review & Send" },
      ];
    },
    shareStepValidation() {
      return [
        !this.isLoadingShareData && this.activeShareSelections.length > 0 && !!this.shareForm.expiryDate,
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
      if (this.shareForm.mode === "study") {
        return [
          { name: "Study", key: "label", sortable: true },
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
      if (this.shareForm.mode === "study") {
        return this.shareTargets.studies.map((study) => ({ ...study, type: "Study" }));
      }
      return this.shareTargets.users.map((user) => ({ ...user, type: "User" }));
    },
    activeShareSelections() {
      if (this.shareForm.mode === "roles") {
        return this.shareSelections.roles;
      }
      if (this.shareForm.mode === "study") {
        return this.shareSelections.studies;
      }
      return this.shareSelections.users;
    },
    shareAudienceLabel() {
      if (this.shareForm.mode === "roles") return "Roles";
      if (this.shareForm.mode === "study") return "Study";
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
        case "shareModel":
          this.openShareModal(data.params);
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
        if (Number(row.userId) !== Number(this.currentUserId)) {
          this.toastError("Only model owners can edit this model");
          return;
        }
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
    getShareTargetByIds(targets, ids) {
      const idSet = new Set((ids || []).map((id) => Number(id)));
      return (targets || []).filter((entry) => idSet.has(Number(entry.id)));
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
    async openShareModal(row) {
      if (!row?.id) {
        this.toastError("Invalid model selected");
        return;
      }
      if (Number(row.userId) !== Number(this.currentUserId)) {
        this.toastError("Only model owners can manage sharing");
        return;
      }

      this.selectedShareModel = row;
      this.shareForm = this.getEmptyShareForm();
      this.shareSelections = {
        users: [],
        roles: [],
        studies: [],
      };
      this.isLoadingShareData = true;
      this.$refs.shareStepper.open();

      try {
        const [targets, shareConfig] = await Promise.all([
          this.emitAiServiceCommand("getModelShareOptions"),
          this.emitAiServiceCommand("getModelShareConfig", { aiModelId: row.id }),
        ]);

        this.shareTargets = {
          users: Array.isArray(targets?.users) ? targets.users : [],
          roles: Array.isArray(targets?.roles) ? targets.roles : [],
          studies: Array.isArray(targets?.studies) ? targets.studies : [],
        };
        this.shareForm = {
          mode: ["users", "roles", "study"].includes(shareConfig?.mode) ? shareConfig.mode : "users",
          expiryDate: shareConfig?.expiryDate ? this.toDateInputString(shareConfig.expiryDate) : "",
        };
        this.shareSelections.users = this.getShareTargetByIds(this.shareTargets.users, shareConfig?.userIds || []);
        this.shareSelections.roles = this.getShareTargetByIds(this.shareTargets.roles, shareConfig?.roleIds || []);
        this.shareSelections.studies = this.getShareTargetByIds(this.shareTargets.studies, shareConfig?.studyId ? [shareConfig.studyId] : []);
      } catch (error) {
        this.toastError(error.message || "Failed to load share data");
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
        aiModelId: this.selectedShareModel.id,
        mode: this.shareForm.mode,
        expiryDate: this.shareForm.expiryDate,
      };
      if (!this.shareForm.expiryDate) {
        this.toastError("Please select an expiry date");
        return;
      }
      if (this.shareForm.mode === "study") {
        const studyId = this.shareSelections.studies?.[0]?.id;
        if (!studyId) {
          this.toastError("Please select a study");
          return;
        }
        payload.studyId = studyId;
      } else if (this.shareForm.mode === "roles") {
        const roleIds = (this.shareSelections.roles || []).map((role) => role.id);
        if (roleIds.length === 0) {
          this.toastError("Please select at least one role");
          return;
        }
        payload.roleIds = roleIds;
      } else {
        const userIds = (this.shareSelections.users || []).map((user) => user.id);
        if (userIds.length === 0) {
          this.toastError("Please select at least one user");
          return;
        }
        payload.userIds = userIds;
      }

      this.isSavingShare = true;
      try {
        this.$refs.shareStepper.setWaiting(true);
        await this.emitAiServiceCommand("shareModel", payload);
        this.$refs.shareStepper.close();
        this.toastSuccess("Model sharing updated");
      } catch (error) {
        this.toastError(error.message || "Failed to save model sharing");
      } finally {
        this.$refs.shareStepper.setWaiting(false);
        this.isSavingShare = false;
      }
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
