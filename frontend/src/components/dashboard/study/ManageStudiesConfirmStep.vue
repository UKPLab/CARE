<template>
  <div class="confirmation-container">
    <BasicForm
      v-if="mode === 'bulkClose'"
      :model-value="notificationSettings"
      :fields="notificationFields"
      class="mt-4"
      @update:model-value="$emit('update:notificationSettings', $event)"
    />
    <div
      v-if="text"
      class="confirmation-content"
      :class="{ 'delete-warning-container': mode === 'bulkDelete' }"
    >
      <h6>{{ text.heading }}</h6>
      <p class="text-muted">{{ text.about }}</p>
      <p v-if="selection.allMatching" class="text-muted">{{ selectionSummary }}</p>
      <ul v-else class="selected-items-list">
        <li v-for="study in selection.rows" :key="study.id">
          {{ $t('dashboard.study.studyListItem', {
            name: study.name,
            workflow: study.workflowName,
            owner: study.ownerName,
          }) }}
        </li>
      </ul>
      <div v-if="mode === 'bulkClose' && notificationSettings.notifySessions" class="alert alert-warning mt-3">
        <i class="fas fa-envelope"></i> {{ $t('dashboard.study.notifyOpenSessionsAlert') }}
      </div>
    </div>
  </div>
</template>

<script>
import BasicForm from "@/basic/Form.vue";

/**
 * Confirmation step of the manage-studies stepper: lists the studies a bulk
 * close / open / delete will touch (or summarises a select-all query) and, for
 * closing, offers to notify participants with open sessions.
 *
 * @author: Dennis Zyska
 */
export default {
  name: "ManageStudiesConfirmStep",
  components: { BasicForm },
  props: {
    /** bulkClose, bulkOpen or bulkDelete */
    mode: {
      type: String,
      default: null,
    },
    selection: {
      type: Object,
      required: true,
    },
    /** Workflow filter of the selection step: "all" or a workflow id */
    workflowFilter: {
      type: String,
      default: "all",
    },
    notificationSettings: {
      type: Object,
      required: true,
    },
  },
  emits: ["update:notificationSettings"],
  computed: {
    notificationFields() {
      return [
        {
          key: "notifySessions",
          label: this.$t("dashboard.study.notifyActiveSessions"),
          type: "switch",
          required: false,
        },
      ];
    },
    text() {
      const count = this.selection.count;
      if (this.mode === "bulkClose") {
        return { heading: this.$t("dashboard.study.studiesToClose"), about: this.$t("dashboard.study.aboutToClose", { count }) };
      }
      if (this.mode === "bulkOpen") {
        return { heading: this.$t("dashboard.study.studiesToOpen"), about: this.$t("dashboard.study.aboutToOpen", { count }) };
      }
      if (this.mode === "bulkDelete") {
        return { heading: this.$t("dashboard.study.studiesToDelete"), about: this.$t("dashboard.study.aboutToDelete", { count }) };
      }
      return null;
    },
    /** Shown instead of a row list when the selection is "everything this query matches". */
    selectionSummary() {
      const parts = [];
      if (this.mode === "bulkClose") {
        parts.push(this.$t("dashboard.study.allOpenStudies"));
      } else if (this.mode === "bulkOpen") {
        parts.push(this.$t("dashboard.study.allClosedStudies"));
      } else {
        parts.push(this.$t("dashboard.study.allStudies"));
      }
      if (this.workflowFilter === "all") {
        parts.push(this.$t("dashboard.study.allWorkflowsInFilter"));
      } else {
        const id = Number(this.workflowFilter);
        const name = this.$store.getters["table/workflow/get"](id)?.name
          || this.$t("dashboard.study.workflowFallback", { id });
        parts.push(this.$t("dashboard.study.workflowNamed", { name }));
      }
      if (this.selection.query?.search) {
        parts.push(this.$t("dashboard.study.searchQuoted", { search: this.selection.query.search }));
      }
      if (this.selection.excludeIds.length > 0) {
        parts.push(this.$t("dashboard.study.unselectedCount", { count: this.selection.excludeIds.length }));
      }
      return this.$t("dashboard.study.matchingFilter", { parts: parts.join(", ") });
    },
  },
};
</script>

<style scoped>
/* Confirmation alerts */
.confirmation-content .alert {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-radius: 0.375rem;
  border: none;
  font-size: 0.95rem;
}

.confirmation-content .alert-warning {
  background-color: var(--bs-warning-bg-subtle);
  border-color: var(--bs-warning-border-subtle);
  color: var(--bs-warning-text-emphasis);
}

.confirmation-content .alert strong {
  font-weight: 700;
}

/* Delete warning specific styling */
.delete-warning-container {
  border-left-color: #dc3545 !important;
}

.confirmation-container {
  padding: 1.5rem;
}

.confirmation-content {
  background-color: var(--bs-body-bg, #ffffff);
  border-radius: 0.5rem;
  padding: 1.5rem;
  border: 1px solid var(--bs-border-color, #e9ecef);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.confirmation-content h6 {
  margin-bottom: 1.25rem;
  font-weight: 700;
  color: var(--bs-body-color, #212529);
  font-size: 1.1rem;
}

.confirmation-content .text-muted {
  margin-bottom: 1.25rem;
  font-size: 0.95rem;
  line-height: 1.5;
}

.confirmation-content .text-muted strong {
  font-weight: 700;
  background-color: var(--bs-primary-bg-subtle, #e7f3ff);
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  color: var(--bs-primary-text-emphasis, #0056b3);
}

.selected-items-list {
  max-height: 350px;
  overflow-y: auto;
  border: 1px solid var(--bs-border-color, #dee2e6);
  border-radius: 0.375rem;
  padding: 1rem;
  background-color: var(--bs-body-bg, white);
  margin-bottom: 1.5rem;
  list-style: none;
}

.selected-items-list li {
  padding: 0.75rem 0.875rem;
  border-bottom: 1px solid var(--bs-border-color, #f0f0f0);
  font-size: 0.95rem;
  border-left: 3px solid var(--care-primary);
  margin-bottom: 0.5rem;
  background-color: var(--bs-tertiary-bg, #f8f9fa);
  border-radius: 0.25rem;
}

.selected-items-list li:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

/* Scrollbar styling */
.selected-items-list::-webkit-scrollbar {
  width: 6px;
}

.selected-items-list::-webkit-scrollbar-track {
  background: var(--bs-tertiary-bg, #f1f1f1);
}

.selected-items-list::-webkit-scrollbar-thumb {
  background: var(--bs-secondary-color, #888);
  border-radius: 3px;
}

.selected-items-list::-webkit-scrollbar-thumb:hover {
  background: var(--bs-body-color, #555);
}
</style>
