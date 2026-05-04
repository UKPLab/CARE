<template>
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
</template>

<script>
import BasicModal from "@/basic/Modal.vue";

function getEmptyModelForm() {
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
  emits: ["saved"],
  data() {
    return {
      modelForm: getEmptyModelForm(),
      isTestingModel: false,
    };
  },
  computed: {
    selectableCredentialRows() {
      return this.credentialRows.filter((credential) =>
        credential.enabled || credential.id === this.modelForm.aiCredentialId
      );
    },
  },
  methods: {
    open(row = null) {
      this.modelForm = getEmptyModelForm();
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
          this.$emit("saved");
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
