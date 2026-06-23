<template>
  <BasicCard title="AI Budget">
    <template #body>
      <BasicTable
        :columns="columns"
        :data="budgetRows"
        :options="tableOptions"
        :buttons="rowButtons"
        @action="onAction"
      />
    </template>
  </BasicCard>

  <AIBudgetEditModal ref="editModal" />
  <ConfirmModal ref="confirmModal" />
</template>

<script>
/**
 * AI Budget overview : lists every cap the user owns and supports editing the
 * cost limit or removing the cap. Reset action is intentionally not exposed
 * here yet.
 *
 * All data resolved from the autoTable store: ai_budget rows + parents
 * (ai_model, ai_model_share, ai_hook, ai_hook_share, study, study_step, user).
 *
 * @author Mohammed Rawhani
 */
import BasicCard from "@/basic/dashboard/card/Card.vue";
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import AIBudgetEditModal from "@/components/dashboard/ai/AIBudgetEditModal.vue";

const LIMIT_TYPE_LABELS = { 0: "Total", 1: "Per session", 2: "Per user" };

export default {
  name: "DashboardAIBudgets",
  subscribeTable: ["ai_budget"],
  components: { BasicCard, BasicButton, BasicTable, ConfirmModal, AIBudgetEditModal },
  data() {
    return {
      tableOptions: {
        striped: true,
        hover: true,
        pagination: 10,
        search: true,
      },
      columns: [
        { name: "Entity type", key: "entityTypeLabel", sortable: true },
        { name: "Entity", key: "entityLabel", sortable: true },
        { name: "Limit type", key: "limitTypeLabel", sortable: true },
        { name: "Limit", key: "costLimitLabel", sortable: true, sortKey: "costLimit" },
        { name: "Last reset", key: "resetAtLabel", sortable: true, sortKey: "resetAt" },
      ],
    };
  },
  computed: {
    budgets() {
      return this.$store.getters["table/ai_budget/getAll"] || [];
    },
    modelsById() {
      return (this.$store.getters["table/ai_model/getAll"] || []).reduce((acc, row) => {
        acc[row.id] = row;
        return acc;
      }, {});
    },
    hooksById() {
      return (this.$store.getters["table/ai_hook/getAll"] || []).reduce((acc, row) => {
        acc[row.id] = row;
        return acc;
      }, {});
    },
    studiesById() {
      return (this.$store.getters["table/study/getAll"] || []).reduce((acc, row) => {
        acc[row.id] = row;
        return acc;
      }, {});
    },
    studyStepsById() {
      return (this.$store.getters["table/study_step/getAll"] || []).reduce((acc, row) => {
        acc[row.id] = row;
        return acc;
      }, {});
    },
    modelSharesById() {
      return (this.$store.getters["table/ai_model_share/getAll"] || []).reduce((acc, row) => {
        acc[row.id] = row;
        return acc;
      }, {});
    },
    hookSharesById() {
      return (this.$store.getters["table/ai_hook_share/getAll"] || []).reduce((acc, row) => {
        acc[row.id] = row;
        return acc;
      }, {});
    },
    usersById() {
      return (this.$store.getters["table/user/getAll"] || []).reduce((acc, row) => {
        acc[row.id] = row;
        return acc;
      }, {});
    },
    budgetRows() {
      return this.budgets
        .filter((b) => !b.deleted)
        .map((b) => {
          const { entityType, entityLabel } = this.resolveScope(b);
          return {
            ...b,
            entityTypeLabel: this.entityTypeLabel(entityType),
            entityType,
            entityLabel,
            limitTypeLabel: LIMIT_TYPE_LABELS[Number(b.limitType)] || "—",
            costLimitLabel: this.formatCurrency(b.costLimit),
            resetAtLabel: this.formatDateTime(b.resetAt),
          };
        });
    },
    rowButtons() {
      return [
        {
          icon: "pencil",
          title: "Edit limit",
          action: "edit",
          options: { iconOnly: true, specifiers: { "btn-outline-secondary": true } },
        },
        {
          icon: "trash",
          title: "Remove cap",
          action: "delete",
          options: { iconOnly: true, specifiers: { "btn-outline-danger": true } },
        },
      ];
    },
  },
  methods: {
    resolveScope(b) {
      if (b.studyStepId && b.hookId) {
        const step = this.studyStepsById[b.studyStepId];
        const study = step ? this.studiesById[step.studyId] : null;
        const hook = this.hooksById[b.hookId];
        const stepLabel = step ? `Step ${step.stepNumber || step.id}` : `Step #${b.studyStepId}`;
        const hookLabel = hook?.name || `Hook #${b.hookId}`;
        const studyLabel = study?.name || (step ? `Study #${step.studyId}` : "");
        return { entityType: "step_hook", entityLabel: `${hookLabel} @ ${stepLabel}${studyLabel ? ` (${studyLabel})` : ""}` };
      }
      if (b.modelId) {
        const m = this.modelsById[b.modelId];
        return { entityType: "model", entityLabel: m?.name || `Model #${b.modelId}` };
      }
      if (b.shareId) {
        const share = this.modelSharesById[b.shareId];
        const model = share ? this.modelsById[share.aiModelId] : null;
        const who = this.recipientLabel(share);
        const entity = model?.name || (share ? `Model #${share.aiModelId}` : `Share #${b.shareId}`);
        return { entityType: "model_share", entityLabel: `${who} (${entity})` };
      }
      if (b.hookId) {
        const h = this.hooksById[b.hookId];
        return { entityType: "hook", entityLabel: h?.name || `Hook #${b.hookId}` };
      }
      if (b.hookShareId) {
        const share = this.hookSharesById[b.hookShareId];
        const hook = share ? this.hooksById[share.aiHookId] : null;
        const who = this.recipientLabel(share);
        const entity = hook?.name || (share ? `Hook #${share.aiHookId}` : `Hook share #${b.hookShareId}`);
        return { entityType: "hook_share", entityLabel: `${who} (${entity})` };
      }
      if (b.studyId) {
        const s = this.studiesById[b.studyId];
        return { entityType: "study", entityLabel: s?.name || `Study #${b.studyId}` };
      }
      return { entityType: "unknown", entityLabel: "—" };
    },
    entityTypeLabel(entityType) {
      switch (entityType) {
        case "model": return "Model";
        case "model_share": return "Model share";
        case "hook": return "Hook";
        case "hook_share":  return "Hook share";
        case "study": return "Study";
        case "step_hook":   return "Step hook";
        default: return "—";
      }
    },
    recipientLabel(share) {
      if (!share) return "—";
      const user = this.usersById[share.userId];
      if (user) {
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
        return fullName || user.userName || `User #${share.userId}`;
      }
      if (share.roleId) return `Role #${share.roleId}`;
      return `User #${share.userId}`;
    },
    formatCurrency(value) {
      const num = Number(value);
      if (!Number.isFinite(num)) return "—";
      return `$${num.toFixed(2)}`;
    },
    formatDateTime(value) {
      if (!value) return "Never";
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "Never" : date.toLocaleString();
    },
    onAction(data) {
      switch (data.action) {
        case "edit":   this.openEdit(data.params); break;
        case "delete": this.openDelete(data.params); break;
      }
    },
    openEdit(row) {
      this.$refs.editModal.open(row);
    },
    openDelete(row) {
      this.$refs.confirmModal.open(
        "Remove cap",
        `Remove this budget? AI usage at this level will no longer be capped.`,
        "",
        (confirmed) => {
          if (!confirmed) return;
          // Standard appDataUpdate soft-delete
          this.$socket.emit(
            "appDataUpdate",
            { table: "ai_budget", data: { id: row.id, deleted: true } },
            (result) => {
              if (result?.success) {
                this.toastSuccess("Cap removed");
              } else {
                this.toastError(result?.message || "Failed to remove cap");
              }
            }
          );
        }
      );
    },
    toastSuccess(message) {
      this.eventBus.emit("toast", { title: "Success", message, variant: "success" });
    },
    toastError(message) {
      this.eventBus.emit("toast", { title: "Error", message, variant: "danger" });
    },
  },
};
</script>
