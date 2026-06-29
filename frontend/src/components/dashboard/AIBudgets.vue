<template>
  <BasicCard title="AI Budget">
    <template #body>
      <ul class="nav nav-tabs mb-3">
        <li v-for="tab in tabs" :key="tab.key" class="nav-item">
          <button
            class="nav-link"
            :class="{ active: activeTab === tab.key }"
            type="button"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
            <span v-if="tabRows(tab.key).length" class="badge bg-secondary ms-1">{{ tabRows(tab.key).length }}</span>
          </button>
        </li>
      </ul>
      <BasicTable
        :columns="tabColumns"
        :data="tabRows(activeTab)"
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
 * cost limit, resetting the spending window, or removing the cap.
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
      activeTab: "models",
      tabs: [
        { key: "models",  label: "Models",  types: ["model", "model_share"] },
        { key: "hooks",   label: "Hooks",   types: ["hook", "hook_share"] },
        { key: "studies", label: "Studies", types: ["study", "step_hook"] },
      ],
      tableOptions: {
        striped: true,
        hover: true,
        pagination: 10,
        search: true,
      },
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
    tabColumns() {
      const base = [
        { name: "Limit type", key: "limitTypeLabel", sortable: true },
        { name: "Limit", key: "costLimitLabel", sortable: true, sortKey: "costLimit" },
        { name: "Last reset", key: "resetAtLabel", sortable: true, sortKey: "resetAt" },
      ];
      if (this.activeTab === "models") {
        return [
          { name: "Model", key: "entityLabel", sortable: true },
          { name: "Shared with", key: "sharedWith", sortable: true },
          ...base,
        ];
      }
      if (this.activeTab === "hooks") {
        return [
          { name: "Hook", key: "entityLabel", sortable: true },
          { name: "Shared with", key: "sharedWith", sortable: true },
          ...base,
        ];
      }
      return [
        { name: "Study", key: "studyLabel", sortable: true },
        { name: "Level", key: "levelLabel", sortable: true },
        { name: "Hook", key: "hookLabel", sortable: true },
        ...base,
      ];
    },
    budgetRows() {
      return this.budgets
        .filter((b) => !b.deleted)
        .map((b) => {
          const { entityType, entityLabel, sharedWith, studyLabel, levelLabel, hookLabel } = this.resolveScope(b);
          return {
            ...b,
            entityType,
            entityLabel,
            sharedWith: sharedWith || "—",
            studyLabel: studyLabel || "—",
            levelLabel: levelLabel || "—",
            hookLabel: hookLabel || "—",
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
          icon: "arrow-counterclockwise",
          title: "Reset spending window",
          action: "reset",
          options: { iconOnly: true, specifiers: { "btn-outline-warning": true } },
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
    tabRows(tabKey) {
      const tab = this.tabs.find((t) => t.key === tabKey);
      if (!tab) return [];
      return this.budgetRows.filter((r) => tab.types.includes(r.entityType));
    },
    resolveScope(b) {
      if (b.studyStepId && b.hookId) {
        const step = this.studyStepsById[b.studyStepId];
        const study = step ? this.studiesById[step.studyId] : null;
        const hook = this.hooksById[b.hookId];
        const studyLabel = study?.name || (step ? `Study #${step.studyId}` : `Study #?`);
        const levelLabel = step ? `Step ${step.stepNumber || step.id}` : `Step #${b.studyStepId}`;
        const hookLabel = hook?.name || `Hook #${b.hookId}`;
        return { entityType: "step_hook", entityLabel: studyLabel, sharedWith: null, studyLabel, levelLabel, hookLabel };
      }
      if (b.modelId) {
        const m = this.modelsById[b.modelId];
        return { entityType: "model", entityLabel: m?.name || `Model #${b.modelId}`, sharedWith: null };
      }
      if (b.shareId) {
        const share = this.modelSharesById[b.shareId];
        const model = share ? this.modelsById[share.aiModelId] : null;
        return { entityType: "model_share", entityLabel: model?.name || `Model #${share?.aiModelId}`, sharedWith: this.recipientLabel(share) };
      }
      if (b.hookId) {
        const h = this.hooksById[b.hookId];
        return { entityType: "hook", entityLabel: h?.name || `Hook #${b.hookId}`, sharedWith: null };
      }
      if (b.hookShareId) {
        const share = this.hookSharesById[b.hookShareId];
        const hook = share ? this.hooksById[share.aiHookId] : null;
        return { entityType: "hook_share", entityLabel: hook?.name || `Hook #${share?.aiHookId}`, sharedWith: this.recipientLabel(share) };
      }
      if (b.studyId) {
        const s = this.studiesById[b.studyId];
        const studyLabel = s?.name || `Study #${b.studyId}`;
        return { entityType: "study", entityLabel: studyLabel, sharedWith: null, studyLabel, levelLabel: "Global", hookLabel: null };
      }
      return { entityType: "unknown", entityLabel: "—", sharedWith: null, studyLabel: null, levelLabel: null, hookLabel: null };
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
        case "reset":  this.openReset(data.params); break;
        case "delete": this.openDelete(data.params); break;
      }
    },
    openEdit(row) {
      this.$refs.editModal.open(row);
    },
    openReset(row) {
      this.$refs.confirmModal.open(
        "Reset",
        `Reset the spending counter for this cap? Past usage will no longer count toward the limit.`,
        "",
        (confirmed) => {
          if (!confirmed) return;
          this.$socket.emit(
            "appDataUpdate",
            { table: "ai_budget", data: { id: row.id, resetAt: new Date().toISOString() } },
            (result) => {
              if (result?.success) {
                this.toastSuccess("Spending window reset");
              } else {
                this.toastError(result?.message || "Failed to reset");
              }
            }
          );
        }
      );
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
