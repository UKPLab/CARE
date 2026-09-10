<template>
  <BasicModal
    ref="modal"
    name="aiModelModal"
    size="lg"
    @hide="resetForm"
  >
    <template #title>
      {{ modelForm.id ? $t("ai.models.editTitle") : $t("ai.models.addTitle") }}
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
          :text="$t('ai.common.cancel')"
          @click="$refs.modal.close()"
        />
        <BasicButton
          class="btn btn-outline-secondary"
          :disabled="isTestingModel"
          :text="isTestingModel ? $t('ai.models.testing') : $t('ai.models.sendTestPrompt')"
          @click="testModel"
        />
        <BasicButton
          class="btn btn-primary"
          :text="modelForm.id ? $t('ai.common.update') : $t('ai.common.add')"
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
import { resolveApiMessage } from "@/assets/utils";

export default {
  name: "AIModel",
  components: { BasicModal, BasicForm, BasicButton },
  props: {
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
        text: this.isLoadingModels ? this.$t("common.loading") : this.$t("ai.models.loadModels"),
        disabled: !this.canLoadModelOptions || this.isLoadingModels,
        class: "btn-outline-secondary btn-sm",
        action: "loadModelOptions",
      };
      const modelField = this.modelOptionValues.length
        ? {
            key: "model",
            label: this.$t("ai.models.modelName"),
            type: "select",
            required: true,
            default: "",
            labelButton,
            help: this.$t("ai.models.modelSelectHelp"),
            options: [
              { value: "", name: this.$t("ai.models.selectModel") },
              ...this.modelOptionValues.map((model) => ({ value: model, name: model })),
            ],
          }
        : {
            key: "model",
            label: this.$t("ai.models.modelName"),
            type: "text",
            required: true,
            default: "",
            labelButton,
            placeholder: this.$t("ai.models.modelNamePlaceholder"),
            help: this.$t("ai.models.modelLoadHelp"),
          };

      return [
        {
          key: "name",
          label: this.$t("ai.common.name"),
          type: "text",
          required: true,
          default: "",
          placeholder: this.$t("ai.models.namePlaceholder"),
          help: this.$t("ai.models.nameHelp"),
        },
        {
          key: "aiCredentialId",
          label: this.$t("ai.models.yourCredentials"),
          type: "select",
          required: true,
          default: null,
          options: [
            { value: null, name: this.$t("ai.models.selectCredential") },
            ...this.selectableCredentialRows.map((credential) => ({
              value: credential.id,
              name: credential.name,
            })),
          ],
          help: this.$t("ai.models.credentialHelp"),
        },
        modelField,
        {
          key: "description",
          label: this.$t("ai.models.description"),
          type: "textarea",
          default: "",
          rows: 2,
          help: this.$t("ai.models.descriptionHelp"),
        },
        {
          key: "additionalParameters",
          label: this.$t("ai.models.additionalParameters"),
          type: "json",
          default: {},
          rows: 4,
          placeholder: "{}",
          help: this.$t("ai.models.additionalParametersHelp"),
        },
        {
          key: "freeModel",
          label: this.$t("ai.models.freeModel"),
          type: "switch",
          default: false,
          help: this.$t("ai.models.freeModelHelp"),
        },
        ...(!this.modelForm.freeModel
          ? [{
              key: "costLimit",
              label: this.$t("ai.budgets.costLimitUsd"),
              type: "number",
              default: "",
              min: 0,
              step: 0.01,
              placeholder: this.$t("ai.common.noLimit"),
              help: this.$t("ai.models.costLimitHelp"),
            }]
          : []),
        {
          key: "enabled",
          label: this.$t("ai.status.enabled"),
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
            (b) => !b.deleted && Number(b.aiModelId) === Number(modelId) && Number(b.limitType) === 0
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
    async loadModelOptions() {
      if (!this.modelForm.aiCredentialId) {
        this.toastError(this.$t("ai.errors.credentialIsRequired"));
        return;
      }

      this.isLoadingModels = true;
      this.modelLookupError = "";
      try {
        const result = await this.$ai.getValidModels({
          credentialId: this.modelForm.aiCredentialId,
        });
        this.modelOptions = Array.isArray(result?.models) ? result.models : [];
        if (this.modelOptions.length === 0) {
          this.modelLookupError = this.$t("ai.models.noModels");
        }
      } catch (error) {
        this.modelOptions = [];
        this.modelLookupError = resolveApiMessage(error, "ai.errors.loadModels");
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
          this.toastError(resolveApiMessage(result, "ai.errors.saveModel"));
          return;
        }
        const savedModelId = result.data?.id || result.data || this.modelForm.id;
        const rawCostLimit = this.modelForm.costLimit;
        const hasCostLimit = rawCostLimit !== "" && rawCostLimit !== null && rawCostLimit !== undefined;
        const costLimitValue = Number(rawCostLimit);
        const wantsCap = !this.modelForm.freeModel
          && hasCostLimit
          && Number.isFinite(costLimitValue)
          && costLimitValue >= 0;
        // Standard appDataUpdate chain: save the model, then update or create the ai_budget row.
        if (wantsCap) {
          const existing = this.findExistingCapRow(savedModelId);
          const capData = existing
            ? { id: existing.id, costLimit: costLimitValue }
            : { aiModelId: Number(savedModelId), limitType: 0, costLimit: costLimitValue };
          this.$socket.emit("appDataUpdate", { table: "ai_budget", data: capData }, (capResult) => {
            if (!capResult?.success) {
              this.toastError(resolveApiMessage(capResult, "ai.errors.saveCostLimit"));
            }
          });
        }
        this.$refs.modal.close();
        this.toastSuccess(this.modelForm.id ? this.$t("ai.messages.modelUpdated") : this.$t("ai.messages.modelCreated"));
      });
    },
    async testModel() {
      if (!this.$refs.form.validate()) return;

      this.isTestingModel = true;
      try {
        const result = await this.$ai.testModel({
          aiModelId: this.modelForm.id || null,
          credentialId: this.modelForm.aiCredentialId,
          model: this.modelForm.model.trim(),
          additionalParameters: this.modelForm.additionalParameters || {},
        });
        const outputText = result?.outputText ? String(result.outputText) : "";
        this.toastSuccess(outputText ? this.$t("ai.messages.modelTestOutput", { output: outputText }) : this.$t("ai.messages.modelTestSuccess"));
      } catch (error) {
        this.toastError(resolveApiMessage(error, "ai.errors.modelTestFailed"));
      } finally {
        this.isTestingModel = false;
      }
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
