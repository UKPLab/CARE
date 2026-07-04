<template>
  <BasicModal ref="credentialModal" name="aiCredentialModal">
    <template #title>
      {{ credentialForm.id ? "Edit AI Credential" : "Add AI Credential" }}
    </template>
    <template #body>
      <div class="mb-3">
        <label class="form-label">
          Credential Name
          <i
            class="bi bi-info-circle text-muted ms-1"
            title="A display name for your API credential."
          />
        </label>
        <input
          v-model="credentialForm.name"
          type="text"
          class="form-control"
          placeholder="Credential name"
        />
      </div>
      <div class="mb-3">
        <label class="form-label">
          API Key
          <i
            class="bi bi-info-circle text-muted ms-1"
            title="Enter your API key. Leave empty while editing to keep the existing key."
          />
        </label>
        <input
          v-model="credentialForm.apiKey"
          type="password"
          class="form-control"
          :placeholder="credentialForm.id ? 'Leave empty to keep existing key' : 'API key'"
        />
      </div>
      <div class="mb-3">
        <label class="form-label">
          Provider
          <i
            class="bi bi-info-circle text-muted ms-1"
            title="Enter the provider name from where you got your API key from, e.g. openai, anthropic, gemini."
          />
        </label>
        <input
          v-model="credentialForm.provider"
          type="text"
          class="form-control"
          placeholder="Provider name, e.g. openai, anthropic, gemini"
        />
        <small class="text-muted">
          Required for loading available models from provider endpoints.
        </small>
      </div>
      <div class="mb-3">
        <label class="form-label">
          API Base URL (optional)
          <i
            class="bi bi-info-circle text-muted ms-1"
            title="Optional custom endpoint for proxies, local providers, or hosted compatible APIs."
          />
        </label>
        <input
          v-model="credentialForm.apiBaseUrl"
          type="text"
          class="form-control"
          placeholder="Provider base URL"
        />
      </div>
      <div class="mb-3">
        <label class="form-label">
          API Version (optional)
          <i
            class="bi bi-info-circle text-muted ms-1"
            title="Optional API version, commonly needed for Azure/OpenAI-compatible deployments."
          />
        </label>
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
</template>

<script>
/**
 * Lightweight modal authoring experience for persisted `ai_credential` secrets and metadata fields.
 *
 * @author Akash Gundapuneni
 */

import BasicModal from "@/basic/Modal.vue";

function getEmptyCredentialForm() {
  return {
    id: 0,
    name: "",
    apiKey: "",
    provider: "",
    apiBaseUrl: "",
    apiVersion: "",
    enabled: true,
  };
}

export default {
  name: "AICredential",
  components: { BasicModal },
  data() {
    return {
      credentialForm: getEmptyCredentialForm(),
    };
  },
  methods: {
    open(row = null) {
      this.credentialForm = getEmptyCredentialForm();
      if (row) {
        this.credentialForm = {
          id: row.id,
          name: row.name || "",
          apiKey: "",
          provider: row.provider || "",
          apiBaseUrl: row.apiBaseUrl || "",
          apiVersion: row.apiVersion || "",
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
      if (!this.credentialForm.provider.trim()) {
        this.toastError("Provider is required");
        return;
      }

      const payload = {
        id: this.credentialForm.id || 0,
        name: this.credentialForm.name.trim(),
        provider: this.credentialForm.provider?.trim().toLowerCase() || null,
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
