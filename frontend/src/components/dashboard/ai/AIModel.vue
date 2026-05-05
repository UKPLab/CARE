<template>
  <BasicModal ref="modelModal" name="aiModelModal" size="lg">
    <template #title>
      {{ modelForm.id ? "Edit AI Model" : "Add AI Model" }}
    </template>
    <template #body>
      <div class="row g-3">
        <div class="col-md-12">
          <label class="form-label">Name</label>
          <input
            v-model="modelForm.name"
            type="text"
            class="form-control"
            placeholder="Name"
          />
        </div>

        <div class="col-md-12">
          <label class="form-label">Credential</label>
          <select
            v-model="modelForm.aiCredentialId"
            class="form-select"
            @change="clearModelOptions"
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
          <div class="d-flex justify-content-between align-items-center mb-1">
            <label class="form-label mb-0">Model Name</label>
            <button
              class="btn btn-outline-secondary btn-sm"
              type="button"
              :disabled="!canLoadModelOptions || isLoadingModels"
              @click="loadModelOptions"
            >
              {{ isLoadingModels ? "Loading..." : "Load Models" }}
            </button>
          </div>
          <select
            v-if="modelOptionValues.length"
            v-model="modelForm.model"
            class="form-select"
          >
            <option value="">Select model</option>
            <option
              v-for="model in modelOptionValues"
              :key="model"
              :value="model"
            >
              {{ model }}
            </option>
          </select>
          <input
            v-else
            v-model="modelForm.model"
            type="text"
            class="form-control"
            placeholder="Model name"
          />
          <small v-if="modelLookupError" class="text-danger">{{ modelLookupError }}</small>
          <small v-else class="text-muted">
            Select a credential, then load models from LiteLLM.
          </small>
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
</template>

<script>
import BasicModal from "@/basic/Modal.vue";

function getEmptyModelForm() {
  return {
    id: 0,
    name: "",
    model: "",
    aiCredentialId: null,
    description: "",
    enabled: true,
    additionalParameters: "{}",
  };
}

export default {
  name: "AIModel",
  components: { BasicModal },
  props: {
    currentUserId: {
      type: Number,
      required: true,
    },
    credentialRows: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      modelForm: getEmptyModelForm(),
      isTestingModel: false,
      isLoadingModels: false,
      modelOptions: [],
      modelLookupError: "",
    };
  },
  computed: {
    selectableCredentialRows() {
      return this.credentialRows.filter((credential) =>
        credential.enabled || credential.id === this.modelForm.aiCredentialId
      );
    },
    canLoadModelOptions() {
      return !!this.modelForm.aiCredentialId;
    },
    modelOptionValues() {
      if (this.modelOptions.length === 0) {
        return [];
      }
      const options = new Set(this.modelOptions);
      if (this.modelForm.model?.trim()) {
        options.add(this.modelForm.model.trim());
      }
      return [...options].sort((a, b) => a.localeCompare(b));
    },
  },
  methods: {
    open(row = null) {
      this.modelForm = getEmptyModelForm();
      this.clearModelOptions();
      if (row) {
        if (Number(row.userId) !== Number(this.currentUserId)) {
          this.toastError("Only model owners can edit this model");
          return;
        }
        this.modelForm = {
          id: row.id,
          name: row.name || "",
          model: row.model || "",
          aiCredentialId: row.aiCredentialId || null,
          description: row.description || "",
          enabled: !!row.enabled,
          additionalParameters: JSON.stringify(row.additionalParameters || {}, null, 2),
        };
      }
      this.$refs.modelModal.open();
    },
    clearModelOptions() {
      this.modelOptions = [];
      this.modelLookupError = "";
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
    async loadModelOptions() {
      if (!this.modelForm.aiCredentialId) {
        this.toastError("Credential is required");
        return;
      }

      this.isLoadingModels = true;
      this.modelLookupError = "";
      try {
        const result = await this.emitAiServiceCommand("getValidModels", {
          credentialId: this.modelForm.aiCredentialId,
        });
        this.modelOptions = Array.isArray(result?.models) ? result.models : [];
        if (this.modelOptions.length === 0) {
          this.modelLookupError = "No models were returned for this credential.";
        }
      } catch (error) {
        this.modelOptions = [];
        this.modelLookupError = error.message || "Failed to load models";
        this.toastError(this.modelLookupError);
      } finally {
        this.isLoadingModels = false;
      }
    },
    saveModel() {
      if (!this.modelForm.name.trim()) {
        this.toastError("Model name is required");
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
