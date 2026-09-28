<template>
  <BasicCard :title="$t('ai.hooks.title')">
    <template #headerElements>
      <BasicButton
        class="btn-primary btn-sm"
        :title="$t('ai.hooks.createTitle')"
        icon="plus"
        :text="$t('ai.hooks.add')"
        @click="openHookModal()"
      />
    </template>
    <template #body>
      <BasicTable
        :columns="columns"
        :data="hookRows"
        :options="tableOptions"
        :buttons="buttons"
        @action="onAction"
      />
    </template>
  </BasicCard>

  <AIHookStepperModal
    ref="hookModal"
    :output-modes="outputModes"
    :prompt-templates="promptTemplates"
    :model-rows="models"
    :hook-model-rows="hookModels"
  />

  <AIHookModelModal
    ref="hookModelModal"
    :model-rows="models"
    :hook-model-rows="hookModels"
  />

  <AIOverview ref="hookViewModal" resource-type="hook" />

  <AIModelShareStepper
    ref="shareHookStepper"
    :current-user-id="currentUserId"
    :resource-label="$t('ai.resources.hook')"
    resource-id-key="aiHookId"
    share-table="ai_hook_share"
  />

  <ConfirmModal ref="confirmModal" />
</template>

<script>
import BasicCard from "@/basic/dashboard/card/Card.vue";
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import AIHookModelModal from "@/components/dashboard/ai/hook/AIHookModelModal.vue";
import AIHookStepperModal from "@/components/dashboard/ai/hook/AIHookStepperModal.vue";
import AIOverview from "@/components/dashboard/ai/AIOverview.vue";
import AIModelShareStepper from "@/components/dashboard/ai/share/AIModelShareStepper.vue";
import { resolveApiMessage } from "@/assets/utils";


export default {
  name: "DashboardAIHooks",
  subscribeTable: ["ai_hook", "ai_hook_models", "template", "ai_model"],
  components: {
    BasicCard,
    BasicButton,
    BasicTable,
    ConfirmModal,
    AIHookModelModal,
    AIHookStepperModal,
    AIOverview,
    AIModelShareStepper,
  },
  data() {
    return {
      tableOptions: {
        striped: true,
        hover: true,
        pagination: 10,
        search: true,
      },
    };
  },
  computed: {
    outputModes() {
      return [
        { value: 0, label: this.$t("ai.output.text"), class: "bg-secondary" },
        { value: 1, label: this.$t("ai.output.json"), class: "bg-primary" },
      ];
    },
    columns() {
      return [
        { name: this.$t("ai.common.name"), key: "name", sortable: true },
        { name: this.$t("ai.hooks.promptTemplate"), key: "templateName", sortable: true },
        { name: this.$t("ai.common.models"), key: "modelSummary", sortable: true, sortKey: "modelSortLabel" },
        { name: this.$t("ai.common.sharedBy"), key: "sharedBy", sortable: true },
        { name: this.$t("ai.hooks.output"), key: "outputBadge", type: "badge", sortable: true, sortKey: "outputLabel" },
        { name: this.$t("ai.common.status"), key: "statusBadge", type: "badge", sortable: true, sortKey: "statusLabel" },
        { name: this.$t("ai.common.created"), key: "createdAt", type: "datetime", sortable: true },
      ];
    },
    currentUserId() {
      return this.$store.getters["auth/getUserId"];
    },
    hooks() {
      return this.$store.getters["table/ai_hook/getAll"] || [];
    },
    templates() {
      return this.$store.getters["table/template/getAll"] || [];
    },
    promptTemplates() {
      return this.templates.filter((template) => Number(template.type) === 8);
    },
    models() {
      return this.$store.getters["table/ai_model/getAll"] || [];
    },
    hookModels() {
      return this.$store.getters["table/ai_hook_models/getAll"] || [];
    },
    ownerLabelsByUserId() {
      const users = this.$store.getters["table/user/getAll"] || [];
      return users.reduce((acc, user) => {
        const label = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.userName;
        if (label) {
          acc[String(user.id)] = label;
        }
        return acc;
      }, {});
    },
    hookRows() {
      const templatesById = this.templates.reduce((acc, template) => {
        acc[template.id] = template;
        return acc;
      }, {});
      const modelsById = this.models.reduce((acc, model) => {
        acc[model.id] = model;
        return acc;
      }, {});
      const hookModelsByHookId = this.hookModels.reduce((acc, row) => {
        if (!row.deleted) {
          if (!acc[row.aiHookId]) acc[row.aiHookId] = [];
          acc[row.aiHookId].push(row);
        }
        return acc;
      }, {});

      const me = Number(this.currentUserId);

      return this.hooks.map((hook) => {
        const ownerId = Number(hook.userId);
        const isOwner = ownerId === me;
        const outputMode = this.outputModes.find((mode) => mode.value === Number(hook.outputMode)) || this.outputModes[0];
        const hookModelRows = [...(hookModelsByHookId[hook.id] || [])]
          .sort((a, b) => Number(a.priority) - Number(b.priority));
        const models = hookModelRows.map((row) => {
          const model = modelsById[row.aiModelId];
          return {
            ...row,
            name: model?.name || this.$t("ai.common.modelNumber", { id: row.aiModelId }),
            model: model?.model || null,
          };
        });
        const primaryModel = models[0];
        const extraModelCount = Math.max(models.length - 1, 0);
        const modelSummary = primaryModel
          ? `${primaryModel.name}${extraModelCount > 0 ? ` +${extraModelCount}` : ""}`
          : this.$t("ai.common.unknownModel");
        const sharedBy = isOwner ? "—" : (this.ownerLabelsByUserId[String(ownerId)] || "—");
        return {
          ...hook,
          isOwner,
          templateName: templatesById[hook.templateId]?.name || this.$t("ai.common.unknownTemplate"),
          models,
          modelSummary,
          modelSortLabel: modelSummary,
          sharedBy,
          outputLabel: outputMode.label,
          outputBadge: {
            text: outputMode.label,
            class: outputMode.class,
          },
          statusLabel: hook.enabled ? this.$t("ai.status.enabled") : this.$t("ai.status.disabled"),
          statusBadge: {
            text: hook.enabled ? this.$t("ai.status.enabled") : this.$t("ai.status.disabled"),
            class: hook.enabled ? "bg-success" : "bg-secondary",
          },
        };
      });
    },
    buttons() {
      return [
        {
          icon: "eye",
          title: this.$t("ai.actions.viewHook"),
          action: "view",
          options: { iconOnly: true, specifiers: { "btn-outline-info": true } },
        },
        {
          icon: "pencil",
          title: this.$t("ai.actions.editHook"),
          action: "edit",
          filter: [{ key: "userId", value: this.currentUserId }],
          options: { iconOnly: true, specifiers: { "btn-outline-secondary": true } },
        },
        {
          icon: "shuffle",
          title: this.$t("ai.actions.manageHookModels"),
          action: "models",
          filter: [{ key: "userId", value: this.currentUserId }],
          options: { iconOnly: true, specifiers: { "btn-outline-primary": true } },
        },
        {
          icon: "share",
          title: this.$t("ai.actions.shareHook"),
          action: "share",
          filter: [{ key: "userId", value: this.currentUserId }],
          options: { iconOnly: true, specifiers: { "btn-outline-primary": true } },
        },
        {
          icon: "toggle2-on",
          title: this.$t("ai.actions.disableHook"),
          action: "toggle",
          filter: [{ key: "enabled", value: true }, { key: "userId", value: this.currentUserId }],
          filterMode: "and",
          options: { iconOnly: true, specifiers: { "btn-outline-success": true } },
        },
        {
          icon: "toggle2-off",
          title: this.$t("ai.actions.enableHook"),
          action: "toggle",
          filter: [{ key: "enabled", value: false }, { key: "userId", value: this.currentUserId }],
          filterMode: "and",
          options: { iconOnly: true, specifiers: { "btn-outline-warning": true } },
        },
        {
          icon: "trash",
          title: this.$t("ai.actions.deleteHook"),
          action: "delete",
          filter: [{ key: "userId", value: this.currentUserId }],
          options: { iconOnly: true, specifiers: { "btn-outline-danger": true } },
        },
      ];
    },
  },
  methods: {
    onAction(data) {
      switch (data.action) {
        case "view":
          this.$refs.hookViewModal.open(data.params);
          break;
        case "edit":
          this.openHookModal(data.params);
          break;
        case "models":
          this.$refs.hookModelModal.open(data.params);
          break;
        case "share":
          this.$refs.shareHookStepper.open(data.params);
          break;
        case "toggle":
          this.toggleHook(data.params);
          break;
        case "delete":
          this.deleteHook(data.params);
          break;
      }
    },
    openHookModal(row = null) {
      this.$refs.hookModal.open(row);
    },
    toggleHook(row) {
      this.$socket.emit("appDataUpdate", {
        table: "ai_hook",
        data: {
          id: row.id,
          enabled: !row.enabled,
        },
      }, (result) => {
        if (!result?.success) {
          this.toastError(resolveApiMessage(result, "ai.errors.updateHook"));
        }
      });
    },
    deleteHook(row) {
      this.$refs.confirmModal.open(
        this.$t("ai.confirm.deleteHookTitle"),
        this.$t("ai.confirm.deleteHook", { name: row.name }),
        "",
        (confirmed) => {
          if (!confirmed) return;
          this.$socket.emit("appDataUpdate", {
            table: "ai_hook",
            data: {
              id: row.id,
              deleted: true,
            },
          }, (result) => {
            if (result?.success) {
              this.toastSuccess(this.$t("ai.messages.hookDeleted"));
            } else {
              this.toastError(resolveApiMessage(result, "ai.errors.deleteHook"));
            }
          });
        }
      );
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
