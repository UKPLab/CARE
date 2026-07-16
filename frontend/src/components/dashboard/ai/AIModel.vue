<template>
  <BasicModal
    ref="modal"
    name="aiModelModal"
    size="lg"
    @hide="resetForm"
  >
    <template #title>
      {{ modelForm.id ? "Edit AI Model" : "Add AI Model" }}
    </template>
    <template #body>
      <BasicForm
        ref="form"
        v-model="modelForm"
        :fields="modelFields"
        @button-click="handleFormButton"
      />
      <small v-if="modelLookupError" class="text-danger">{{ modelLookupError }}</small>
    </template>
    <template #footer>
      <span class="btn-group">
        <BasicButton
          class="btn btn-secondary"
          text="Cancel"
          @click="$refs.modal.close()"
        />
        <BasicButton
          class="btn btn-outline-secondary"
          :disabled="isTestingModel"
          :text="isTestingModel ? 'Testing...' : 'Send Test Prompt'"
          @click="testModel"
        />
        <BasicButton
          class="btn btn-primary"
          :text="modelForm.id ? 'Update' : 'Add'"
          @click="saveModel"
        />
      </span>
    </template>
  </BasicModal>
</template>

<script>
/**
 * Captures selectable models, LiteLLM parameters, credential binding, plus provider discovery tooling.
 *
 * @author Akash Gundapuneni
 */

import BasicModal from "@/basic/Modal.vue";
import BasicForm from "@/basic/Form.vue";
import BasicButton from "@/basic/Button.vue";

export default {
  name: "AIModel",
  components: { BasicModal, BasicForm, BasicButton },
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
  subscribeTable: ["ai_budget"],
  data() {
    return {
      modelForm: {},
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
    modelFields() {
      const labelButton = {
        text: this.isLoadingModels ? "Loading..." : "Load Models",
        disabled: !this.canLoadModelOptions || this.isLoadingModels,
        class: "btn-outline-secondary btn-sm",
        action: "loadModelOptions",
      };
      const modelField = this.modelOptionValues.length
        ? {
            key: "model",
            label: "Model Name",
            type: "select",
            required: true,
            default: "",
            labelButton,
            help: "Select the model you want to use, e.g. gpt-4o or claude-3-5-sonnet.",
            options: [
              { value: "", name: "Select model" },
              ...this.modelOptionValues.map((model) => ({ value: model, name: model })),
            ],
          }
        : {
            key: "model",
            label: "Model Name",
            type: "text",
            required: true,
            default: "",
            labelButton,
            placeholder: "Model name",
            help: "Select a credential, then load models from LiteLLM, or enter a model name.",
          };

      return [
        {
          key: "name",
          label: "Name",
          type: "text",
          required: true,
          default: "",
          placeholder: "Name",
          help: "A display name for this AI model inside CARE.",
        },
        {
          key: "aiCredentialId",
          label: "Your Credentials",
          type: "select",
          required: true,
          default: null,
          options: [
            { value: null, name: "Select credential" },
            ...this.selectableCredentialRows.map((credential) => ({
              value: credential.id,
              name: credential.name,
            })),
          ],
          help: "Select the credential that you want to use to access the model.",
        },
        modelField,
        {
          key: "description",
          label: "Description (optional)",
          type: "textarea",
          default: "",
          rows: 2,
          help: "Optional notes to help identify when this model should be used.",
        },
        {
          key: "additionalParameters",
          label: "Additional Parameters (JSON, optional)",
          type: "json",
          default: {},
          rows: 4,
          placeholder: "{}",
          help: "Optional parameters as JSON, such as temperature, top_p, or fallback_models.",
        },
        {
          key: "freeModel",
          label: "Free Model",
          type: "switch",
          default: false,
          help: "Free/self-hosted models bypass all spending caps. When disabled, costs are tracked.",
        },
        ...(!this.modelForm.freeModel
          ? [{
              key: "costLimit",
              label: "Cost limit ($)",
              type: "number",
              default: "",
              min: 0,
              step: 0.01,
              placeholder: "No limit",
              help: "Global cap across all users on this model.",
            }]
          : []),
        {
          key: "enabled",
          label: "Enabled",
          type: "switch",
          default: true,
        },
      ];
    },
  },
  watch: {
    "modelForm.aiCredentialId"(newId, oldId) {
      if (oldId === undefined || newId === oldId) return;
      this.clearModelOptions();
    },
    "modelForm.freeModel"(isFree) {
      if (isFree) {
        this.modelForm.costLimit = "";
      }
    },
  },
  methods: {
    handleFormButton({ action }) {
      if (action === "loadModelOptions") {
        this.loadModelOptions();
      }
    },
    open(row = null) {
      this.resetForm();
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
          additionalParameters: row.additionalParameters || {},
          freeModel: !!row.freeModel,
          costLimit: this.findExistingCap(row.id)?.toString() || "",
        };
      }
      this.$refs.modal.open();
    },
    resetForm() {
      this.modelForm = {};
      this.isTestingModel = false;
      this.isLoadingModels = false;
      this.clearModelOptions();
      this.eventBus.emit("resetFormField");
    },
    findExistingCapRow(modelId) {
      if (!modelId) return null;
      const budgets = this.$store.getters["table/ai_budget/getFiltered"]
        ? this.$store.getters["table/ai_budget/getFiltered"](
            (b) => !b.deleted && Number(b.modelId) === Number(modelId) && Number(b.limitType) === 0
          )
        : [];
      return budgets.length > 0 ? budgets[0] : null;
    },
    findExistingCap(modelId) {
      const row = this.findExistingCapRow(modelId);
      return row ? Number(row.costLimit) : null;
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
      if (!this.$refs.form.validate()) return;

      const payload = {
        id: this.modelForm.id || 0,
        name: this.modelForm.name.trim(),
        model: this.modelForm.model.trim(),
        aiCredentialId: this.modelForm.aiCredentialId,
        description: this.modelForm.description?.trim() || null,
        additionalParameters: this.modelForm.additionalParameters || {},
        enabled: !!this.modelForm.enabled,
        freeModel: !!this.modelForm.freeModel,
      };

      this.$socket.emit("appDataUpdate", {
        table: "ai_model",
        data: payload,
      }, (result) => {
        if (!result.success) {
          this.toastError(result.message || "Failed to save model");
          return;
        }
        const savedModelId = result.data?.id || result.data || this.modelForm.id;
        const costLimitValue = Number(this.modelForm.costLimit);
        const wantsCap = !this.modelForm.freeModel
          && Number.isFinite(costLimitValue)
          && costLimitValue > 0;
        // Standard appDataUpdate chain: save the model, then update or create the ai_budget row.
        if (wantsCap) {
          const existing = this.findExistingCapRow(savedModelId);
          const capData = existing
            ? { id: existing.id, costLimit: costLimitValue }
            : { modelId: Number(savedModelId), limitType: 0, costLimit: costLimitValue };
          this.$socket.emit("appDataUpdate", { table: "ai_budget", data: capData }, (capResult) => {
            if (!capResult?.success) {
              this.toastError(capResult?.message || "Failed to save cost limit");
            }
          });
        }
        this.$refs.modal.close();
        this.toastSuccess(this.modelForm.id ? "Model updated" : "Model created");
      });
    },
    testModel() {
      if (!this.$refs.form.validate()) return;

      this.isTestingModel = true;
      this.$socket.emit("serviceCommand", {
        service: "AIService",
        command: "testModel",
        data: {
          aiModelId: this.modelForm.id || null,
          credentialId: this.modelForm.aiCredentialId,
          model: this.modelForm.model.trim(),
          additionalParameters: this.modelForm.additionalParameters || {},
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
