<template>
  <BasicCard title="AI Hooks">
    <template #headerElements>
      <BasicButton
        class="btn-primary btn-sm"
        title="Create AI hook"
        icon="plus"
        text="Add AI Hook"
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
    :current-user-id="currentUserId"
    :output-modes="outputModes"
    :prompt-templates="promptTemplates"
    :model-rows="models"
  />

  <ConfirmModal ref="confirmModal" />
</template>

<script>
import BasicCard from "@/basic/dashboard/card/Card.vue";
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import AIHookStepperModal from "@/components/dashboard/ai/AIHookStepperModal.vue";

const OUTPUT_MODES = [
  { value: 0, label: "Text", class: "bg-secondary" },
  { value: 1, label: "JSON", class: "bg-primary" },
  { value: 2, label: "Image", class: "bg-info" },
];
const OUTPUT_MODES_BY_VALUE = OUTPUT_MODES.reduce((acc, mode) => {
  acc[mode.value] = mode;
  return acc;
}, {});

export default {
  name: "DashboardAIHooks",
  subscribeTable: ["ai_hook", "template", "ai_model"],
  components: {
    BasicCard,
    BasicButton,
    BasicTable,
    ConfirmModal,
    AIHookStepperModal,
  },
  data() {
    return {
      tableOptions: {
        striped: true,
        hover: true,
        pagination: 10,
        search: true,
      },
      outputModes: OUTPUT_MODES,
      columns: [
        { name: "Name", key: "name", sortable: true },
        { name: "Prompt Template", key: "templateName", sortable: true },
        { name: "Model", key: "modelName", sortable: true },
        { name: "Output", key: "outputBadge", type: "badge", sortable: true, sortKey: "outputLabel" },
        { name: "Status", key: "statusBadge", type: "badge", sortable: true, sortKey: "statusLabel" },
        { name: "Created", key: "createdAt", type: "datetime", sortable: true },
      ],
    };
  },
  computed: {
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
    hookRows() {
      const templatesById = this.templates.reduce((acc, template) => {
        acc[template.id] = template;
        return acc;
      }, {});
      const modelsById = this.models.reduce((acc, model) => {
        acc[model.id] = model;
        return acc;
      }, {});

      return this.hooks.map((hook) => {
        const outputMode = OUTPUT_MODES_BY_VALUE[Number(hook.outputMode)] || OUTPUT_MODES_BY_VALUE[0];
        return {
          ...hook,
          templateName: templatesById[hook.templateId]?.name || "Unknown template",
          modelName: modelsById[hook.aiModelId]?.name || "Unknown model",
          outputLabel: outputMode.label,
          outputBadge: {
            text: outputMode.label,
            class: outputMode.class,
          },
          statusLabel: hook.enabled ? "Enabled" : "Disabled",
          statusBadge: {
            text: hook.enabled ? "Enabled" : "Disabled",
            class: hook.enabled ? "bg-success" : "bg-secondary",
          },
        };
      });
    },
    buttons() {
      return [
        {
          icon: "pencil",
          title: "Edit AI hook",
          action: "edit",
          filter: [{ key: "userId", value: this.currentUserId }],
          options: { iconOnly: true, specifiers: { "btn-outline-secondary": true } },
        },
        {
          icon: "toggle2-on",
          title: "Disable AI hook",
          action: "toggle",
          filter: [{ key: "enabled", value: true }, { key: "userId", value: this.currentUserId }],
          filterMode: "and",
          options: { iconOnly: true, specifiers: { "btn-outline-success": true } },
        },
        {
          icon: "toggle2-off",
          title: "Enable AI hook",
          action: "toggle",
          filter: [{ key: "enabled", value: false }, { key: "userId", value: this.currentUserId }],
          filterMode: "and",
          options: { iconOnly: true, specifiers: { "btn-outline-warning": true } },
        },
        {
          icon: "trash",
          title: "Delete AI hook",
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
        case "edit":
          this.openHookModal(data.params);
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
      if (Number(row.userId) !== Number(this.currentUserId)) {
        this.toastError("Only hook owners can update this AI hook");
        return;
      }

      this.$socket.emit("appDataUpdate", {
        table: "ai_hook",
        data: {
          id: row.id,
          enabled: !row.enabled,
        },
      }, (result) => {
        if (!result?.success) {
          this.toastError(result?.message || "Failed to update AI hook");
        }
      });
    },
    deleteHook(row) {
      if (Number(row.userId) !== Number(this.currentUserId)) {
        this.toastError("Only hook owners can delete this AI hook");
        return;
      }

      this.$refs.confirmModal.open(
        "Delete AI Hook",
        `Delete AI hook "${row.name}"?`,
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
              this.toastSuccess("AI hook deleted");
            } else {
              this.toastError(result?.message || "Failed to delete AI hook");
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
