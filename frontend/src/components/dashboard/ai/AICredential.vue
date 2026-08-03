<template>
  <BasicModal
    ref="modal"
    name="aiCredentialModal"
    @hide="resetForm"
  >
    <template #title>
      {{ credentialForm.id ? "Edit AI Credential" : "Add AI Credential" }}
    </template>
    <template #body>
      <BasicForm
        ref="form"
        v-model="credentialForm"
        :fields="credentialFields"
      />
    </template>
    <template #footer>
      <span class="btn-group">
        <BasicButton
          class="btn btn-secondary"
          text="Cancel"
          @click="$refs.modal.close()"
        />
        <BasicButton
          class="btn btn-primary"
          :text="credentialForm.id ? 'Update' : 'Create'"
          @click="saveCredential"
        />
      </span>
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
import BasicForm from "@/basic/Form.vue";
import BasicButton from "@/basic/Button.vue";

export default {
  name: "AICredential",
  components: { BasicModal, BasicForm, BasicButton },
  data() {
    return {
      credentialForm: {},
      providerOptions: [],
      isLoadingProviders: false,
      providerLookupError: "",
    };
  },
  computed: {
    providerSelectOptions() {
      const options = new Set(this.providerOptions);
      const current = this.credentialForm.provider?.trim().toLowerCase();
      if (current) {
        options.add(current);
      }
      const providerValues = [...options].sort((a, b) => a.localeCompare(b));

      if (this.isLoadingProviders) {
        return [{ value: "", name: "Loading providers..." }];
      }

      return [
        { value: "", name: "Select provider" },
        ...providerValues.map((provider) => ({ value: provider, name: provider })),
      ];
    },
    credentialFields() {
      return [
        {
          key: "name",
          label: "Credential Name",
          type: "text",
          required: true,
          default: "",
          placeholder: "Credential name",
          help: "A display name for your API credential.",
        },
        {
          key: "apiKey",
          label: "API Key",
          type: "password",
          default: "",
          placeholder: this.credentialForm.id
            ? "Leave empty to keep existing key"
            : "API key",
          help: "Provide an API key and/or a base URL. At least one is required. Leave empty while editing to keep the existing key.",
        },
        {
          key: "provider",
          label: "Provider",
          type: "select",
          required: true,
          default: "",
          help: this.providerLookupError
            || "Select the LiteLLM provider for your API key (e.g. openai, groq, openrouter).",
          options: this.providerSelectOptions,
        },
        {
          key: "apiBaseUrl",
          label: "API Base URL",
          type: "text",
          default: "",
          placeholder: "Provider base URL",
          help: "Custom endpoint for proxies, local providers, or hosted compatible APIs. Required if no API key is provided.",
        },
        {
          key: "apiVersion",
          label: "API Version (optional)",
          type: "text",
          default: "",
          placeholder: "Version (optional)",
          help: "Optional API version, commonly needed for Azure/OpenAI-compatible deployments.",
        },
        {
          key: "enabled",
          label: "Enabled",
          type: "switch",
          default: true,
        },
      ];
    },
  },
  methods: {
    open(row = null) {
      this.resetForm();
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
      this.$refs.modal.open();
      this.loadProviders();
    },
    resetForm() {
      this.credentialForm = {};
      this.providerOptions = [];
      this.providerLookupError = "";
      this.isLoadingProviders = false;
      this.eventBus.emit("resetFormField");
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
    async loadProviders() {
      this.isLoadingProviders = true;
      this.providerLookupError = "";
      try {
        const result = await this.emitAiServiceCommand("getProviders");
        this.providerOptions = Array.isArray(result?.providers) ? result.providers : [];
        if (this.providerOptions.length === 0) {
          this.providerLookupError = "No providers were returned from LiteLLM.";
        }
      } catch (error) {
        this.providerOptions = [];
        this.providerLookupError = error.message || "Failed to load providers";
        this.toastError(this.providerLookupError);
      } finally {
        this.isLoadingProviders = false;
      }
    },
    saveCredential() {
      if (!this.$refs.form.validate()) return;

      const hasApiKey = !!this.credentialForm.apiKey?.trim();
      const hasBaseUrl = !!this.credentialForm.apiBaseUrl?.trim();
      // On edit, empty API key keeps the existing key, so that still satisfies the requirement.
      if (!hasApiKey && !hasBaseUrl && !this.credentialForm.id) {
        this.toastError("Provide an API key or a base URL");
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
      if (hasApiKey) {
        payload.apiKey = this.credentialForm.apiKey.trim();
      }

      this.$socket.emit("appDataUpdate", {
        table: "ai_credential",
        data: payload,
      }, (result) => {
        if (result.success) {
          this.$refs.modal.close();
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
