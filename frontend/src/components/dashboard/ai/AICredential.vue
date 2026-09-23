<template>
  <BasicModal
    ref="modal"
    name="aiCredentialModal"
    size="lg"
    @hide="resetForm"
  >
    <template #title>
      {{ credentialForm.id ? $t("ai.credentials.editTitle") : $t("ai.credentials.addTitle") }}
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
          :text="$t('ai.common.cancel')"
          @click="$refs.modal.close()"
        />
        <BasicButton
          class="btn btn-primary"
          :text="credentialForm.id ? $t('ai.common.update') : $t('ai.common.create')"
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
import { resolveApiMessage } from "@/assets/utils";

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
      if (this.isLoadingProviders) {
        return [];
      }

      const options = new Set(this.providerOptions);
      const current = this.credentialForm.provider?.trim().toLowerCase();
      if (current) {
        options.add(current);
      }
      return [...options]
        .sort((a, b) => a.localeCompare(b))
        .map((provider) => ({ value: provider, name: provider }));
    },
    credentialFields() {
      return [
        {
          key: "name",
          label: this.$t("ai.credentials.name"),
          type: "text",
          required: true,
          default: "",
          placeholder: this.$t("ai.credentials.namePlaceholder"),
          help: this.$t("ai.credentials.nameHelp"),
        },
        {
          key: "apiKey",
          label: this.$t("ai.credentials.apiKey"),
          type: "password",
          default: "",
          placeholder: this.credentialForm.id
            ? this.$t("ai.credentials.keepKeyPlaceholder")
            : this.$t("ai.credentials.apiKeyPlaceholder"),
          help: this.$t("ai.credentials.apiKeyHelp"),
        },
        {
          key: "provider",
          label: this.$t("ai.common.provider"),
          type: "select",
          required: true,
          default: "",
          search: true,
          placeholder: this.isLoadingProviders ? this.$t("ai.credentials.loadingProviders") : this.$t("ai.credentials.selectProvider"),
          help: this.providerLookupError
            || this.$t("ai.credentials.providerHelp"),
          options: this.providerSelectOptions,
        },
        {
          key: "apiBaseUrl",
          label: this.$t("ai.credentials.baseUrl"),
          type: "text",
          default: "",
          placeholder: this.$t("ai.credentials.baseUrlPlaceholder"),
          help: this.$t("ai.credentials.baseUrlHelp"),
        },
        {
          key: "apiVersion",
          label: this.$t("ai.credentials.apiVersion"),
          type: "text",
          default: "",
          placeholder: this.$t("ai.credentials.apiVersionPlaceholder"),
          help: this.$t("ai.credentials.apiVersionHelp"),
        },
        {
          key: "enabled",
          label: this.$t("ai.status.enabled"),
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
    async loadProviders() {
      this.isLoadingProviders = true;
      this.providerLookupError = "";
      try {
        const result = await this.$ai.getProviders();
        this.providerOptions = Array.isArray(result?.providers) ? result.providers : [];
        if (this.providerOptions.length === 0) {
          this.providerLookupError = this.$t("ai.credentials.noProviders");
        }
      } catch (error) {
        this.providerOptions = [];
        this.providerLookupError = resolveApiMessage(error, "ai.errors.loadProviders");
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
        this.toastError(this.$t("ai.errors.credentialRequired"));
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
          this.toastSuccess(this.credentialForm.id ? this.$t("ai.messages.credentialUpdated") : this.$t("ai.messages.credentialCreated"));
        } else {
          this.toastError(resolveApiMessage(result, "ai.errors.saveCredential"));
        }
      });
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
