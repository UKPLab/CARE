<template>
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
</template>

<script>
import BasicModal from "@/basic/Modal.vue";

function getEmptyCredentialForm() {
  return {
    id: 0,
    name: "",
    apiKey: "",
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
